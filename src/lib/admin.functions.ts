import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

/**
 * Bootstrap: the very first authenticated user to hit this becomes admin,
 * but only while the `admin_bootstrap.enabled` setting is true. After the
 * first admin is created, bootstrap disables itself.
 */
export const claimBootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (existing) {
      // Someone else already claimed; check if current caller is already admin.
      const { data: mine } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      return { granted: false, alreadyAdmin: !!mine };
    }

    const { data: cfg } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "admin_bootstrap")
      .maybeSingle();
    const enabled = (cfg?.value as { enabled?: boolean } | null)?.enabled;
    if (!enabled) return { granted: false, alreadyAdmin: false };

    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    await supabaseAdmin
      .from("settings")
      .update({ value: { enabled: false }, updated_at: new Date().toISOString() })
      .eq("key", "admin_bootstrap");
    return { granted: true, alreadyAdmin: true };
  });

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, ads, wds, tasksC, pendingWd] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("ads_history").select("reward"),
      supabaseAdmin.from("withdrawals").select("amount_usdt,status"),
      supabaseAdmin.from("task_completions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const totalFlamesPaid = (ads.data ?? []).reduce((a, r) => a + Number(r.reward), 0);
    const totalUsdtPaid = (wds.data ?? [])
      .filter((w) => w.status === "approved")
      .reduce((a, w) => a + Number(w.amount_usdt), 0);
    const totalUsdtPending = (wds.data ?? [])
      .filter((w) => w.status === "pending")
      .reduce((a, w) => a + Number(w.amount_usdt), 0);

    return {
      totalUsers: users.count ?? 0,
      totalAds: (ads.data ?? []).length,
      totalFlamesPaid,
      totalUsdtPaid,
      totalUsdtPending,
      approvedTasks: tasksC.count ?? 0,
      pendingWithdrawals: pendingWd.count ?? 0,
    };
  });

// ---------- Tasks CRUD ----------
const taskInput = z.object({
  id: z.string().uuid().optional(),
  type: z.enum([
    "telegram_join","telegram_group","bot_start","website","social_follow","youtube","quiz","survey","app_download",
  ]),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  reward: z.number().int().positive(),
  target_url: z.string().url().nullish(),
  target_chat: z.string().max(120).nullish(),
  verification_type: z.enum(["manual","auto","bot"]).default("manual"),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  expires_at: z.string().nullish(),
  category: z.enum(["main", "partner", "other"]).default("other"),
});


export const upsertTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data };
    if (payload.id) {
      const { error } = await supabaseAdmin.from("tasks").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { id: payload.id };
    }
    const { data: row, error } = await supabaseAdmin.from("tasks").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Withdrawals moderation ----------
export const decideWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        tx_hash: z.string().max(120).nullish(),
        admin_note: z.string().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { postToConfiguredChannel, sendTelegramMessage } = await import("@/lib/telegram-bot.server");

    const { data: wd, error: readErr } = await supabaseAdmin
      .from("withdrawals")
      .select("id,user_id,amount_usdt,amount_flames,fee_usdt,net_usdt,wallet_address,status")
      .eq("id", data.id)
      .single();
    if (readErr || !wd) throw new Error("Withdrawal not found");
    if (wd.status !== "pending") throw new Error(`Already ${wd.status}`);

    if (data.decision === "approved") {
      const txHash = (data.tx_hash ?? "").trim();
      if (!txHash) throw new Error("Tx hash is required for approval");
      const txUrl = `https://bscscan.com/tx/${encodeURIComponent(txHash)}`;
      const miniAppUrl = "https://t.me/Coinflamesbot/coinflames";
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({ status: "approved", tx_hash: txHash, admin_note: data.admin_note ?? null })
        .eq("id", wd.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: "Withdrawal Approved ✅",
        body: `Your withdrawal of ${wd.net_usdt ?? wd.amount_usdt} USDT has been paid. Tx: ${txHash}`,
      });
      // Send Telegram DM
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id,username,first_name")
        .eq("id", wd.user_id)
        .maybeSingle();
      if (prof?.telegram_id) {
        await sendTelegramMessage(
          prof.telegram_id,
          `✅ <b>Withdrawal Approved</b>\nGross: ${wd.amount_usdt} USDT\nFee: ${wd.fee_usdt ?? 0} USDT\nPaid: <b>${wd.net_usdt ?? wd.amount_usdt} USDT</b>\nTx: <code>${txHash}</code>`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "View Transaction", url: txUrl },
                { text: "Open Mini App", url: miniAppUrl },
              ]],
            },
          },
        );
      }
      const userLabel = prof?.username ? `@${prof.username}` : prof?.first_name ?? "CoinFlames user";
      await postToConfiguredChannel(
        "payment_channel_chat_id",
        `💸 <b>Payment Sent</b>\nUser: ${userLabel}\nPaid: <b>${wd.net_usdt ?? wd.amount_usdt} USDT</b>\nNetwork: BEP20\nWallet: <code>${wd.wallet_address}</code>\nTx: <code>${txHash}</code>`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "View Transaction", url: txUrl },
              { text: "Open Mini App", url: miniAppUrl },
            ]],
          },
        },
      );
    } else {
      // Refund flames on rejection
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("balance,telegram_id")
        .eq("id", wd.user_id)
        .single();
      await supabaseAdmin
        .from("profiles")
        .update({ balance: Number(prof?.balance ?? 0) + Number(wd.amount_flames) })
        .eq("id", wd.user_id);
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({ status: "rejected", admin_note: data.admin_note ?? null })
        .eq("id", wd.id);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: "Withdrawal Rejected",
        body: `Your withdrawal of ${wd.amount_usdt} USDT was rejected. Flames refunded.${
          data.admin_note ? ` Reason: ${data.admin_note}` : ""
        }`,
      });
      if (prof?.telegram_id) {
        await sendTelegramMessage(
          prof.telegram_id,
          `❌ <b>Withdrawal Rejected</b>\nAmount: ${wd.amount_usdt} USDT — Flames refunded.${
            data.admin_note ? `\nReason: ${data.admin_note}` : ""
          }`,
        );
      }
    }
    return { ok: true };
  });

// ---------- Announcements CRUD ----------
const annInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  pinned: z.boolean().default(false),
  active: z.boolean().default(true),
  broadcast: z.boolean().default(false),
  bot_broadcast: z.boolean().default(false),
  channel_post: z.boolean().default(false),
});

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => annInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { bot_broadcast, broadcast, channel_post, ...payload } = data;
    let id = payload.id;
    if (id) {
      const { error } = await supabaseAdmin.from("announcements").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("announcements")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = row.id;
    }
    if (broadcast) {
      await supabaseAdmin.from("notifications").insert({
        user_id: null,
        title: payload.title,
        body: payload.body,
      });
    }
    if (bot_broadcast) {
      const { sendTelegramMessage } = await import("@/lib/telegram-bot.server");
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("suspended", false)
        .not("telegram_id", "is", null);
      for (const user of users ?? []) {
        await sendTelegramMessage(user.telegram_id, `📣 <b>${payload.title}</b>\n\n${payload.body}`);
      }
    }
    if (channel_post) {
      const { postToConfiguredChannel } = await import("@/lib/telegram-bot.server");
      await postToConfiguredChannel("community_chat_id", `📣 <b>${payload.title}</b>\n\n${payload.body}`);
    }
    return { id };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Settings ----------
export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.string().min(1).max(80), value: z.unknown() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("settings")
      .upsert({ key: data.key, value: data.value as never, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Users ----------
export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ banned: data.banned, suspended: data.banned })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    if (data.banned) {
      const { notifyAdmin } = await import("@/lib/telegram-bot.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id,username,first_name")
        .eq("id", data.userId)
        .maybeSingle();
      const uname = prof?.username ? `@${prof.username}` : prof?.first_name ?? "user";
      await notifyAdmin(
        `⛔ <b>Account suspended</b>\nUser: ${uname} (TG <code>${prof?.telegram_id ?? "?"}</code>)`,
      );
    }
    return { ok: true };
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), delta: z.number().int(), note: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("balance,total_earned")
      .eq("id", data.userId)
      .single();
    if (!prof) throw new Error("User not found");
    const newBalance = Math.max(0, Number(prof.balance) + data.delta);
    const newTotal = data.delta > 0 ? Number(prof.total_earned) + data.delta : Number(prof.total_earned);
    await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance, total_earned: newTotal })
      .eq("id", data.userId);
    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      title: data.delta > 0 ? "Balance credited" : "Balance adjusted",
      body: `${data.delta > 0 ? "+" : ""}${data.delta} Flames by admin.${data.note ? ` ${data.note}` : ""}`,
    });
    return { ok: true, newBalance };
  });

// ---------- Reward codes ----------
const rewardCodeInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(80),
  reward: z.number().int().positive(),
  max_claims: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().default(1),
  active: z.boolean().default(true),
  expires_at: z.string().nullable().optional(),
});

export const upsertRewardCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rewardCodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, code: data.code.trim().toUpperCase() };
    if (payload.id) {
      const { error } = await supabaseAdmin.from("reward_codes").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { id: payload.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("reward_codes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRewardCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reward_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
