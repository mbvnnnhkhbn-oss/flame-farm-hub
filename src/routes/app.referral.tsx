import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Copy, Gift, TrendingUp } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { profileQuery, referralsQuery, settingsQuery } from "@/lib/queries";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/app/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const userId = useCurrentUserId() ?? "";
  const profile = useQuery({ ...profileQuery(userId), enabled: !!userId });
  const referrals = useQuery({ ...referralsQuery(userId), enabled: !!userId });
  const settings = useQuery(settingsQuery());

  const botUsername = settings.data?.app.bot_username ?? "CoinFlamesBot";
  const inviteBonus = settings.data?.referral.invite_bonus ?? 1000;
  const link = profile.data
    ? `https://t.me/${botUsername}/app?startapp=${profile.data.telegram_id}`
    : "";

  const totalReferrals = referrals.data?.length ?? 0;
  const paidReferrals = referrals.data?.filter((r) => r.bonus_paid).length ?? 0;
  const earned = (referrals.data ?? [])
    .filter((r) => r.bonus_paid)
    .reduce((s, r) => s + Number(r.bonus_amount ?? 0), 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      haptic("light");
      toast.success("Referral link copied!");
    } catch {
      toast.error("Copy failed");
    }
  }

  function share() {
    const text = `🔥 Join CoinFlames and earn Flames — I'll get a bonus when you complete your first task!\n\n${link}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
          <Users className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Invite Friends</h1>
          <p className="text-xs text-muted-foreground">
            Earn {formatFlames(inviteBonus)} Flames per friend
          </p>
        </div>
      </header>

      <div className="rounded-3xl bg-gradient-card border border-primary/20 p-5 shadow-flame">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Invited" value={totalReferrals} />
          <Stat label="Active" value={paidReferrals} />
          <Stat label="Earned" value={formatFlames(earned)} />
        </div>

        <div className="mt-5 rounded-2xl bg-secondary/40 p-3">
          <div className="text-[10px] uppercase text-muted-foreground">Your link</div>
          <div className="mt-1 truncate text-xs font-mono">{link || "—"}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={copy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-secondary/40 py-3 text-sm font-semibold"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-flame py-3 text-sm font-bold text-primary-foreground shadow-flame"
          >
            <Users className="h-4 w-4" /> Share
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">How it works</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>1. Share your link with friends</li>
          <li>2. They open CoinFlames from your link</li>
          <li>3. When they complete their first task, you both earn</li>
        </ul>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Referrals
        </h2>
        <div className="space-y-1.5">
          {(referrals.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
              No referrals yet — share your link!
            </div>
          ) : (
            referrals.data?.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-xs"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                <span
                  className={
                    r.bonus_paid
                      ? "rounded-full bg-success/20 px-2 py-0.5 font-bold text-success"
                      : "rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground"
                  }
                >
                  {r.bonus_paid ? `+${formatFlames(r.bonus_amount)}` : "Pending"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-lg font-black text-gradient-gold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
