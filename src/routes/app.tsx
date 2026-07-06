import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { telegramSignIn } from "@/lib/auth.functions";
import { getInitData } from "@/lib/telegram";
import { AppShell } from "@/components/AppShell";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

type AuthState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "no-telegram" }
  | { status: "error"; message: string };

function AppLayout() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        if (!cancelled) setState({ status: "ready" });
        return;
      }

      const { initData, user, startParam } = getInitData();
      if (!initData && !user) {
        if (!cancelled) setState({ status: "no-telegram" });
        return;
      }

      try {
        const creds = await telegramSignIn({
          data: {
            initData,
            devUser: user
              ? {
                  id: user.id,
                  first_name: user.first_name,
                  last_name: user.last_name,
                  username: user.username,
                  photo_url: user.photo_url,
                  language_code: user.language_code,
                }
              : undefined,
            startParam,
          },
        });
        const { error } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (error) throw error;
        if (!cancelled) setState({ status: "ready" });
      } catch (err) {
        console.error("Telegram sign-in failed", err);
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Sign-in failed",
          });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire an interstitial ad the first time the app opens per session.
  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "ads")
          .maybeSingle();
        if (cancelled) return;
        const cfg = (data?.value ?? {}) as { block_id_interstitial?: string };
        const { showInterstitialSilently } = await import("@/lib/adsgram");
        const delay = 2000 + Math.floor(Math.random() * 3000);
        setTimeout(() => showInterstitialSilently(cfg.block_id_interstitial), delay);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  if (state.status === "loading") return <SplashScreen label="Warming up the flames…" />;
  if (state.status === "no-telegram") return <OpenInTelegramScreen />;
  if (state.status === "error")
    return <SplashScreen label="Sign-in failed" sublabel={state.message} error />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function SplashScreen({
  label,
  sublabel,
  error,
}: {
  label: string;
  sublabel?: string;
  error?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-flame blur-2xl opacity-60 animate-flame" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-flame shadow-flame">
          <Flame className="h-12 w-12 text-primary-foreground" />
        </div>
      </div>
      <div>
        <div
          className={
            error ? "text-lg font-semibold text-destructive" : "text-lg font-semibold text-foreground"
          }
        >
          {label}
        </div>
        {sublabel && <div className="mt-1 text-sm text-muted-foreground">{sublabel}</div>}
      </div>
    </div>
  );
}

function OpenInTelegramScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark size={56} />
      <div className="max-w-sm space-y-3 rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl">
        <AlertCircle className="mx-auto h-8 w-8 text-primary" />
        <h1 className="text-xl font-bold">Open inside Telegram</h1>
        <p className="text-sm text-muted-foreground">
          CoinFlames is a Telegram Mini App. Please open it from the CoinFlames bot inside Telegram
          to sign in and start earning.
        </p>
        <p className="text-xs text-muted-foreground">
          (Dev tip: append <code className="rounded bg-secondary px-1">?tg_id=1234&name=You</code> to
          preview locally.)
        </p>
      </div>
    </div>
  );
}
