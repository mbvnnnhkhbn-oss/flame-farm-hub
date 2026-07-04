import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type DailyRewards = Record<string, number>;

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
    z.object({ blockId: z.string().optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const cfg = await getSetting<{
      reward_per_ad: number;
      daily_limit: number;
      cooldown_seconds: number;
      block_id_reward?: string;
      block_id_interstitial?: string;
    }>("ads", { reward_per_ad: 10, daily_limit: 10, cooldown_seconds: 10 });

    const { data: last } = await supabaseAdmin
      .from("ads_history")
      .select("watched_at")
      .eq("user_id", userId)
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
      .gte("watched_at", startOfDay.toISOString());
    if ((count ?? 0) >= cfg.daily_limit) {
      throw new Error("Daily ad limit reached. Come back tomorrow!");
    }

    await supabaseAdmin
      .from("ads_history")
      .insert({ user_id: userId, reward: cfg.reward_per_ad });
    await addBalance(userId, cfg.reward_per_ad);
    return { reward: cfg.reward_per_ad, blockId: data?.blockId ?? null };
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
      .select("id,reward,active,expires_at,verification_type")
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

    // TODO Phase 2: real verification (Telegram getChatMember etc).
    // For now auto-approve.
    await supabaseAdmin.from("task_completions").insert({
      user_id: userId,
      task_id: task.id,
      status: "approved",
      reward: task.reward,
    });
    await addBalance(userId, Number(task.reward));

    // Referral bonus payout on first approved task
    const { count: approvedCount } = await supabaseAdmin
      .from("task_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "approved");
    if ((approvedCount ?? 0) === 1) {
      const { data: refRow } = await supabaseAdmin
        .from("referrals")
        .select("id,referrer_id,bonus_amount,bonus_paid")
        .eq("referred_id", userId)
        .maybeSingle();
      if (refRow && !refRow.bonus_paid && refRow.bonus_amount > 0) {
        await addBalance(refRow.referrer_id, Number(refRow.bonus_amount));
        await supabaseAdmin.from("referrals").update({ bonus_paid: true }).eq("id", refRow.id);
        await supabaseAdmin.from("notifications").insert({
          user_id: refRow.referrer_id,
          title: "Referral Bonus 🎉",
          body: `You earned ${refRow.bonus_amount} Flames — your referral completed their first task!`,
        });
      }
    }

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
    }>("economy", { flames_per_usdt: 100000, min_withdraw_usdt: 1, max_withdraw_usdt: 100 });

    if (data.amountUsdt < economy.min_withdraw_usdt) {
      throw new Error(`Minimum withdraw is ${economy.min_withdraw_usdt} USDT`);
    }
    if (data.amountUsdt > economy.max_withdraw_usdt) {
      throw new Error(`Maximum withdraw is ${economy.max_withdraw_usdt} USDT`);
    }

    const amountFlames = Math.round(data.amountUsdt * economy.flames_per_usdt);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();
    if (!profile || Number(profile.balance) < amountFlames) {
      throw new Error("Insufficient balance");
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
        wallet_address: data.walletAddress,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: wd.id };
  });
