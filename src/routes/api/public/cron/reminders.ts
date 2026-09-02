import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function deriveCronSecret(token: string): string {
  return createHash("sha256").update(`coinflames-cron:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Sends the rotating reminder DM to every active bot user, plus a
 * "mining ready" nudge for machines whose cooldown has finished.
 *
 * Call a few times per day (e.g. every 4 hours) with:
 *   GET/POST /api/public/cron/reminders?secret=<derived secret>
 * The secret is sha256("coinflames-cron:" + TELEGRAM_BOT_TOKEN) base64url.
 */
async function run(request: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return new Response("Bot token not configured", { status: 500 });

  const url = new URL(request.url);
  const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret") ?? "";
  if (!safeEqual(provided, deriveCronSecret(token))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTelegramMessage } = await import("@/lib/telegram-bot.server");
  const { REMINDER_MESSAGES, appKeyboard } = await import("@/lib/welcome");

  const now = new Date();
  // Rotate the message by UTC 4-hour slot so consecutive runs differ.
  const slot = Math.floor(now.getUTCHours() / 4);
  const msg = REMINDER_MESSAGES[(slot + now.getUTCDate()) % REMINDER_MESSAGES.length]!;
  const keyboard = appKeyboard();

  // Mining-ready nudges first.
  const { data: ready } = await supabaseAdmin
    .from("user_mining")
    .select("id,user_id,next_claim_at,package_id,mining_packages(name,hourly_reward)")
    .lte("next_claim_at", now.toISOString())
    .eq("notified_ready", false)
    .limit(500);

  let miningSent = 0;
  for (const row of ready ?? []) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id,suspended")
      .eq("id", row.user_id)
      .maybeSingle();
    if (prof?.telegram_id && !prof.suspended) {
      const pkg = (row as { mining_packages?: { name?: string; hourly_reward?: number } })
        .mining_packages;
      await sendTelegramMessage(
        prof.telegram_id,
        `⛏ <b>Mining Ready!</b>\n` +
          `━━━━━━━━━━━━━━━\n` +
          `🏭 <b>Machine:</b> ${pkg?.name ?? "Miner"}\n` +
          `🔥 <b>Reward:</b> ${pkg?.hourly_reward ?? 0} Flames\n` +
          `⏱ <b>Cooldown:</b> finished ✅\n` +
          `━━━━━━━━━━━━━━━\n` +
          `Tap below, watch the ad and claim your Flames!`,
        { reply_markup: keyboard },
      );
      miningSent++;
    }
    await supabaseAdmin.from("user_mining").update({ notified_ready: true }).eq("id", row.id);
  }

  // Rotating reminder broadcast.
  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("suspended", false)
    .eq("banned", false)
    .not("telegram_id", "is", null)
    .limit(5000);

  let reminderSent = 0;
  for (const u of users ?? []) {
    if (!u.telegram_id) continue;
    await sendTelegramMessage(
      u.telegram_id,
      `${msg.title}\n━━━━━━━━━━━━━━━\n${msg.body}`,
      { reply_markup: keyboard },
    );
    reminderSent++;
    // Stay inside Telegram's ~30 msg/sec limit.
    if (reminderSent % 25 === 0) await new Promise((r) => setTimeout(r, 1100));
  }

  return Response.json({ ok: true, slot, miningSent, reminderSent });
}

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
