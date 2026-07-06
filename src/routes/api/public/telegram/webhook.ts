import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function deriveTelegramWebhookSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number; first_name?: string };
  };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Bot token not configured", { status: 500 });

        const expectedSecret = deriveTelegramWebhookSecret(token);
        const actualSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(actualSecret, expectedSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as TelegramUpdate;
        const message = update.message;
        const chatId = message?.chat?.id;
        const text = message?.text ?? "";
        if (!chatId || !text.startsWith("/start")) return Response.json({ ok: true, ignored: true });

        const { sendTelegramMessage } = await import("@/lib/telegram-bot.server");
        await sendTelegramMessage(
          chatId,
          `🔥 <b>Welcome to CoinFlames</b>\n\nEarn Flames from ads, daily rewards, tasks and referrals. Join the community and open the mini app to start earning.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Open Mini App", url: "https://t.me/Coinflamesbot/coinflames" }],
                [
                  { text: "Community", url: "https://t.me/CoinFlames" },
                  { text: "Payments", url: "https://t.me/coinflamespayment" },
                ],
              ],
            },
          },
        );
        return Response.json({ ok: true });
      },
    },
  },
});