import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, LayoutDashboard, ListChecks, Wallet, Megaphone, Users, Settings2, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { telegramSignIn } from "@/lib/auth.functions";
import { getInitData } from "@/lib/telegram";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { adminIsAdminQuery } from "@/lib/admin.queries";
import { claimBootstrapAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/tasks", label: "Tasks", icon: ListChecks },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/announcements", label: "News", icon: Megaphone },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

const DEV_TG_KEY = "coinflames_admin_dev_tg_id";

function AdminLayout() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsBrowserLogin, setNeedsBrowserLogin] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const loc = useLocation();

  const bootstrapFn = useServerFn(claimBootstrapAdmin);

  async function signInAs(tgId: number, name?: string, username?: string) {
    setSigningIn(true);
    setAuthError(null);
    try {
      const { initData, user, startParam } = getInitData();
      const devUser = user
        ? {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            photo_url: user.photo_url,
          }
        : { id: tgId, first_name: name || "Admin", username: username || `admin_${tgId}` };
      const creds = await telegramSignIn({
        data: { initData, devUser, startParam },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (error) throw error;
      setAuthReady(true);
      setNeedsBrowserLogin(false);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) {
        if (!cancelled) setAuthReady(true);
        return;
      }
      const { initData, user } = getInitData();
      if (initData || user) {
        await signInAs(user?.id ?? 0, user?.first_name, user?.username);
        return;
      }
      // Browser fallback: check saved dev tg_id
      const saved = typeof window !== "undefined" ? localStorage.getItem(DEV_TG_KEY) : null;
      if (saved && /^\d+$/.test(saved)) {
        await signInAs(Number(saved));
        return;
      }
      if (!cancelled) setNeedsBrowserLogin(true);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = useQuery({
    ...adminIsAdminQuery(userId ?? ""),
    enabled: !!userId && authReady,
  });

  async function tryBootstrap() {
    try {
      const res = await bootstrapFn();
      if (res.granted) {
        qc.invalidateQueries({ queryKey: ["admin", "is_admin"] });
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (needsBrowserLogin) return <BrowserLogin onSubmit={signInAs} busy={signingIn} error={authError} />;
  if (!authReady) return <SplashState label={signingIn ? "Signing in…" : "Loading…"} />;
  if (authError) return <SplashState label="Auth failed" sub={authError} bad />;
  if (isAdmin.isLoading) return <SplashState label="Checking access…" />;
  if (!isAdmin.data) return <NotAdmin onClaim={tryBootstrap} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-flame shadow-flame">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-black leading-tight">CoinFlames</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin Panel</div>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            <Link to="/app" className="hover:text-foreground">← Back to app</Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((n) => {
            const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function SplashState({ label, sub, bad }: { label: string; sub?: string; bad?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
        <Flame className="h-8 w-8 text-primary-foreground" />
      </div>
      <div>
        <div className={bad ? "font-semibold text-destructive" : "font-semibold text-foreground"}>{label}</div>
        {sub && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function NotAdmin({ onClaim }: { onClaim: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="max-w-sm space-y-2">
        <div className="text-lg font-bold">Admin access required</div>
        <p className="text-xs text-muted-foreground">
          Your account is not an admin. If this is a fresh install and no admin exists yet,
          you can claim the first admin role now.
        </p>
      </div>
      <button
        onClick={onClaim}
        className="rounded-full bg-gradient-flame px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-flame"
      >
        Claim first-admin role
      </button>
      <Link to="/app" className="text-xs text-muted-foreground hover:text-foreground">
        Back to app
      </Link>
    </div>
  );
}
