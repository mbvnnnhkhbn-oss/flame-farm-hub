import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PlayCircle, Flame, Timer } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { adsTodayQuery, settingsQuery } from "@/lib/queries";
import { claimAdReward } from "@/lib/actions.functions";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import adRewardIcon from "@/assets/ad-reward.png";
import adIntIcon from "@/assets/ad-interstitial.png";

export const Route = createFileRoute("/app/earn")({
  component: EarnPage,
});

type AdKind = "reward" | "interstitial";

function EarnPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery());
  const adsToday = useQuery({ ...adsTodayQuery(userId), enabled: !!userId });

  const claimFn = useServerFn(claimAdReward);
  const claimMut = useMutation({
    mutationFn: (p: { blockId: string | null; kind: AdKind; watchedSeconds: number }) =>
      claimFn({
        data: { blockId: p.blockId ?? undefined, kind: p.kind, watchedSeconds: p.watchedSeconds },
      }),
    onSuccess: (res) => {
      haptic("heavy");
      toast.success(`+${formatFlames(res.reward)} coins — thanks for watching!`);
      qc.invalidateQueries({ queryKey: ["ads_today", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cfg = settings.data?.ads;
  const rows = (adsToday.data ?? []).filter(
    (a) => (a.provider ?? "adsgram") === "adsgram" || a.provider === "adsgram_int",
  );
  const rewardWatched = rows.filter((a) => (a.provider ?? "adsgram") === "adsgram").length;
  const intWatched = rows.filter((a) => a.provider === "adsgram_int").length;

  const rewardLimit = cfg?.daily_limit ?? 10;
  const intLimit = cfg?.interstitial_daily_limit ?? 10;
  const rewardValue = cfg?.reward_per_ad ?? 5;
  const intValue = cfg?.reward_per_interstitial ?? 5;
  const minWatch = Number(cfg?.watch_seconds ?? 10);

  async function watchAd(kind: AdKind) {
    const { normalizeRewardBlockId, normalizeInterstitialBlockId, showAdTimed } = await import(
      "@/lib/adsgram"
    );
    const blockId =
      kind === "reward"
        ? normalizeRewardBlockId(cfg?.block_id_reward)
        : normalizeInterstitialBlockId(cfg?.block_id_interstitial);

    let seconds = minWatch;
    if (blockId) {
      try {
        toast.loading("Loading ad…", { id: "ad" });
        const res = await showAdTimed(blockId, minWatch);
        seconds = res.seconds;
        toast.dismiss("ad");
      } catch (e) {
        toast.dismiss("ad");
        toast.error(e instanceof Error ? e.message : "Ad failed to load");
        return;
      }
    } else {
      toast.loading("Loading ad…", { id: "ad" });
      await new Promise((r) => setTimeout(r, minWatch * 1000));
      toast.dismiss("ad");
    }
    claimMut.mutate({ blockId, kind, watchedSeconds: seconds });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
          <PlayCircle className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Watch &amp; Earn</h1>
          <p className="text-xs text-muted-foreground">
            Each ad must play for at least {minWatch}s to earn
          </p>
        </div>
      </header>

      <AdCard
        icon={adRewardIcon}
        title="AdsGram Reward"
        subtitle="Rewarded video ads"
        reward={rewardValue}
        watched={rewardWatched}
        limit={rewardLimit}
        minWatch={minWatch}
        pending={claimMut.isPending}
        onWatch={() => watchAd("reward")}
      />

      <AdCard
        icon={adIntIcon}
        title="AdsGram Int"
        subtitle="Interstitial ads"
        reward={intValue}
        watched={intWatched}
        limit={intLimit}
        minWatch={minWatch}
        pending={claimMut.isPending}
        onWatch={() => watchAd("interstitial")}
      />

      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Ads
        </h2>
        <div className="space-y-1.5">
          {rows.slice(0, 10).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl bg-card/40 border border-border/40 px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Flame className="h-3 w-3 text-primary" />
                {new Date(a.watched_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px]">
                  {a.provider === "adsgram_int" ? "Int" : "Reward"}
                </span>
              </span>
              <span className="font-bold text-gradient-gold">+{formatFlames(a.reward)}</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="rounded-xl bg-card/40 border border-border/40 p-4 text-center text-xs text-muted-foreground">
              No ads watched yet today
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdCard({
  icon,
  title,
  subtitle,
  reward,
  watched,
  limit,
  minWatch,
  pending,
  onWatch,
}: {
  icon: string;
  title: string;
  subtitle: string;
  reward: number;
  watched: number;
  limit: number;
  minWatch: number;
  pending: boolean;
  onWatch: () => void;
}) {
  const progress = Math.min(100, (watched / limit) * 100);
  const done = watched >= limit;
  return (
    <div className="rounded-3xl bg-gradient-card border border-primary/20 p-5 shadow-flame">
      <div className="flex items-center gap-3">
        <img
          src={icon}
          alt={`${title} logo`}
          loading="lazy"
          width={512}
          height={512}
          className="h-14 w-14 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <div className="text-base font-black">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-gradient-gold">+{formatFlames(reward)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">per ad</div>
        </div>
      </div>

      <button
        disabled={pending || done}
        onClick={onWatch}
        className="mt-4 w-full rounded-2xl bg-gradient-flame py-3.5 text-sm font-bold text-primary-foreground shadow-flame disabled:opacity-40"
      >
        {pending ? "Verifying…" : done ? "Daily limit reached" : "Watch Ad Now"}
      </button>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" /> Min watch {minWatch}s
        </span>
        <span>
          {watched} / {limit} today
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/40">
        <div className="h-full bg-gradient-flame" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
