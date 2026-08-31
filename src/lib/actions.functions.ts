import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DailyRewards = Record<string, number>;

async function payReferralCommission(userId: string, earnedAmount: number) {
  if (earnedAmount <= 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ref } = await supabaseAdmin
    .from("referrals")
    .select("id,referrer_id,commission_pending")
    .eq("referred_id", userId)
    .maybeSingle();
  if (!ref) return;
  const pct = await getSetting<{ commission_pct?: number }>("referral", {}).then(
    (v) => Number(v.commission_pct ?? 5),
  );
  const commission = Math.floor((earnedAmount * pct) / 100);
  if (commission <= 0) return;
  await supabaseAdmin
    .from("referrals")
    .update({ commission_pending: Number(ref.commission_pending ?? 0) + commission })
    .eq("id", ref.id);
  const { sendUserBotMessage } = await import("./telegram-bot.server");
  await sendUserBotMessage(
    ref.referrer_id,
    `🔥 <b>Referral commission pending</b>\n+${commission} Flames from your invite's earning. Open the app to claim it.`,
  );
}

async function addBalance(userId: string, amount: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("balance,total_earned,today_earned,today_date")
    .eq("id", userId)
    .single();
  if (!profile) throw new Error("Profile not found");
  const sameDay = profile.today_date === today;
  const newTodayEarned = (sameDay ? Number(profile.today_earned) : 0) + amount;
  await supabaseAdmin
    .from("profiles")
    .update({
      balance: Number(profile.balance) + amount,
      total_earned: Number(profile.total_earned) + amount,
      today_earned: newTodayEarned,
      today_date: today,
    })
    .eq("id", userId);
  await payReferralCommission(userId, amount);
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", key).maybeSingle();
  return ((data?.value as T | null) ?? fallback);
}

export const claimDailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("streak_day,last_checkin_date")
      .eq("id", userId)
      .single();
    if (!profile) throw new Error("Profile not found");

    if (profile.last_checkin_date === today) {
      throw new Error("Already claimed today");
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const continuing = profile.last_checkin_date === yesterday;
    const nextStreak = continuing ? Math.min((profile.streak_day ?? 0) + 1, 7) : 1;
    const displayStreak = nextStreak === 7 ? 7 : nextStreak;

    const rewards = await getSetting<DailyRewards>("daily_rewards", {
      "1": 100, "2": 150, "3": 250, "4": 400, "5": 600, "6": 800, "7": 1000,
    });
    const reward = Number(rewards[String(displayStreak)] ?? 100);

    await supabaseAdmin.from("daily_checkins").insert({
      user_id: userId,
      streak_day: displayStreak,
      reward,
    });
    await supabaseAdmin
      .from("profiles")
      .update({
        streak_day: displayStreak === 7 ? 0 : displayStreak,
        last_checkin_date: today,
      })
      .eq("id", userId);

    await addBalance(userId, reward);
    return { reward, streak_day: displayStreak };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        blockId: z.string().optional(),
        kind: z.enum(["reward", "interstitial"]).default("reward"),
        watchedSeconds: z.number().min(0).optional(),
      })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const kind = data?.kind ?? "reward";
    const provider = kind === "interstitial" ? "adsgram_int" : "adsgram";

    const cfg = await getSetting<{
      reward_per_ad: number;
      daily_limit: number;
      cooldown_seconds: number;
      reward_per_interstitial?: number;
      interstitial_daily_limit?: number;
      watch_seconds?: number;
      block_id_reward?: string;
      block_id_interstitial?: string;
    }>("ads", { reward_per_ad: 5, daily_limit: 10, cooldown_seconds: 10 });

    const minWatch = Number(cfg.watch_seconds ?? 10);
    if (typeof data?.watchedSeconds === "number" && data.watchedSeconds < minWatch) {
      throw new Error(`Watch the ad for at least ${minWatch} seconds to earn`);
    }

    const reward =
      kind === "interstitial"
        ? Number(cfg.reward_per_interstitial ?? 5)
        : Number(cfg.reward_per_ad ?? 5);
    const dailyLimit =
      kind === "interstitial"
        ? Number(cfg.interstitial_daily_limit ?? 10)
        : Number(cfg.daily_limit ?? 10);

    const { data: last } = await supabaseAdmin
      .from("ads_history")
      .select("watched_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .order("watched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last) {
      const elapsed = (Date.now() - new Date(last.watched_at).getTime()) / 1000;
      if (elapsed < cfg.cooldown_seconds) {
        throw new Error(`Wait ${Math.ceil(cfg.cooldown_seconds - elapsed)}s before next ad`);
      }
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ads_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("provider", provider)
      .gte("watched_at", startOfDay.toISOString());
    if ((count ?? 0) >= dailyLimit) {
      throw new Error("Daily ad limit reached. Come back tomorrow!");
    }

    await supabaseAdmin.from("ads_history").insert({ user_id: userId, reward, provider });
    await addBalance(userId, reward);
    await checkReferralAdMilestones(userId);
    return { reward, kind, blockId: data?.blockId ?? null };
  });

/** Records one of the ads a user must watch before submitting a withdrawal. */
export const recordWithdrawGateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ watchedSeconds: z.number().min(0) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = await getSetting<{ watch_seconds?: number }>("ads", {});
    const minWatch = Number(cfg.watch_seconds ?? 10);
    if (data.watchedSeconds < minWatch) {
      throw new Error(`Watch the ad for at least ${minWatch} seconds`);
    }
    await supabaseAdmin
      .from("ads_history")
      .insert({ user_id: context.userId, reward: 0, provider: "withdraw_gate" });

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("ads_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("provider", "withdraw_gate")
      .gte("watched_at", since);
    return { watched: count ?? 0 };
  });

async function checkReferralAdMilestones(referredUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ref } = await supabaseAdmin
    .from("referrals")
    .select(
      "id,referrer_id,day1_paid,day2_paid,day1_bonus,day2_bonus,referred_joined_date",
    )
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (!ref || (ref.day1_paid && ref.day2_paid)) return;

  const cfg = await getSetting<{ day1_ads_required?: number; day2_ads_required?: number }>(
    "referral",
    {},
  );
  const day1Req = Number(cfg.day1_ads_required ?? 10);
  const day2Req = Number(cfg.day2_ads_required ?? 10);

  const joinDate = new Date(ref.referred_joined_date + "T00:00:00Z");
  const day1Start = joinDate.toISOString();
  const day2Date = new Date(joinDate.getTime() + 86400000);
  const day2Start = day2Date.toISOString();
  const day3Start = new Date(joinDate.getTime() + 2 * 86400000).toISOString();

  async function payMilestone(amount: number, title: string) {
    const { data: refP } = await supabaseAdmin
      .from("profiles")
      .select("balance,total_earned")
      .eq("id", ref!.referrer_id)
      .single();
    if (!refP) return;
    await supabaseAdmin
      .from("profiles")
      .update({
        balance: Number(refP.balance) + amount,
        total_earned: Number(refP.total_earned) + amount,
      })
      .eq("id", ref!.referrer_id);
    await supabaseAdmin.from("notifications").insert({
      user_id: ref!.referrer_id,
      title,
      body: `+${amount} Flames — referral milestone reached!`,
    });
      const { sendUserBotMessage } = await import("./telegram-bot.server");
      await sendUserBotMessage(
        ref!.referrer_id,
        `🎉 <b>${title}</b>\n+${amount} Flames added to your balance.`,
      );
  }

  if (!ref.day1_paid) {
    const { count: c1 } = await supabaseAdmin
      .from("ads_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", referredUserId)
      .gte("watched_at", day1Start)
      .lt("watched_at", day2Start);
    if ((c1 ?? 0) >= day1Req) {
      await supabaseAdmin
        .from("referrals")
        .update({ day1_paid: true })
        .eq("id", ref.id);
      await payMilestone(Number(ref.day1_bonus), "Referral Day-1 Bonus 🔥");
    }
  }
  if (!ref.day2_paid) {
    const { count: c2 } = await supabaseAdmin
      .from("ads_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", referredUserId)
      .gte("watched_at", day2Start)
      .lt("watched_at", day3Start);
    if ((c2 ?? 0) >= day2Req) {
      await supabaseAdmin
        .from("referrals")
        .update({ day2_paid: true })
        .eq("id", ref.id);
      await payMilestone(Number(ref.day2_bonus), "Referral Day-2 Bonus 🚀");
    }
  }
}

export const claimReferralCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: rows } = await supabaseAdmin
      .from("referrals")
      .select("id,commission_pending,lifetime_commission")
      .eq("referrer_id", userId)
      .gt("commission_pending", 0);

    const total = (rows ?? []).reduce(
      (s, r) => s + Number(r.commission_pending ?? 0),
      0,
    );
    if (total <= 0) throw new Error("Nothing to claim yet");

    for (const r of rows ?? []) {
      await supabaseAdmin
        .from("referrals")
        .update({
          commission_pending: 0,
          lifetime_commission:
            Number(r.lifetime_commission ?? 0) + Number(r.commission_pending ?? 0),
        })
        .eq("id", r.id);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance,total_earned")
      .eq("id", userId)
      .single();
    if (profile) {
      await supabaseAdmin
        .from("profiles")
        .update({
          balance: Number(profile.balance) + total,
          total_earned: Number(profile.total_earned) + total,
        })
        .eq("id", userId);
    }
    return { claimed: total };
  });

export const claimRewardCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().min(2).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const code = data.code.trim().toUpperCase();

    const { data: rewardCode } = await supabaseAdmin
      .from("reward_codes")
      .select("id,code,reward,max_claims,per_user_limit,active,expires_at")
      .eq("code", code)
      .maybeSingle();
    if (!rewardCode || !rewardCode.active) throw new Error("Reward code is invalid");
    if (rewardCode.expires_at && new Date(rewardCode.expires_at) < new Date()) {
      throw new Error("Reward code has expired");
    }

    const { count: myClaims } = await supabaseAdmin
      .from("reward_code_claims")
      .select("id", { count: "exact", head: true })
      .eq("code_id", rewardCode.id)
      .eq("user_id", userId);
    if ((myClaims ?? 0) >= Number(rewardCode.per_user_limit ?? 1)) {
      throw new Error("You already claimed this code");
    }

    if (rewardCode.max_claims) {
      const { count: totalClaims } = await supabaseAdmin
        .from("reward_code_claims")
        .select("id", { count: "exact", head: true })
        .eq("code_id", rewardCode.id);
      if ((totalClaims ?? 0) >= rewardCode.max_claims) throw new Error("Reward code limit reached");
    }

    await supabaseAdmin.from("reward_code_claims").insert({
      code_id: rewardCode.id,
      user_id: userId,
      reward: rewardCode.reward,
    });
    await addBalance(userId, Number(rewardCode.reward));
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Reward code claimed 🎁",
      body: `+${rewardCode.reward} Flames added to your balance.`,
    });
    return { reward: Number(rewardCode.reward) };
  });

export const claimOpenBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const cfg = await getSetting<{ min: number; max: number; cooldown_hours: number }>(
      "open_bonus",
      { min: 2, max: 5, cooldown_hours: 6 },
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("last_open_bonus_at,suspended")
      .eq("id", userId)
      .single();
    if (!profile) throw new Error("Profile not found");
    if (profile.suspended) return { reward: 0, skipped: true, reason: "suspended" as const };
    if (profile.last_open_bonus_at) {
      const elapsedMs = Date.now() - new Date(profile.last_open_bonus_at).getTime();
      if (elapsedMs < cfg.cooldown_hours * 3600 * 1000) {
        return { reward: 0, skipped: true, reason: "cooldown" as const };
      }
    }

    const min = Math.max(0, Math.floor(cfg.min));
    const max = Math.max(min, Math.floor(cfg.max));
    const reward = min + Math.floor(Math.random() * (max - min + 1));

    await supabaseAdmin
      .from("profiles")
      .update({ last_open_bonus_at: new Date().toISOString() })
      .eq("id", userId);
    if (reward > 0) await addBalance(userId, reward);
    return { reward, skipped: false as const };
  });

export const completeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ taskId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("id,reward,active,expires_at,verification_type,type,target_chat")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task || !task.active) throw new Error("Task not available");
    if (task.expires_at && new Date(task.expires_at) < new Date()) throw new Error("Task expired");

    const { data: existing } = await supabaseAdmin
      .from("task_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("task_id", task.id)
      .maybeSingle();
    if (existing) throw new Error("Task already completed");

    if (
      task.verification_type === "bot" &&
      (task.type === "telegram_join" || task.type === "telegram_group") &&
      task.target_chat
    ) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", userId)
        .single();
      const { checkTelegramMembership } = await import("./telegram-bot.server");
      const isMember = await checkTelegramMembership(task.target_chat, profile?.telegram_id ?? "");
      if (!isMember) throw new Error("Join the Telegram channel/group first, then claim");
    }

    await supabaseAdmin.from("task_completions").insert({
      user_id: userId,
      task_id: task.id,
      status: "approved",
      reward: task.reward,
    });
    await addBalance(userId, Number(task.reward));



    return { reward: Number(task.reward) };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amountUsdt: z.number().positive(),
        walletAddress: z.string().min(20).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const economy = await getSetting<{
      flames_per_usdt: number;
      min_withdraw_usdt: number;
      max_withdraw_usdt: number;
      withdraw_fee_flat_usdt?: number;
      withdraw_fee_pct?: number;
    }>("economy", {
      flames_per_usdt: 10000,
      min_withdraw_usdt: 1,
      max_withdraw_usdt: 100,
      withdraw_fee_flat_usdt: 0.01,
      withdraw_fee_pct: 5,
    });

    if (data.amountUsdt < economy.min_withdraw_usdt) {
      throw new Error(`Minimum withdraw is ${economy.min_withdraw_usdt} USDT`);
    }
    if (data.amountUsdt > economy.max_withdraw_usdt) {
      throw new Error(`Maximum withdraw is ${economy.max_withdraw_usdt} USDT`);
    }

    const feeFlat = Number(economy.withdraw_fee_flat_usdt ?? 0.01);
    const feePct = Number(economy.withdraw_fee_pct ?? 5);
    const fee = +(feeFlat + (data.amountUsdt * feePct) / 100).toFixed(6);
    const netUsdt = +(data.amountUsdt - fee).toFixed(6);
    if (netUsdt <= 0) throw new Error("Amount too small after fees");

    const amountFlames = Math.round(data.amountUsdt * economy.flames_per_usdt);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance,suspended,telegram_id,username,first_name")
      .eq("id", userId)
      .single();
    if (!profile) throw new Error("Profile not found");
    if (profile.suspended) throw new Error("Account is suspended");
    if (Number(profile.balance) < amountFlames) {
      throw new Error("Insufficient balance");
    }

    // ---- Withdrawal requirements ----
    const req = await getSetting<{
      daily_ads_required?: number;
      referrals_required?: number;
      all_tasks_required?: boolean;
      ads_before_submit?: number;
    }>("withdraw_requirements", {});
    const adsRequired = Number(req.daily_ads_required ?? 10);
    const referralsRequired = Number(req.referrals_required ?? 2);
    const allTasksRequired = req.all_tasks_required !== false;
    const gateAds = Number(req.ads_before_submit ?? 5);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [adsRes, refRes, tasksRes, compRes, pendingRes, gateRes] = await Promise.all([
      supabaseAdmin
        .from("ads_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("provider", ["adsgram", "adsgram_int"])
        .gte("watched_at", startOfDay.toISOString()),
      supabaseAdmin
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId),
      supabaseAdmin.from("tasks").select("id").eq("active", true),
      supabaseAdmin.from("task_completions").select("task_id").eq("user_id", userId),
      supabaseAdmin
        .from("withdrawals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending"),
      supabaseAdmin
        .from("ads_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("provider", "withdraw_gate")
        .gte("watched_at", sinceHour),
    ]);

    if ((pendingRes.count ?? 0) > 0) {
      throw new Error("You already have a pending withdrawal. Wait until it is processed.");
    }
    if ((adsRes.count ?? 0) < adsRequired) {
      throw new Error(`Watch ${adsRequired} ads today before withdrawing`);
    }
    if ((refRes.count ?? 0) < referralsRequired) {
      throw new Error(`Invite ${referralsRequired} friends before withdrawing`);
    }
    if (allTasksRequired) {
      const activeIds = new Set((tasksRes.data ?? []).map((t) => t.id));
      const done = (compRes.data ?? []).filter((c) => activeIds.has(c.task_id)).length;
      if (done < activeIds.size) throw new Error("Complete all active tasks before withdrawing");
    }
    if ((gateRes.count ?? 0) < gateAds) {
      throw new Error(`Watch ${gateAds} ads to confirm this withdrawal`);
    }

    // consume the gate ads so they can't be reused for another request
    const { data: gateRows } = await supabaseAdmin
      .from("ads_history")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "withdraw_gate")
      .gte("watched_at", sinceHour);
    for (const row of gateRows ?? []) {
      await supabaseAdmin.from("ads_history").update({ provider: "withdraw_gate_used" }).eq("id", row.id);
    }


    await supabaseAdmin
      .from("profiles")
      .update({ balance: Number(profile.balance) - amountFlames, wallet_address: data.walletAddress })
      .eq("id", userId);

    const { data: wd, error } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: userId,
        amount_flames: amountFlames,
        amount_usdt: data.amountUsdt,
        fee_usdt: fee,
        net_usdt: netUsdt,
        wallet_address: data.walletAddress,
        admin_note: `fee=${fee} net=${netUsdt}`,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { notifyAdmin, sendTelegramMessage } = await import("./telegram-bot.server");
    const uname = profile.username ? `@${profile.username}` : profile.first_name ?? "user";
    await notifyAdmin(
      `💸 <b>New withdraw request</b>\nUser: ${uname} (TG <code>${profile.telegram_id}</code>)\nGross: <b>${data.amountUsdt} USDT</b>\nFee: ${fee} USDT (${feeFlat} + ${feePct}%)\nNet: <b>${netUsdt} USDT</b>\nCoins: ${amountFlames}\nWallet: <code>${data.walletAddress}</code>`,
    );
    if (profile.telegram_id) {
      await sendTelegramMessage(
        profile.telegram_id,
        `🕒 <b>Withdraw request received</b>\nGross: ${data.amountUsdt} USDT\nFee: ${fee} USDT\nYou will receive: <b>${netUsdt} USDT</b>\nWe'll notify you once approved.`,
      );
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Withdraw request submitted",
      body: `Gross ${data.amountUsdt} USDT · Fee ${fee} · Net ${netUsdt} USDT`,
    });

    return { id: wd.id, fee, netUsdt };
  });

/**
 * "View Site" reward — the user opens one of the configured links and must stay
 * for the minimum watch time before the reward is credited. Daily counters
 * reset at 00:00:00 UTC.
 */
export const claimViewSiteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ watchedSeconds: z.number().min(0), url: z.string().url().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const cfg = await getSetting<{
      daily_limit?: number;
      reward?: number;
      watch_seconds?: number;
      links?: string[];
    }>("view_site", {});
    const minWatch = Number(cfg.watch_seconds ?? 10);
    const reward = Number(cfg.reward ?? 3);
    const dailyLimit = Number(cfg.daily_limit ?? 10);

    if (data.watchedSeconds < minWatch) {
      throw new Error(`Stay on the site for at least ${minWatch} seconds to earn`);
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ads_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("provider", "viewsite")
      .gte("watched_at", startOfDay.toISOString());
    if ((count ?? 0) >= dailyLimit) {
      throw new Error("Daily View Site limit reached. Come back after 00:00 UTC!");
    }

    await supabaseAdmin.from("ads_history").insert({ user_id: userId, reward, provider: "viewsite" });
    await addBalance(userId, reward);
    return { reward };
  });
