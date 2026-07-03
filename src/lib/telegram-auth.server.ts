// Server-only Telegram initData verification helpers.
import { createHmac } from "crypto";

export type ParsedTelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type VerifyResult = {
  user: ParsedTelegramUser;
  startParam?: string;
  verified: boolean;
};

/**
 * Verifies Telegram Mini App initData string per:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * If TELEGRAM_BOT_TOKEN is not set OR initData is empty, returns dev-mode
 * result parsed from user field only (verified=false). This lets us build
 * the app before a bot token is provisioned.
 */
export function verifyInitData(initData: string, devUser?: ParsedTelegramUser): VerifyResult {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData) {
    if (!devUser) throw new Error("No initData and no dev user provided");
    return { user: devUser, verified: false };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userStr = params.get("user");
  const startParam = params.get("start_param") ?? undefined;

  if (!userStr) throw new Error("initData missing user field");
  const user = JSON.parse(userStr) as ParsedTelegramUser;

  if (!botToken || !hash) {
    // Dev mode — accept without verification but flag it
    return { user, startParam, verified: false };
  }

  // Build data-check-string
  const pairs: string[] = [];
  params.forEach((v, k) => {
    if (k !== "hash") pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) {
    throw new Error("Invalid Telegram initData signature");
  }

  // Check auth_date freshness (24h)
  const authDate = Number(params.get("auth_date") ?? "0");
  if (authDate && Date.now() / 1000 - authDate > 60 * 60 * 24) {
    throw new Error("initData expired");
  }

  return { user, startParam, verified: true };
}

export function deriveCredentials(telegramId: number): { email: string; password: string } {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "coinflames-dev-secret";
  const password = createHmac("sha256", secret).update(`tg:${telegramId}`).digest("hex");
  return {
    email: `tg${telegramId}@coinflames.local`,
    password,
  };
}
