import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pickaxe, Flame, Timer, PlayCircle, Lock } from "lucide-react";

import {
  getMiningState,
  recordMiningAd,
  claimMining,
} from "@/lib/mining.functions";
import { settingsQuery } from "@/lib/queries";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/app/mining")({
  component: MiningPage,
});

function MiningPage() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery());
  const getStateFn = useServerFn(getMiningState);
  const recordAdFn = useServerFn(recordMiningAd);
  const claimFn = useServerFn(claimMining);

  const state = useQuery({
    queryKey: ["mining", "state"],
    queryFn: () => getStateFn(),
    refetchInterval: 30_000,
  });

  const recordMut = useMutation({
    mutationFn: (packageId: string) => recordAdFn({ data: { packageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mining", "state"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const claimMut = useMutation({
    mutationFn: (packageId: string) => claimFn({ data: { packageId } }),
    onSuccess: (res) => {
      haptic("heavy");
      toast.success(`+${formatFlames(res.reward)} Flames claimed!`);
      qc.invalidateQueries({ queryKey: ["mining", "state"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rewardBlock = settings.data?.ads?.block_id_reward;
  const intBlock = settings.data?.ads?.block_id_interstitial;

  async function watchAdFor(packageId: string) {
    const { pickRandomBlockId, showAd } = await import("@/lib/adsgram");
    const blockId = pickRandomBlockId(rewardBlock, intBlock);
    if (blockId) {
      try {
        toast.loading("Loading ad…", { id: "mad" });
        const result = await showAd(blockId);
        toast.dismiss("mad");
        if (!result.done || result.error) {
          toast.error("Ad not completed");
          return;
        }
      } catch (e) {
        toast.dismiss("mad");
        toast.error(e instanceof Error ? e.message : "Ad failed");
        return;
      }
    } else {
      toast.loading("Loading ad…", { id: "mad" });
      await new Promise((r) => setTimeout(r, 1200));
      toast.dismiss("mad");
    }
    recordMut.mutate(packageId);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
          <Pickaxe className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Mining Machines</h1>
          <p className="text-xs text-muted-foreground">Watch ads → claim → 1h cooldown</p>
        </div>
      </header>

      {state.isLoading && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Loading machines…
        </div>
      )}

      <div className="space-y-4">
        {(state.data ?? []).map(({ package: pkg, state: st }) => (
          <MiningCard
            key={pkg.id}
            pkg={pkg}
            st={st}
            busy={recordMut.isPending || claimMut.isPending}
            onWatchAd={() => watchAdFor(pkg.id)}
            onClaim={() => claimMut.mutate(pkg.id)}
          />
        ))}
      </div>
    </div>
  );
}

type Pkg = {
  id: string;
  name: string;
  hourly_reward: number;
  ads_required: number;
  daily_claim_limit: number;
  cooldown_seconds: number;
};

type St = {
  ads_watched: number;
  claims_today: number;
  next_claim_at: string | null;
};

function MiningCard({
  pkg,
  st,
  busy,
  onWatchAd,
  onClaim,
}: {
  pkg: Pkg;
  st: St;
  busy: boolean;
  onWatchAd: () => void;
  onClaim: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const nextAt = st.next_claim_at ? new Date(st.next_claim_at).getTime() : 0;
  const remainingMs = Math.max(0, nextAt - now);
  const cooling = remainingMs > 0;
  const adsDone = st.ads_watched >= pkg.ads_required;
  const dailyMaxed = st.claims_today >= pkg.daily_claim_limit;

  const totalSec = pkg.cooldown_seconds;
  const progress = cooling
    ? Math.max(0, Math.min(100, 100 - (remainingMs / (totalSec * 1000)) * 100))
    : adsDone
      ? 100
      : (st.ads_watched / Math.max(1, pkg.ads_required)) * 100;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-card p-5 shadow-flame">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Machine
          </div>
          <div className="text-xl font-black">{pkg.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {pkg.hourly_reward} Flames/hr · {pkg.ads_required} ads · {pkg.daily_claim_limit}/day
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-gradient-gold">
            +{formatFlames(pkg.hourly_reward)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            per claim
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full bg-gradient-flame transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          {cooling ? (
            <>
              <Timer className="h-3 w-3" /> Ready in {fmt(remainingMs)}
            </>
          ) : dailyMaxed ? (
            <>
              <Lock className="h-3 w-3" /> Daily limit reached
            </>
          ) : adsDone ? (
            <>
              <Flame className="h-3 w-3" /> Ready to claim
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" /> {st.ads_watched}/{pkg.ads_required} ads
            </>
          )}
        </span>
        <span>{st.claims_today}/{pkg.daily_claim_limit} today</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          disabled={busy || cooling || adsDone || dailyMaxed}
          onClick={onWatchAd}
          className="rounded-xl border border-primary/30 bg-primary/10 py-3 text-xs font-bold text-primary disabled:opacity-40"
        >
          Watch Ad
        </button>
        <button
          disabled={busy || cooling || !adsDone || dailyMaxed}
          onClick={onClaim}
          className="rounded-xl bg-gradient-flame py-3 text-xs font-bold text-primary-foreground shadow-flame disabled:opacity-40"
        >
          {cooling ? fmt(remainingMs) : "Claim"}
        </button>
      </div>
    </div>
  );
}

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
