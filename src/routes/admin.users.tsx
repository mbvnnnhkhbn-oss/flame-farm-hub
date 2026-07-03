import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Ban, RotateCcw, Coins } from "lucide-react";
import { adminUsersQuery } from "@/lib/admin.queries";
import { setUserBan, adjustBalance } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const users = useQuery(adminUsersQuery(search));
  const banFn = useServerFn(setUserBan);
  const adjFn = useServerFn(adjustBalance);

  const banMut = useMutation({
    mutationFn: (p: { userId: string; banned: boolean }) => banFn({ data: p }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
  const adjMut = useMutation({
    mutationFn: (p: { userId: string; delta: number }) => adjFn({ data: p }),
    onSuccess: () => {
      toast.success("Balance adjusted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Users</h1>
        <p className="text-xs text-muted-foreground">{users.data?.length ?? 0} shown (max 100)</p>
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
      <div className="overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-card/60 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-right">Balance</th>
              <th className="p-3 text-right">Earned</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border/40">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {u.banned && <Ban className="h-3 w-3 text-destructive" />}
                    <div>
                      <div className="font-semibold">{u.first_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {u.username ? `@${u.username} · ` : ""}TG {u.telegram_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right font-bold text-primary">{Number(u.balance).toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">{Number(u.total_earned).toLocaleString()}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
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
                      onClick={() => banMut.mutate({ userId: u.id, banned: !u.banned })}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                        u.banned
                          ? "border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          : "border border-destructive/40 text-destructive hover:bg-destructive/10"
                      }`}
                    >
                      {u.banned ? <RotateCcw className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                      {u.banned ? "Unban" : "Ban"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(users.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
