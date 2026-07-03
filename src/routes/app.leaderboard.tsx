import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Medal, Award } from "lucide-react";

import { leaderboardQuery } from "@/lib/queries";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { formatFlames } from "@/lib/format";

export const Route = createFileRoute("/app/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const userId = useCurrentUserId();
  const q = useQuery(leaderboardQuery());
  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <Link
          to="/app/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black">Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Top all-time earners</p>
        </div>
      </header>

      {rows.slice(0, 3).length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {rows.slice(0, 3).map((r, i) => {
            const trophies = [
              { icon: Trophy, color: "text-yellow-400", bg: "from-yellow-500/30 to-orange-500/10" },
              { icon: Medal, color: "text-gray-300", bg: "from-gray-400/30 to-gray-500/10" },
              { icon: Award, color: "text-orange-400", bg: "from-orange-500/30 to-red-500/10" },
            ];
            const t = trophies[i];
            const Icon = t.icon;
            return (
              <div
                key={r.id}
                className={`flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-gradient-to-b ${t.bg} p-3 text-center`}
              >
                <Icon className={`h-6 w-6 ${t.color}`} />
                {r.photo_url ? (
                  <img src={r.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-flame" />
                )}
                <div className="truncate text-[10px] font-semibold">
                  {r.first_name ?? r.username ?? "User"}
                </div>
                <div className="text-xs font-bold text-gradient-gold">
                  {formatFlames(r.total_earned)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        {rows.slice(3).map((r, i) => (
          <div
            key={r.id}
            className={
              r.id === userId
                ? "flex items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 px-3 py-2"
                : "flex items-center gap-3 rounded-2xl border border-border/40 bg-card/40 px-3 py-2"
            }
          >
            <div className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 4}</div>
            {r.photo_url ? (
              <img src={r.photo_url} className="h-8 w-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-flame" />
            )}
            <div className="flex-1 truncate text-sm font-medium">
              {r.first_name ?? r.username ?? "User"}
            </div>
            <div className="text-xs font-bold text-gradient-gold">
              {formatFlames(r.total_earned)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
