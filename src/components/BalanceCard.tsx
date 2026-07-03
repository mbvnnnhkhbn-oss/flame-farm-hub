import { Flame } from "lucide-react";
import { formatFlames, flamesToUsdt, formatUsdt } from "@/lib/format";

export function BalanceCard({
  balance,
  todayEarned,
  totalEarned,
  ratePerUsdt,
}: {
  balance: number;
  todayEarned: number;
  totalEarned: number;
  ratePerUsdt: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-card p-5 shadow-flame border border-primary/20">
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-flame opacity-30 blur-3xl" />
      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Your Balance</div>
        <div className="mt-2 flex items-baseline gap-2">
          <Flame className="h-7 w-7 text-primary animate-flame" />
          <span className="text-4xl font-black text-gradient-gold tabular-nums">
            {formatFlames(balance)}
          </span>
          <span className="text-sm font-medium text-muted-foreground">Flames</span>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          ≈ {formatUsdt(flamesToUsdt(balance, ratePerUsdt))} USDT
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary/40 p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Today</div>
            <div className="mt-1 text-lg font-bold text-foreground tabular-nums">
              +{formatFlames(todayEarned)}
            </div>
          </div>
          <div className="rounded-2xl bg-secondary/40 p-3">
            <div className="text-[10px] uppercase text-muted-foreground">Total earned</div>
            <div className="mt-1 text-lg font-bold text-foreground tabular-nums">
              {formatFlames(totalEarned)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
