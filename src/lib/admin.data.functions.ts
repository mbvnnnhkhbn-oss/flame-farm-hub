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

export const adminListTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListRewardCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: codes, error }, { data: claims }] = await Promise.all([
      supabaseAdmin.from("reward_codes").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("reward_code_claims").select("id,code_id"),
    ]);
    if (error) throw new Error(error.message);
    return (codes ?? []).map((c) => ({
      ...c,
      claims: (claims ?? []).filter((cl) => cl.code_id === c.id).map((cl) => ({ id: cl.id })),
    }));
  });

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ status: z.enum(["pending", "approved", "rejected"]).optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("withdrawals").select("*").order("created_at", { ascending: false });
    if (data?.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)));
    const profiles = new Map<
      string,
      { telegram_id: number | null; username: string | null; first_name: string | null }
    >();
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,telegram_id,username,first_name")
        .in("id", ids);
      for (const p of profs ?? []) {
        profiles.set(p.id, {
          telegram_id: p.telegram_id,
          username: p.username,
          first_name: p.first_name,
        });
      }
    }
    return (rows ?? []).map((r) => ({ ...r, profile: profiles.get(r.user_id) ?? null }));
  });

/** Users list ordered by balance (highest first) with search + suspend info. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().max(80).optional(), sort: z.enum(["balance", "earned", "recent"]).optional() })
      .optional()
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sort = data?.sort ?? "balance";
    let q = supabaseAdmin
      .from("profiles")
      .select(
        "id,telegram_id,username,first_name,last_name,photo_url,balance,total_earned,today_earned,banned,suspended,suspend_reason,created_at,wallet_address",
      )
      .limit(200);
    if (sort === "balance") q = q.order("balance", { ascending: false });
    else if (sort === "earned") q = q.order("total_earned", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    const s = (data?.search ?? "").trim();
    if (s) {
      if (/^\d+$/.test(s)) q = q.eq("telegram_id", Number(s));
      else q = q.ilike("username", `%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Full activity trail for one user. */
export const adminUserActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.userId;

    const [profile, ads, checkins, tasks, wds, refs, mining, codes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin
        .from("ads_history")
        .select("id,reward,provider,watched_at")
        .eq("user_id", uid)
        .order("watched_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("daily_checkins")
        .select("id,streak_day,reward,claimed_date")
        .eq("user_id", uid)
        .order("claimed_date", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("task_completions")
        .select("id,task_id,status,reward,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("withdrawals")
        .select("id,amount_usdt,net_usdt,status,tx_hash,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("referrals")
        .select("id,referred_id,join_paid,day1_paid,day2_paid,lifetime_commission,created_at")
        .eq("referrer_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("mining_claims")
        .select("id,amount,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("reward_code_claims")
        .select("id,reward,claimed_at")
        .eq("user_id", uid)
        .order("claimed_at", { ascending: false })
        .limit(30),
    ]);

    const adsByProvider: Record<string, number> = {};
    for (const a of ads.data ?? []) {
      const p = a.provider ?? "unknown";
      adsByProvider[p] = (adsByProvider[p] ?? 0) + 1;
    }

    return {
      profile: profile.data ?? null,
      ads: ads.data ?? [],
      adsByProvider,
      checkins: checkins.data ?? [],
      tasks: tasks.data ?? [],
      withdrawals: wds.data ?? [],
      referrals: refs.data ?? [],
      mining: mining.data ?? [],
      rewardCodes: codes.data ?? [],
    };
  });
