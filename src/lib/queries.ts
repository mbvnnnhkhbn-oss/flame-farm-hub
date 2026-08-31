import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listTasksForMe,
  listMyWithdrawals,
  getWithdrawEligibility,
  listMyReferrals,
} from "@/lib/data.functions";


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
        economy: {
          flames_per_usdt: number;
          min_withdraw_usdt: number;
          max_withdraw_usdt: number;
          withdraw_fee_flat_usdt?: number;
          withdraw_fee_pct?: number;
        };
        ads: {
          reward_per_ad: number;
          daily_limit: number;
          cooldown_seconds: number;
          block_id_reward?: string;
          block_id_interstitial?: string;
          watch_seconds?: number;
          watch_seconds_reward?: number;
          watch_seconds_interstitial?: number;
          reward_per_interstitial?: number;
          interstitial_daily_limit?: number;
        };
        daily_rewards: Record<string, number>;
        referral: {
          invite_bonus: number;
          commission_pct: number;
          join_bonus?: number;
          day1_bonus?: number;
          day2_bonus?: number;
          day1_ads_required?: number;
          day2_ads_required?: number;
        };
        app: { bot_username: string; start_app_name?: string; support_url: string; admin_chat_id?: string; community_url?: string; payment_channel_url?: string; payment_channel_chat_id?: string };
        open_bonus?: { min: number; max: number; cooldown_hours: number };
        view_site?: { daily_limit?: number; reward?: number; watch_seconds?: number; links?: string[] };
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
    queryFn: () => listTasksForMe(),
  });

export const adsTodayQuery = (userId: string) =>
  queryOptions({
    queryKey: ["ads_today", userId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("ads_history")
        .select("id,watched_at,reward,provider")
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
    queryFn: () => listMyWithdrawals(),
  });

export const withdrawEligibilityQuery = (userId: string) =>
  queryOptions({
    queryKey: ["withdraw_eligibility", userId],
    queryFn: () => getWithdrawEligibility(),
  });

export const referralsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["referrals", userId],
    queryFn: () => listMyReferrals(),
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
