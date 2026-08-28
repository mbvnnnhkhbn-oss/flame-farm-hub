import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reads that must never be blocked by row-level policies for the signed-in
 * user. All of these are scoped to context.userId on the server.
 */

export const listTasksForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tasks }, { data: comps }] = await Promise.all([
      supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("task_completions").select("task_id").eq("user_id", context.userId),
    ]);
    const done = new Set((comps ?? []).map((c) => c.task_id));
    return (tasks ?? []).map((t) => ({ ...t, completed: done.has(t.id) }));
  });

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export type WithdrawEligibility = {
  ok: boolean;
  adsToday: number;
  adsRequired: number;
  referrals: number;
  referralsRequired: number;
  tasksDone: number;
  tasksTotal: number;
  allTasksRequired: boolean;
  pendingWithdrawal: boolean;
  adsBeforeSubmit: number;
  minWithdrawUsdt: number;
  walletAddress: string | null;
};

export const getWithdrawEligibility = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WithdrawEligibility> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: settingsRows } = await supabaseAdmin
      .from("settings")
      .select("key,value")
      .in("key", ["withdraw_requirements", "economy"]);
    const map = new Map((settingsRows ?? []).map((r) => [r.key, r.value as Record<string, unknown>]));
    const req = (map.get("withdraw_requirements") ?? {}) as {
      daily_ads_required?: number;
      referrals_required?: number;
      all_tasks_required?: boolean;
      ads_before_submit?: number;
    };
    const economy = (map.get("economy") ?? {}) as { min_withdraw_usdt?: number };

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [ads, refs, tasks, comps, pending, profile] = await Promise.all([
      supabaseAdmin
        .from("ads_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
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
      supabaseAdmin.from("profiles").select("wallet_address").eq("id", userId).maybeSingle(),
    ]);

    const activeIds = new Set((tasks.data ?? []).map((t) => t.id));
    const tasksDone = (comps.data ?? []).filter((c) => activeIds.has(c.task_id)).length;
    const adsRequired = Number(req.daily_ads_required ?? 10);
    const referralsRequired = Number(req.referrals_required ?? 2);
    const allTasksRequired = req.all_tasks_required !== false;
    const adsToday = ads.count ?? 0;
    const referrals = refs.count ?? 0;
    const pendingWithdrawal = (pending.count ?? 0) > 0;

    const ok =
      adsToday >= adsRequired &&
      referrals >= referralsRequired &&
      (!allTasksRequired || tasksDone >= activeIds.size) &&
      !pendingWithdrawal;

    return {
      ok,
      adsToday,
      adsRequired,
      referrals,
      referralsRequired,
      tasksDone,
      tasksTotal: activeIds.size,
      allTasksRequired,
      pendingWithdrawal,
      adsBeforeSubmit: Number(req.ads_before_submit ?? 5),
      minWithdrawUsdt: Number(economy.min_withdraw_usdt ?? 0.1),
      walletAddress: profile.data?.wallet_address ?? null,
    };
  });
