import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const inputSchema = z.object({
  initData: z.string(),
  devUser: z
    .object({
      id: z.number(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      photo_url: z.string().optional(),
      language_code: z.string().optional(),
    })
    .optional(),
  startParam: z.string().optional(),
});

function extractIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("fly-client-ip") ||
    null
  );
}

/**
 * Verifies Telegram initData, creates the auth user + profile if needed,
 * and returns deterministic credentials the client uses to sign in.
 */
export const telegramSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyInitData, deriveCredentials } = await import("./telegram-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyAdmin, sendUserBotMessage } = await import("./telegram-bot.server");

    const result = verifyInitData(data.initData, data.devUser);
    const tgUser = result.user;
    const startParam = data.startParam ?? result.startParam;

    const req = getRequest();
    const ip = req ? extractIp(req.headers) : null;

    const { email, password } = deriveCredentials(tgUser.id);

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,suspended")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;
    let newlyCreated = false;
    let autoSuspended = false;

    if (!userId) {
      // Check IP for duplicates (one account per IP)
      let ipDuplicate = false;
      if (ip) {
        const { data: sameIp } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("signup_ip", ip)
          .limit(1)
          .maybeSingle();
        ipDuplicate = !!sameIp;
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
        },
      });
      if (createErr || !created?.user) {
        throw new Error(`Failed to create user: ${createErr?.message ?? "unknown"}`);
      }
      userId = created.user.id;
      newlyCreated = true;
      autoSuspended = ipDuplicate;

      let referrerProfileId: string | null = null;
      if (startParam) {
        const referrerTgId = Number(startParam);
        if (!Number.isNaN(referrerTgId) && referrerTgId !== tgUser.id) {
          const { data: refProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("telegram_id", referrerTgId)
            .maybeSingle();
          if (refProfile) referrerProfileId = refProfile.id;
        }
      }

      const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        telegram_id: tgUser.id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
        photo_url: tgUser.photo_url ?? null,
        language_code: tgUser.language_code ?? null,
        is_premium: tgUser.is_premium ?? false,
        referred_by: ipDuplicate ? null : referrerProfileId,
        signup_ip: ip,
        last_ip: ip,
        suspended: ipDuplicate,
        suspend_reason: ipDuplicate ? "Duplicate account from same IP" : null,
      });
      if (profileErr) {
        throw new Error(`Failed to create profile: ${profileErr.message}`);
      }

      // Referral row + immediate join bonus (only if not auto-suspended)
      if (referrerProfileId && !ipDuplicate) {
        const { data: refSettings } = await supabaseAdmin
          .from("settings")
          .select("value")
          .eq("key", "referral")
          .maybeSingle();
        const cfg = (refSettings?.value as {
          join_bonus?: number;
          day1_bonus?: number;
          day2_bonus?: number;
        } | null) ?? {};
        const joinBonus = Number(cfg.join_bonus ?? 25);
        const day1Bonus = Number(cfg.day1_bonus ?? 50);
        const day2Bonus = Number(cfg.day2_bonus ?? 75);
        const today = new Date().toISOString().slice(0, 10);

        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrerProfileId,
          referred_id: userId,
          bonus_amount: joinBonus,
          join_bonus: joinBonus,
          day1_bonus: day1Bonus,
          day2_bonus: day2Bonus,
          join_paid: true,
          bonus_paid: true,
          referred_joined_date: today,
        });

        // Pay join bonus immediately to referrer
        const { data: refP } = await supabaseAdmin
          .from("profiles")
          .select("balance,total_earned")
          .eq("id", referrerProfileId)
          .single();
        if (refP) {
          await supabaseAdmin
            .from("profiles")
            .update({
              balance: Number(refP.balance) + joinBonus,
              total_earned: Number(refP.total_earned) + joinBonus,
            })
            .eq("id", referrerProfileId);
          await supabaseAdmin.from("notifications").insert({
            user_id: referrerProfileId,
            title: "Referral joined 🎉",
            body: `+${joinBonus} Flames — your invite just joined CoinFlames!`,
          });
          await sendUserBotMessage(
            referrerProfileId,
            `🎉 <b>Referral joined</b>\n+${joinBonus} Flames added to your balance.`,
          );
        }
      }

      // Admin notifications
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || "—";
      const uname = tgUser.username ? `@${tgUser.username}` : "(no username)";
      await notifyAdmin(
        `🆕 <b>New user joined</b>\nName: ${name}\nUser: ${uname}\nTG ID: <code>${tgUser.id}</code>\nIP: <code>${ip ?? "unknown"}</code>`,
      );
      if (ipDuplicate) {
        await notifyAdmin(
          `⛔ <b>Account auto-suspended</b>\nReason: duplicate IP\nTG ID: <code>${tgUser.id}</code>\nIP: <code>${ip ?? "unknown"}</code>`,
        );
      }
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({
          username: tgUser.username ?? null,
          first_name: tgUser.first_name ?? null,
          last_name: tgUser.last_name ?? null,
          photo_url: tgUser.photo_url ?? null,
          language_code: tgUser.language_code ?? null,
          is_premium: tgUser.is_premium ?? false,
          last_ip: ip,
        })
        .eq("id", userId);
    }

    return { email, password, verified: result.verified, newlyCreated, autoSuspended };
  });
