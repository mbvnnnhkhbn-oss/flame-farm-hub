import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Copy, Gift, TrendingUp, Sparkles, CheckCircle2, Clock } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { profileQuery, referralsQuery, settingsQuery } from "@/lib/queries";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import { claimReferralCommission } from "@/lib/actions.functions";

export const Route = createFileRoute("/app/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: !!userId });
  const referrals = useQuery({ ...referralsQuery(userId), enabled: !!userId });
  const settings = useQuery(settingsQuery());

  const botUsername = settings.data?.app.bot_username ?? "Coinflamesbot";
  const startAppName = settings.data?.app.start_app_name ?? "coinflames";
  const joinBonus = settings.data?.referral.join_bonus ?? 25;
  const day1Bonus = settings.data?.referral.day1_bonus ?? 50;
  const day2Bonus = settings.data?.referral.day2_bonus ?? 75;
  const commissionPct = settings.data?.referral.commission_pct ?? 5;
  const link = profile.data
    ? `https://t.me/${botUsername}/${startAppName}?startapp=${profile.data.telegram_id}`
    : "";

  const rows = referrals.data ?? [];
  const totalReferrals = rows.length;
  const activeReferrals = rows.filter((r) => r.day1_paid || r.day2_paid).length;
  const totalMilestoneEarned = rows.reduce(
    (s, r) =>
      s +
      (r.join_paid ? Number(r.join_bonus ?? 0) : 0) +
      (r.day1_paid ? Number(r.day1_bonus ?? 0) : 0) +
      (r.day2_paid ? Number(r.day2_bonus ?? 0) : 0),
    0,
  );
  const lifetimeCommission = rows.reduce(
    (s, r) => s + Number(r.lifetime_commission ?? 0),
    0,
  );
  const pendingCommission = rows.reduce(
    (s, r) => s + Number(r.commission_pending ?? 0),
    0,
  );

  const claim = useMutation({
    mutationFn: () => claimReferralCommission(),
    onSuccess: (r) => {
      haptic("medium");
      toast.success(`Claimed ${formatFlames(r.claimed)} Flames`);
      qc.invalidateQueries({ queryKey: ["referrals"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    const text = `🔥 Join CoinFlames and earn Flames — I'll get a bonus when you join!\n\n${link}`;
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
            Up to {formatFlames(joinBonus + day1Bonus + day2Bonus)} + {commissionPct}% lifetime
          </p>
        </div>
      </header>

      <div className="rounded-3xl bg-gradient-card border border-primary/20 p-5 shadow-flame">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Invited" value={totalReferrals} />
          <Stat label="Active" value={activeReferrals} />
          <Stat label="Milestones" value={formatFlames(totalMilestoneEarned)} />
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

      {/* Commission claim card */}
      <div className="rounded-3xl border border-accent/30 bg-gradient-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Lifetime {commissionPct}% Commission</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Pending</div>
            <div className="text-2xl font-black text-gradient-gold tabular-nums">
              {formatFlames(pendingCommission)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Total Earned</div>
            <div className="text-2xl font-black tabular-nums">
              {formatFlames(lifetimeCommission)}
            </div>
          </div>
        </div>
        <button
          disabled={pendingCommission <= 0 || claim.isPending}
          onClick={() => claim.mutate()}
          className="mt-4 w-full rounded-2xl bg-gradient-flame py-3 text-sm font-bold text-primary-foreground shadow-flame disabled:opacity-40"
        >
          {claim.isPending
            ? "Claiming…"
            : pendingCommission > 0
              ? `Claim ${formatFlames(pendingCommission)} Flames`
              : "No commission yet"}
        </button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Rewards breakdown</span>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>• Instant <b className="text-foreground">{formatFlames(joinBonus)}</b> when a friend joins via your link</li>
          <li>• +<b className="text-foreground">{formatFlames(day1Bonus)}</b> when they watch 10 ads on day 1</li>
          <li>• +<b className="text-foreground">{formatFlames(day2Bonus)}</b> when they watch 10 ads on day 2</li>
          <li>• <b className="text-foreground">{commissionPct}%</b> of everything they earn — forever</li>
        </ul>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Referrals
        </h2>
        <div className="space-y-1.5">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
              No referrals yet — share your link!
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border/40 bg-card/40 px-3 py-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    {r.referred?.photo_url ? (
                      <img
                        src={r.referred.photo_url}
                        alt=""
                        loading="lazy"
                        className="h-6 w-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-[10px] font-bold">
                        {(r.referred?.first_name ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground">
                        {r.referred?.username
                          ? `@${r.referred.username}`
                          : (r.referred?.first_name ?? "CoinFlames user")}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </span>
                  <span className="rounded-full bg-success/20 px-2 py-0.5 font-bold text-success">
                    +{formatFlames(
                      (r.join_paid ? r.join_bonus ?? 0 : 0) +
                        (r.day1_paid ? r.day1_bonus ?? 0 : 0) +
                        (r.day2_paid ? r.day2_bonus ?? 0 : 0),
                    )}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Milestone
                    label={`Join +${r.join_bonus ?? joinBonus}`}
                    done={r.join_paid}
                  />
                  <Milestone
                    label={`Day 1 +${r.day1_bonus ?? day1Bonus}`}
                    done={r.day1_paid}
                  />
                  <Milestone
                    label={`Day 2 +${r.day2_bonus ?? day2Bonus}`}
                    done={r.day2_paid}
                  />
                  {Number(r.lifetime_commission ?? 0) > 0 && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                      {commissionPct}% · {formatFlames(r.lifetime_commission)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Milestone({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
        (done
          ? "bg-success/20 text-success"
          : "bg-muted/40 text-muted-foreground")
      }
    >
      {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}
    </span>
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
