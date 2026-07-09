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

        const { sendTelegramPhoto, sendTelegramMessage } = await import("@/lib/telegram-bot.server");
        const { WELCOME_PHOTO_URL, welcomeCaption, welcomeKeyboard } = await import("@/lib/welcome");
        const caption = welcomeCaption(message?.from?.first_name);
        const kb = welcomeKeyboard();
        try {
          await sendTelegramPhoto(chatId, WELCOME_PHOTO_URL, caption, { reply_markup: kb });
        } catch {
          await sendTelegramMessage(chatId, caption, { reply_markup: kb });
        }
        return Response.json({ ok: true });
      },
    },
  },
});