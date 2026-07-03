// Telegram WebApp SDK helpers (client-only)
export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
};

type TelegramWebApp = {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred: (type: "success" | "warning" | "error") => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): { initData: string; user: TelegramUser | null; startParam?: string } {
  const tg = getTelegramWebApp();
  if (tg && tg.initData) {
    return {
      initData: tg.initData,
      user: tg.initDataUnsafe?.user ?? null,
      startParam: tg.initDataUnsafe?.start_param,
    };
  }
  // Dev fallback: allow ?tg_id=... in URL for testing outside Telegram
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const devId = url.searchParams.get("tg_id");
    if (devId) {
      return {
        initData: "",
        user: {
          id: Number(devId),
          first_name: url.searchParams.get("name") ?? "Dev User",
          username: url.searchParams.get("username") ?? `dev_${devId}`,
        },
        startParam: url.searchParams.get("start") ?? undefined,
      };
    }
  }
  return { initData: "", user: null };
}

export function haptic(kind: "light" | "medium" | "heavy" = "light") {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(kind);
}
