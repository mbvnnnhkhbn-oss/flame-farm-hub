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

export const Route = createFileRoute("/app/earn")({
  component: EarnPage,
});

function EarnPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery());
  const adsToday = useQuery({ ...adsTodayQuery(userId), enabled: !!userId });

  const claimFn = useServerFn(claimAdReward);
  const claimMut = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (res) => {
      haptic("heavy");
      toast.success(`+${formatFlames(res.reward)} Flames — thanks for watching!`);
      qc.invalidateQueries({ queryKey: ["ads_today", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cfg = settings.data?.ads;
  const watched = adsToday.data?.length ?? 0;
  const limit = cfg?.daily_limit ?? 30;
  const reward = cfg?.reward_per_ad ?? 500;
  const progress = Math.min(100, (watched / limit) * 100);

  const blockId = (cfg as { block_id?: string } | undefined)?.block_id ?? "";

  async function handleWatchAd() {
    if (blockId) {
      try {
        const { showAd } = await import("@/lib/adsgram");
        toast.loading("Loading ad…", { id: "ad" });
        const result = await showAd(blockId);
        toast.dismiss("ad");
        if (!result.done || result.error) {
          toast.error("Ad not completed");
          return;
        }
      } catch (e) {
        toast.dismiss("ad");
        toast.error(e instanceof Error ? e.message : "Ad failed to load");
        return;
      }
    } else {
      // No AdsGram configured yet — dev simulation
      toast.loading("Loading ad…", { id: "ad" });
      await new Promise((r) => setTimeout(r, 1200));
      toast.dismiss("ad");
    }
    claimMut.mutate();
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
          <PlayCircle className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Watch & Earn</h1>
          <p className="text-xs text-muted-foreground">Watch a short ad to earn Flames</p>
        </div>
      </header>

      <div className="rounded-3xl bg-gradient-card border border-primary/20 p-6 text-center shadow-flame">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-flame shadow-flame animate-flame">
          <PlayCircle className="h-12 w-12 text-primary-foreground" />
        </div>
        <div className="mt-4 text-3xl font-black text-gradient-gold">
          +{formatFlames(reward)}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">per ad</div>

        <button
          disabled={claimMut.isPending || watched >= limit}
          onClick={handleWatchAd}
          className="mt-6 w-full rounded-2xl bg-gradient-flame py-4 text-sm font-bold text-primary-foreground shadow-flame disabled:opacity-40"
        >
          {claimMut.isPending ? "Verifying…" : watched >= limit ? "Daily limit reached" : "Watch Ad Now"}
        </button>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" /> Cooldown {cfg?.cooldown_seconds ?? 30}s
          </span>
          <span>
            {watched} / {limit} today
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/40">
          <div className="h-full bg-gradient-flame" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today's Ads
        </h2>
        <div className="space-y-1.5">
          {(adsToday.data ?? []).slice(0, 8).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl bg-card/40 border border-border/40 px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Flame className="h-3 w-3 text-primary" />
                {new Date(a.watched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="font-bold text-gradient-gold">+{formatFlames(a.reward)}</span>
            </div>
          ))}
          {(adsToday.data ?? []).length === 0 && (
            <div className="rounded-xl bg-card/40 border border-border/40 p-4 text-center text-xs text-muted-foreground">
              No ads watched yet today
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
