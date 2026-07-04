// Server-only Telegram Bot API helper.
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: { parse_mode?: "HTML" | "MarkdownV2"; disable_web_page_preview?: boolean } = {},
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN not set; skipping send");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parse_mode ?? "HTML",
        disable_web_page_preview: opts.disable_web_page_preview ?? true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram-bot] sendMessage failed ${res.status}: ${body}`);
    }
  } catch (e) {
    console.error("[telegram-bot] sendMessage error", e);
  }
}

// Look up the admin chat id from settings and send a Telegram message to that admin.
export async function notifyAdmin(text: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "app")
      .maybeSingle();
    const chatId = (data?.value as { admin_chat_id?: string | number } | null)?.admin_chat_id;
    if (!chatId) {
      console.warn("[telegram-bot] no admin_chat_id set");
      return;
    }
    await sendTelegramMessage(chatId, text);
  } catch (e) {
    console.error("[telegram-bot] notifyAdmin error", e);
  }
}
