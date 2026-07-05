import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, PlayCircle, Users, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { settingsQuery } from "@/lib/queries";
import { showInterstitialSilently } from "@/lib/adsgram";

const tabs: { to: string; label: string; icon: typeof Home; exact?: boolean; showAdOnTap?: boolean }[] = [
  { to: "/app", label: "Home", icon: Home, exact: true, showAdOnTap: true },
  { to: "/app/tasks", label: "Tasks", icon: ListChecks },
  { to: "/app/earn", label: "Earn", icon: PlayCircle },
  { to: "/app/referral", label: "Invite", icon: Users },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settings = useQuery(settingsQuery());
  const intBlock = settings.data?.ads?.block_id_interstitial;

  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto max-w-lg px-4 pt-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-lg grid grid-cols-5">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to as never}
                onClick={() => {
                  if (t.showAdOnTap) {
                    void showInterstitialSilently(intBlock);
                  }
                }}
                className="flex flex-col items-center gap-1 py-3 text-xs transition-colors"
              >
                <span
                  className={
                    active
                      ? "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-flame shadow-flame"
                      : "flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground"
                  }
                >
                  <Icon className={active ? "h-5 w-5 text-primary-foreground" : "h-5 w-5"} />
                </span>
                <span
                  className={
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  }
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
