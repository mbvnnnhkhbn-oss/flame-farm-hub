import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./use-current-user";

export function useIsAdmin(): boolean {
  const userId = useCurrentUserId();
  const q = useQuery({
    queryKey: ["is_admin", userId ?? ""],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
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
  return !!q.data;
}
