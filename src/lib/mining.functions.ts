import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function payReferralCommission(
  userId: string,
  earnedAmount: number,
  settingsCommissionPct: number,
) {
  if (earnedAmount <= 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ref } = await supabaseAdmin
    .from("referrals")
    .select("id,referrer_id,commission_pending")
    .eq("referred_id", userId)
    .maybeSingle();
  if (!ref) return;
  const commission = Math.floor((earnedAmount * settingsCommissionPct) / 100);
  if (commission <= 0) return;
  await supabaseAdmin
    .from("referrals")
    .update({ commission_pending: Number(ref.commission_pending ?? 0) + commission })
    .eq("id", ref.id);
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

  const { data: refCfg } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", "referral")
    .maybeSingle();
  const pct = Number((refCfg?.value as { commission_pct?: number } | null)?.commission_pct ?? 5);
  await payReferralCommission(userId, amount, pct);
}

export const getMiningState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: packages }, { data: states }] = await Promise.all([
      supabaseAdmin
        .from("mining_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      supabaseAdmin.from("user_mining").select("*").eq("user_id", userId),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const stateMap = new Map((states ?? []).map((s) => [s.package_id, s]));

    return (packages ?? []).map((p) => {
      const s = stateMap.get(p.id);
      const sameDay = s?.claims_date === today;
      return {
        package: p,
        state: s
          ? {
              ads_watched: s.ads_watched,
              claims_today: sameDay ? s.claims_today : 0,
              last_claim_at: s.last_claim_at,
              next_claim_at: s.next_claim_at,
            }
          : {
              ads_watched: 0,
              claims_today: 0,
              last_claim_at: null,
              next_claim_at: null,
            },
      };
    });
  });

export const recordMiningAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ packageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);

    const { data: pkg } = await supabaseAdmin
      .from("mining_packages")
      .select("*")
      .eq("id", data.packageId)
      .eq("active", true)
      .maybeSingle();
    if (!pkg) throw new Error("Package unavailable");

    const { data: existing } = await supabaseAdmin
      .from("user_mining")
      .select("*")
      .eq("user_id", userId)
      .eq("package_id", data.packageId)
      .maybeSingle();

    // Guard: cooldown
    if (existing?.next_claim_at && new Date(existing.next_claim_at) > new Date()) {
      throw new Error("Wait for cooldown to finish");
    }

    // Guard: daily limit
    const sameDay = existing?.claims_date === today;
    const claimsToday = sameDay ? existing?.claims_today ?? 0 : 0;
    if (claimsToday >= pkg.daily_claim_limit) {
      throw new Error("Daily claim limit reached for this machine");
    }

    if (!existing) {
      await supabaseAdmin.from("user_mining").insert({
        user_id: userId,
        package_id: data.packageId,
        ads_watched: 1,
        claims_date: today,
      });
    } else {
      const newAds = Math.min(pkg.ads_required, (existing.ads_watched ?? 0) + 1);
      await supabaseAdmin
        .from("user_mining")
        .update({
          ads_watched: newAds,
          claims_date: today,
          claims_today: sameDay ? existing.claims_today : 0,
        })
        .eq("id", existing.id);
    }
    return { ok: true };
  });

export const claimMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ packageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendUserBotMessage } = await import("./telegram-bot.server");
    const userId = context.userId;
    const today = new Date().toISOString().slice(0, 10);

    const { data: pkg } = await supabaseAdmin
      .from("mining_packages")
      .select("*")
      .eq("id", data.packageId)
      .eq("active", true)
      .maybeSingle();
    if (!pkg) throw new Error("Package unavailable");

    const { data: existing } = await supabaseAdmin
      .from("user_mining")
      .select("*")
      .eq("user_id", userId)
      .eq("package_id", data.packageId)
      .maybeSingle();
    if (!existing) throw new Error("Watch the required ads first");

    if (existing.next_claim_at && new Date(existing.next_claim_at) > new Date()) {
      throw new Error("Wait for the countdown to finish");
    }

    if ((existing.ads_watched ?? 0) < pkg.ads_required) {
      throw new Error(`Watch ${pkg.ads_required} ads before claiming`);
    }

    const sameDay = existing.claims_date === today;
    const claimsToday = sameDay ? existing.claims_today ?? 0 : 0;
    if (claimsToday >= pkg.daily_claim_limit) {
      throw new Error("Daily claim limit reached for this machine");
    }

    const now = new Date();
    const next = new Date(now.getTime() + pkg.cooldown_seconds * 1000);

    await supabaseAdmin
      .from("user_mining")
      .update({
        ads_watched: 0,
        last_claim_at: now.toISOString(),
        next_claim_at: next.toISOString(),
        claims_today: claimsToday + 1,
        claims_date: today,
        notified_ready: false,
      })
      .eq("id", existing.id);

    await supabaseAdmin.from("mining_claims").insert({
      user_id: userId,
      package_id: pkg.id,
      amount: pkg.hourly_reward,
    });

    await addBalance(userId, pkg.hourly_reward);

    await sendUserBotMessage(
      userId,
      `⛏️ <b>${pkg.name} mining claimed</b>\n+${pkg.hourly_reward} 🔥 Flames added to your balance.\n⏱ Next claim in 1 hour.`,
    );

    return {
      reward: pkg.hourly_reward,
      next_claim_at: next.toISOString(),
      claims_today: claimsToday + 1,
    };
  });

// ---------- Admin CRUD ----------
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

const packageInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  hourly_reward: z.number().int().positive(),
  ads_required: z.number().int().min(0).max(20),
  daily_claim_limit: z.number().int().positive().max(48),
  cooldown_seconds: z.number().int().positive().default(3600),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const upsertMiningPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => packageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("mining_packages")
        .update(data)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("mining_packages")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteMiningPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("mining_packages")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListMiningPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("mining_packages")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
