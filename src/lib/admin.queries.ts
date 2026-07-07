import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const adminIsAdminQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "is_admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

export const adminTasksQuery = () =>
  queryOptions({
    queryKey: ["admin", "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const adminWithdrawalsQuery = (status?: "pending" | "approved" | "rejected") =>
  queryOptions({
    queryKey: ["admin", "withdrawals", status ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      let profiles: Record<string, { telegram_id: number | null; username: string | null; first_name: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,telegram_id,username,first_name")
          .in("id", ids);
        for (const p of profs ?? []) {
          profiles[p.id] = { telegram_id: p.telegram_id, username: p.username, first_name: p.first_name };
        }
      }
      return rows.map((r) => ({ ...r, profile: profiles[r.user_id] ?? null }));
    },
  });

export const adminAnnouncementsQuery = () =>
  queryOptions({
    queryKey: ["admin", "announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const adminRewardCodesQuery = () =>
  queryOptions({
    queryKey: ["admin", "reward_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_codes")
        .select("*, claims:reward_code_claims!reward_code_claims_code_id_fkey(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const adminUsersQuery = (search?: string) =>
  queryOptions({
    queryKey: ["admin", "users", search ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("id,telegram_id,username,first_name,balance,total_earned,banned,suspended,suspend_reason,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search && search.trim()) {
        const s = search.trim();
        if (/^\d+$/.test(s)) q = q.eq("telegram_id", Number(s));
        else q = q.ilike("username", `%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const adminAllSettingsQuery = () =>
  queryOptions({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value,updated_at").order("key");
      if (error) throw error;
      return data;
    },
  });
