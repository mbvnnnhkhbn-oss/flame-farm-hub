// Server-only Telegram Bot API helper.
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: {
    parse_mode?: "HTML" | "MarkdownV2";
    disable_web_page_preview?: boolean;
    reply_markup?: unknown;
  } = {},
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
        ...(opts.reply_markup ? { reply_markup: opts.reply_markup } : {}),
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

export async function sendUserBotMessage(
  userId: string,
  text: string,
  opts: Parameters<typeof sendTelegramMessage>[2] = {},
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.telegram_id) return;
    await sendTelegramMessage(profile.telegram_id, text, opts);
  } catch (e) {
    console.error("[telegram-bot] sendUserBotMessage error", e);
  }
}

export async function postToConfiguredChannel(
  settingField: "community_chat_id" | "payment_channel_chat_id",
  text: string,
  opts: Parameters<typeof sendTelegramMessage>[2] = {},
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("settings")
      .select("value")
      .eq("key", "app")
      .maybeSingle();
    const app = data?.value as Record<string, string | number | undefined> | null;
    const chatId = app?.[settingField];
    if (!chatId) return;
    await sendTelegramMessage(chatId, text, opts);
  } catch (e) {
    console.error("[telegram-bot] postToConfiguredChannel error", e);
  }
}

export async function checkTelegramMembership(
  chatId: string,
  telegramUserId: number | string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !telegramUserId) return true;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: telegramUserId }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      result?: { status?: string };
      description?: string;
    };
    if (!res.ok || !body.ok) {
      console.warn("[telegram-bot] getChatMember failed", body.description ?? res.status);
      return false;
    }
    return !["left", "kicked"].includes(body.result?.status ?? "left");
  } catch (e) {
    console.error("[telegram-bot] getChatMember error", e);
    return false;
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
