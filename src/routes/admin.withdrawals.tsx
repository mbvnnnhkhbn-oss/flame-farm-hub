import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Copy } from "lucide-react";
import { adminWithdrawalsQuery } from "@/lib/admin.queries";
import { decideWithdrawal } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/withdrawals")({
  component: AdminWithdrawals,
});

const TABS = ["pending", "approved", "rejected"] as const;
type Tab = typeof TABS[number];

function AdminWithdrawals() {
  const [tab, setTab] = useState<Tab>("pending");
  const qc = useQueryClient();
  const wds = useQuery(adminWithdrawalsQuery(tab));
  const fn = useServerFn(decideWithdrawal);

  const decideMut = useMutation({
    mutationFn: (p: { id: string; decision: "approved" | "rejected"; tx_hash?: string; admin_note?: string }) =>
      fn({ data: p }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function copy(s: string) {
    navigator.clipboard?.writeText(s);
    toast.success("Copied");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Withdrawals</h1>
        <p className="text-xs text-muted-foreground">Approve payouts and refund rejected requests</p>
      </div>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {(wds.data ?? []).map((w) => {
          const profile = w.profile as { telegram_id?: number; username?: string; first_name?: string } | null;
          return (
            <div key={w.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-lg font-black">${Number(w.net_usdt ?? w.amount_usdt).toFixed(4)} USDT</div>
                  <div className="text-[11px] text-muted-foreground">
                    Gross ${Number(w.amount_usdt).toFixed(4)} · Fee ${Number(w.fee_usdt ?? 0).toFixed(4)} · {w.network}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">
                    {profile?.first_name ?? "—"}{" "}
                    {profile?.username ? <span className="text-muted-foreground">@{profile.username}</span> : null}
                  </div>
                  <div className="text-[10px] text-muted-foreground">TG {profile?.telegram_id ?? "?"}</div>
                </div>
              </div>
              <button
                onClick={() => copy(w.wallet_address)}
                className="mt-2 inline-flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left font-mono text-[11px]"
              >
                <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{w.wallet_address}</span>
              </button>
              {w.tx_hash && (
                <a
                  href={`https://bscscan.com/tx/${w.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate font-mono text-[11px] text-emerald-400 underline"
                >
                  tx: {w.tx_hash}
                </a>
              )}
              {w.admin_note && (
                <div className="mt-1 text-[11px] text-muted-foreground">note: {w.admin_note}</div>
              )}
              {w.status === "pending" && (
                <PendingActions
                  onApprove={(tx) => decideMut.mutate({ id: w.id, decision: "approved", tx_hash: tx })}
                  onReject={(reason) => decideMut.mutate({ id: w.id, decision: "rejected", admin_note: reason })}
                  pending={decideMut.isPending}
                />
              )}
            </div>
          );
        })}
        {(wds.data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            Nothing here
          </div>
        )}
      </div>
    </div>
  );
}

function PendingActions({
  onApprove,
  onReject,
  pending,
}: {
  onApprove: (tx?: string) => void;
  onReject: (reason?: string) => void;
  pending: boolean;
}) {
  const [tx, setTx] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className="flex gap-1">
        <input
          value={tx}
          onChange={(e) => setTx(e.target.value)}
          placeholder="Tx hash required"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs"
        />
        <button
          disabled={pending}
          onClick={() => tx.trim() ? onApprove(tx.trim()) : toast.error("Tx hash required")}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
      </div>
      <div className="flex gap-1">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reject reason"
          className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs"
        />
        <button
          disabled={pending}
          onClick={() => onReject(reason || undefined)}
          className="inline-flex items-center gap-1 rounded-lg bg-destructive/20 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/30 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
    </div>
  );
}
