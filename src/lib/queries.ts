import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
  });

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map as {
        economy: { flames_per_usdt: number; min_withdraw_usdt: number; max_withdraw_usdt: number };
        ads: { reward_per_ad: number; daily_limit: number; cooldown_seconds: number };
        daily_rewards: Record<string, number>;
        referral: { invite_bonus: number; commission_pct: number };
        app: { bot_username: string; support_url: string };
      };
    },
  });

export const announcementsQuery = () =>
  queryOptions({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

export const tasksQuery = (userId: string) =>
  queryOptions({
    queryKey: ["tasks", userId],
    queryFn: async () => {
      const [{ data: tasks, error: te }, { data: comps, error: ce }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("active", true)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("task_completions").select("task_id,status").eq("user_id", userId),
      ]);
      if (te) throw te;
      if (ce) throw ce;
      const doneSet = new Set((comps ?? []).map((c) => c.task_id));
      return (tasks ?? []).map((t) => ({ ...t, completed: doneSet.has(t.id) }));
    },
  });

export const adsTodayQuery = (userId: string) =>
  queryOptions({
    queryKey: ["ads_today", userId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("ads_history")
        .select("id,watched_at,reward")
        .eq("user_id", userId)
        .gte("watched_at", startOfDay.toISOString())
        .order("watched_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const checkinsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["checkins", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", userId)
        .order("claimed_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

export const withdrawalsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["withdrawals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const referralsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["referrals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, referred:referred_id(profiles(*))")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const leaderboardQuery = () =>
  queryOptions({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,first_name,photo_url,total_earned")
        .order("total_earned", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
