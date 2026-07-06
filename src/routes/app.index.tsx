import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Flame, Gift, Megaphone, TrendingUp, Wallet, Trophy, PlayCircle, ListChecks, Ticket } from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { BalanceCard } from "@/components/BalanceCard";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { profileQuery, settingsQuery, announcementsQuery } from "@/lib/queries";
import { claimDailyCheckin, claimOpenBonus, claimRewardCode } from "@/lib/actions.functions";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

function HomePage() {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId ?? ""), enabled: !!userId });
  const settings = useQuery(settingsQuery());
  const announcements = useQuery(announcementsQuery());

  const checkinFn = useServerFn(claimDailyCheckin);
  const rewardCodeFn = useServerFn(claimRewardCode);
  const [rewardCode, setRewardCode] = useState("");
  const checkinMut = useMutation({
    mutationFn: async () => {
      const res = await checkinFn();
      // After claim, show a random ad from configured blocks (best-effort, non-blocking reward).
      const ads = settings.data?.ads;
      const rewardBlock = ads?.block_id_reward;
      const intBlock = ads?.block_id_interstitial;
      try {
        const { pickRandomBlockId, showAd } = await import("@/lib/adsgram");
        const blockId = pickRandomBlockId(rewardBlock, intBlock);
        if (blockId) await showAd(blockId).catch(() => undefined);
      } catch {
        /* ignore ad errors after checkin */
      }
      return res;
    },
    onSuccess: (res) => {
      haptic("medium");
      toast.success(`+${formatFlames(res.reward)} coins — Day ${res.streak_day} streak!`);
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["checkins", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // Random 2–5 coins reward on every app open (server-side cooldown enforced).
  const openBonusFn = useServerFn(claimOpenBonus);
  const openBonusRan = useRef(false);
  useEffect(() => {
    if (!userId || openBonusRan.current) return;
    openBonusRan.current = true;
    openBonusFn()
      .then((res) => {
        if (res.reward > 0) {
          haptic("light");
          toast.success(`🔥 Welcome back — +${res.reward} coins!`);
          qc.invalidateQueries({ queryKey: ["profile", userId] });
        }
      })
      .catch(() => undefined);
  }, [userId, openBonusFn, qc]);

  const rate = settings.data?.economy.flames_per_usdt ?? 100000;
  const canCheckIn =
    profile.data && profile.data.last_checkin_date !== new Date().toISOString().slice(0, 10);

  const rewardCodeMut = useMutation({
    mutationFn: (code: string) => rewardCodeFn({ data: { code } }),
    onSuccess: (res) => {
      haptic("medium");
      toast.success(`+${formatFlames(res.reward)} Flames claimed!`);
      setRewardCode("");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Invalid code"),
  });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between pt-2">
        <BrandMark size={36} />
        <Link
          to="/app/profile"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 backdrop-blur"
        >
          {profile.data?.photo_url ? (
            <img
              src={profile.data.photo_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-gradient-flame" />
          )}
          <span className="text-xs font-medium">
            {profile.data?.first_name ?? profile.data?.username ?? "User"}
          </span>
        </Link>
      </header>

      <BalanceCard
        balance={Number(profile.data?.balance ?? 0)}
        todayEarned={Number(profile.data?.today_earned ?? 0)}
        totalEarned={Number(profile.data?.total_earned ?? 0)}
        ratePerUsdt={rate}
      />

      <div className="rounded-2xl border border-accent/30 bg-card/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4 text-accent" /> Reward Code
        </div>
        <div className="flex gap-2">
          <input
            value={rewardCode}
            onChange={(e) => setRewardCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            className="min-w-0 flex-1 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 font-mono text-sm outline-none"
          />
          <button
            disabled={rewardCodeMut.isPending || rewardCode.trim().length < 2}
            onClick={() => rewardCodeMut.mutate(rewardCode)}
            className="rounded-xl bg-gradient-gold px-4 py-2 text-xs font-bold text-accent-foreground disabled:opacity-40"
          >
            Claim
          </button>
        </div>
      </div>

      <Link
        to="/app/withdraw"
        className="flex items-center justify-between rounded-2xl bg-gradient-flame px-5 py-4 shadow-flame active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-primary-foreground" />
          <div>
            <div className="text-sm font-bold text-primary-foreground">Withdraw USDT</div>
            <div className="text-xs text-primary-foreground/80">BEP20 network</div>
          </div>
        </div>
        <div className="text-2xl text-primary-foreground">→</div>
      </Link>

      {/* Daily check-in card */}
      <div className="rounded-3xl bg-gradient-card p-5 border border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20">
              <Gift className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="text-sm font-semibold">Daily Check-in</div>
              <div className="text-xs text-muted-foreground">
                Streak day {(profile.data?.streak_day ?? 0) + (canCheckIn ? 1 : 0)} of 7
              </div>
            </div>
          </div>
          <button
            disabled={!canCheckIn || checkinMut.isPending}
            onClick={() => checkinMut.mutate()}
            className="rounded-full bg-gradient-gold px-4 py-2 text-xs font-bold text-accent-foreground disabled:opacity-40 shadow-glow"
          >
            {checkinMut.isPending
              ? "Claiming…"
              : canCheckIn
                ? "Claim"
                : "Come back tomorrow"}
          </button>
        </div>
        <StreakStrip current={profile.data?.streak_day ?? 0} settings={settings.data?.daily_rewards} />
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-3 gap-3">
        <QuickAction to="/app/earn" icon={PlayCircle} label="Watch Ads" tint="from-orange-500/20 to-red-500/10" />
        <QuickAction to="/app/tasks" icon={ListChecks} label="Tasks" tint="from-yellow-500/20 to-orange-500/10" />
        <QuickAction to="/app/leaderboard" icon={Trophy} label="Ranks" tint="from-amber-500/20 to-yellow-500/10" />
      </div>

      {/* Announcements */}
      <section>
        <div className="mb-2 flex items-center gap-2 px-1">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Announcements
          </h2>
        </div>
        <div className="space-y-2">
          {(announcements.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
              No announcements yet. Stay tuned 🔥
            </div>
          ) : (
            announcements.data?.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  {a.pinned && <TrendingUp className="h-3 w-3 text-primary" />}
                  <div className="text-sm font-semibold">{a.title}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.body}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StreakStrip({
  current,
  settings,
}: {
  current: number;
  settings: Record<string, number> | undefined;
}) {
  const rewards = settings ?? { "1": 100, "2": 150, "3": 250, "4": 400, "5": 600, "6": 800, "7": 1000 };
  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => {
        const done = d <= current;
        return (
          <div
            key={d}
            className={
              done
                ? "flex flex-col items-center rounded-xl bg-gradient-flame py-2 text-primary-foreground"
                : "flex flex-col items-center rounded-xl border border-border/60 bg-secondary/30 py-2 text-muted-foreground"
            }
          >
            <Flame className="h-3 w-3" />
            <div className="mt-0.5 text-[10px] font-bold">{rewards[String(d)]}</div>
            <div className="text-[9px] opacity-70">D{d}</div>
          </div>
        );
      })}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  tint,
}: {
  to: string;
  icon: typeof Flame;
  label: string;
  tint: string;
}) {
  return (
    <Link
      to={to as never}
      className={`flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-gradient-to-br ${tint} p-3 active:scale-[0.97] transition-transform`}
    >
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
