import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { User, ExternalLink, History, Trophy, Wallet, LogOut } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { profileQuery, settingsQuery } from "@/lib/queries";
import { formatFlames, shortAddress } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const userId = useCurrentUserId() ?? "";
  const profile = useQuery({ ...profileQuery(userId), enabled: !!userId });
  const settings = useQuery(settingsQuery());

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="text-2xl font-black">Profile</h1>
      </header>

      <div className="rounded-3xl bg-gradient-card border border-primary/20 p-5 shadow-flame">
        <div className="flex items-center gap-4">
          {profile.data?.photo_url ? (
            <img src={profile.data.photo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
              <User className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">
              {profile.data?.first_name} {profile.data?.last_name}
            </div>
            {profile.data?.username && (
              <div className="text-xs text-muted-foreground">@{profile.data.username}</div>
            )}
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              TG ID: {profile.data?.telegram_id}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Total Earned" value={`${formatFlames(profile.data?.total_earned ?? 0)}`} />
          <Metric label="Balance" value={`${formatFlames(profile.data?.balance ?? 0)}`} />
          <Metric
            label="Joined"
            value={profile.data ? new Date(profile.data.created_at).toLocaleDateString() : "—"}
          />
          <Metric
            label="Wallet"
            value={profile.data?.wallet_address ? shortAddress(profile.data.wallet_address) : "Not set"}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <ProfileLink to="/app/withdraw" icon={Wallet} label="Withdraw" />
        <ProfileLink to="/app/history" icon={History} label="Activity History" />
        <ProfileLink to="/app/leaderboard" icon={Trophy} label="Leaderboard" />
        {settings.data?.app.support_url && (
          <a
            href={settings.data.app.support_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Support</span>
            </div>
          </a>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center justify-between rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
        >
          <div className="flex items-center gap-3">
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Sign out</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function ProfileLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof User;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-muted-foreground">→</span>
    </Link>
  );
}
