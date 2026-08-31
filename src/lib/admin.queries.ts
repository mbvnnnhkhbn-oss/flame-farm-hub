import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListTasks,
  adminListWithdrawals,
  adminListRewardCodes,
} from "@/lib/admin.data.functions";

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
    queryFn: () => adminListTasks(),
  });

export const adminWithdrawalsQuery = (status?: "pending" | "approved" | "rejected") =>
  queryOptions({
    queryKey: ["admin", "withdrawals", status ?? "all"],
    queryFn: () => adminListWithdrawals({ data: status ? { status } : {} }),
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
    queryFn: () => adminListRewardCodes(),
  });

export const adminUsersQuery = (search?: string, sort: "balance" | "earned" | "recent" = "balance") =>
  queryOptions({
    queryKey: ["admin", "users", search ?? "", sort],
    queryFn: () => adminListUsers({ data: { search: search ?? undefined, sort } }),
  });

export const adminUserActivityQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "user_activity", userId],
    queryFn: () => adminUserActivity({ data: { userId } }),
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
