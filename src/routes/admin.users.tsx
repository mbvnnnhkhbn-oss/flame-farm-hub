import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Ban, RotateCcw, Coins, Activity, X } from "lucide-react";
import { adminUsersQuery, adminUserActivityQuery } from "@/lib/admin.queries";
import { setUserBan, adjustBalance, setUserSuspend } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

type SortKey = "balance" | "earned" | "recent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "balance", label: "Top balance" },
  { key: "earned", label: "Top earned" },
  { key: "recent", label: "Newest" },
];

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("balance");
  const [activityId, setActivityId] = useState<string | null>(null);
  const qc = useQueryClient();
  const users = useQuery(adminUsersQuery(search, sort));
  const banFn = useServerFn(setUserBan);
  const adjFn = useServerFn(adjustBalance);
  const suspendFn = useServerFn(setUserSuspend);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const banMut = useMutation({
    mutationFn: (p: { userId: string; banned: boolean }) => banFn({ data: p }),
    onSuccess: () => {
      toast.success("Updated");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const suspendMut = useMutation({
    mutationFn: (p: { userId: string; suspended: boolean; reason?: string | null }) =>
      suspendFn({ data: p }),
    onSuccess: (_r, v) => {
      toast.success(v.suspended ? "User suspended" : "User un-suspended");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const adjMut = useMutation({
    mutationFn: (p: { userId: string; delta: number }) => adjFn({ data: p }),
    onSuccess: () => {
      toast.success("Balance adjusted");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Users</h1>
        <p className="text-xs text-muted-foreground">{users.data?.length ?? 0} shown (max 200)</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by @username or Telegram ID"
          className="w-full rounded-full border border-border/60 bg-background py-2 pl-9 pr-4 text-sm"
        />
      </div>

      <div className="flex gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              sort === s.key
                ? "bg-gradient-flame text-primary-foreground shadow-flame"
                : "border border-border/60 text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-card/60 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3 text-left">#</th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-right">Earned</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u, i) => {
              const isBlocked = u.banned || u.suspended;
              return (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="p-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isBlocked && <Ban className="h-3 w-3 shrink-0 text-destructive" />}
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold">
                          {u.first_name ?? "—"}
                          {isBlocked && (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                              Suspended
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {u.username ? `@${u.username} · ` : ""}TG {u.telegram_id}
                        </div>
                        {u.suspend_reason && (
                          <div className="text-[10px] text-destructive">{u.suspend_reason}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold text-primary tabular-nums">
                    {Number(u.balance).toLocaleString()}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {Number(u.total_earned).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <button
                        onClick={() => setActivityId(u.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-card"
                      >
                        <Activity className="h-3 w-3" /> Activity
                      </button>
                      <button
                        onClick={() => {
                          const raw = prompt("Delta Flames (negative to deduct):", "1000");
                          if (!raw) return;
                          const d = Number(raw);
                          if (!Number.isFinite(d) || d === 0) return;
                          adjMut.mutate({ userId: u.id, delta: Math.round(d) });
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] hover:bg-card"
                      >
                        <Coins className="h-3 w-3" /> Adjust
                      </button>
                      <button
                        onClick={() => {
                          if (u.suspended) {
                            suspendMut.mutate({ userId: u.id, suspended: false });
                            return;
                          }
                          const reason = prompt("Suspend reason (optional):", "Multiple accounts");
                          if (reason === null) return;
                          suspendMut.mutate({ userId: u.id, suspended: true, reason });
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                          u.suspended
                            ? "border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            : "border border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        }`}
                      >
                        {u.suspended ? <RotateCcw className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                        {u.suspended ? "Un-suspend" : "Suspend"}
                      </button>
                      <button
                        onClick={() => banMut.mutate({ userId: u.id, banned: !u.banned })}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                          u.banned
                            ? "border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            : "border border-destructive/40 text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        {u.banned ? "Unban" : "Ban"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(users.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {activityId && <ActivityPanel userId={activityId} onClose={() => setActivityId(null)} />}
    </div>
  );
}

function ActivityPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const q = useQuery(adminUserActivityQuery(userId));
  const d = q.data;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-primary/30 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black">User activity</h2>
          <button onClick={onClose} className="rounded-full border border-border/60 p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {q.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {q.isError && <p className="text-xs text-destructive">Failed to load activity</p>}

        {d && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Balance" value={Number(d.profile?.balance ?? 0).toLocaleString()} />
              <Metric label="Earned" value={Number(d.profile?.total_earned ?? 0).toLocaleString()} />
              <Metric label="Streak" value={String(d.profile?.streak_day ?? 0)} />
            </div>

            <Section title={`Ads (${d.ads.length})`}>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {Object.entries(d.adsByProvider).map(([p, n]) => (
                  <span key={p} className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px]">
                    {p}: {n}
                  </span>
                ))}
              </div>
              {d.ads.slice(0, 10).map((a) => (
                <Row
                  key={a.id}
                  left={`${a.provider ?? "ad"} · ${new Date(a.watched_at).toLocaleString()}`}
                  right={`+${Number(a.reward).toLocaleString()}`}
                />
              ))}
            </Section>

            <Section title={`Tasks (${d.tasks.length})`}>
              {d.tasks.slice(0, 10).map((t) => (
                <Row
                  key={t.id}
                  left={`${t.status} · ${new Date(t.created_at).toLocaleDateString()}`}
                  right={`+${Number(t.reward).toLocaleString()}`}
                />
              ))}
            </Section>

            <Section title={`Mining claims (${d.mining.length})`}>
              {d.mining.slice(0, 10).map((m) => (
                <Row
                  key={m.id}
                  left={new Date(m.created_at).toLocaleString()}
                  right={`+${Number(m.amount).toLocaleString()}`}
                />
              ))}
            </Section>

            <Section title={`Check-ins (${d.checkins.length})`}>
              {d.checkins.slice(0, 10).map((c) => (
                <Row
                  key={c.id}
                  left={`Day ${c.streak_day} · ${c.claimed_date}`}
                  right={`+${Number(c.reward).toLocaleString()}`}
                />
              ))}
            </Section>

            <Section title={`Referrals (${d.referrals.length})`}>
              {d.referrals.slice(0, 10).map((r) => (
                <Row
                  key={r.id}
                  left={`${new Date(r.created_at).toLocaleDateString()} · ${[
                    r.join_paid && "join",
                    r.day1_paid && "d1",
                    r.day2_paid && "d2",
                  ]
                    .filter(Boolean)
                    .join(", ") || "pending"}`}
                  right={`+${Number(r.lifetime_commission ?? 0).toLocaleString()}`}
                />
              ))}
            </Section>

            <Section title={`Withdrawals (${d.withdrawals.length})`}>
              {d.withdrawals.slice(0, 10).map((w) => (
                <Row
                  key={w.id}
                  left={`${w.status} · ${new Date(w.created_at).toLocaleDateString()}`}
                  right={`$${Number(w.net_usdt ?? w.amount_usdt).toFixed(2)}`}
                />
              ))}
            </Section>

            <Section title={`Reward codes (${d.rewardCodes.length})`}>
              {d.rewardCodes.slice(0, 10).map((c) => (
                <Row
                  key={c.id}
                  left={new Date(c.claimed_at).toLocaleDateString()}
                  right={`+${Number(c.reward).toLocaleString()}`}
                />
              ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-2">
      <div className="text-sm font-black text-gradient-gold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-card/50 px-2.5 py-1.5">
      <span className="truncate text-muted-foreground">{left}</span>
      <span className="ml-2 shrink-0 font-bold">{right}</span>
    </div>
  );
}
