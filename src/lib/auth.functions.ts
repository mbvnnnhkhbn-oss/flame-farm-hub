import { createServerFn } from "@tanstack/react-start";
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

/**
 * Verifies Telegram initData, creates the auth user + profile if needed,
 * and returns deterministic credentials the client uses to sign in.
 */
export const telegramSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyInitData, deriveCredentials } = await import("./telegram-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const result = verifyInitData(data.initData, data.devUser);
    const tgUser = result.user;
    const startParam = data.startParam ?? result.startParam;

    const { email, password } = deriveCredentials(tgUser.id);

    // Look up existing profile by telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      // Create auth user
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

      // Resolve referrer from start_param (referrer telegram_id)
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

      // Insert profile
      const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        telegram_id: tgUser.id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
        photo_url: tgUser.photo_url ?? null,
        language_code: tgUser.language_code ?? null,
        is_premium: tgUser.is_premium ?? false,
        referred_by: referrerProfileId,
      });
      if (profileErr) {
        throw new Error(`Failed to create profile: ${profileErr.message}`);
      }

      // Insert referral row + pending bonus (paid on first task completion)
      if (referrerProfileId) {
        const { data: refSettings } = await supabaseAdmin
          .from("settings")
          .select("value")
          .eq("key", "referral")
          .maybeSingle();
        const bonus =
          (refSettings?.value as { invite_bonus?: number } | null)?.invite_bonus ?? 1000;
        await supabaseAdmin.from("referrals").insert({
          referrer_id: referrerProfileId,
          referred_id: userId,
          bonus_amount: bonus,
        });
      }
    } else {
      // Refresh a few profile fields
      await supabaseAdmin
        .from("profiles")
        .update({
          username: tgUser.username ?? null,
          first_name: tgUser.first_name ?? null,
          last_name: tgUser.last_name ?? null,
          photo_url: tgUser.photo_url ?? null,
          language_code: tgUser.language_code ?? null,
          is_premium: tgUser.is_premium ?? false,
        })
        .eq("id", userId);
    }

    return { email, password, verified: result.verified };
  });
