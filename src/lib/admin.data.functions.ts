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
