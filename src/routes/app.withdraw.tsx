import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useState } from "react";
import { Wallet, ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { profileQuery, settingsQuery, withdrawalsQuery } from "@/lib/queries";
import { requestWithdrawal } from "@/lib/actions.functions";
import { formatFlames, formatUsdt, usdtToFlames, flamesToUsdt, shortAddress } from "@/lib/format";

export const Route = createFileRoute("/app/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: !!userId });
  const settings = useQuery(settingsQuery());
  const withdrawals = useQuery({ ...withdrawalsQuery(userId), enabled: !!userId });

  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");

  const rate = settings.data?.economy.flames_per_usdt ?? 100000;
  const minUsdt = settings.data?.economy.min_withdraw_usdt ?? 1;
  const maxUsdt = settings.data?.economy.max_withdraw_usdt ?? 100;
  const balance = Number(profile.data?.balance ?? 0);
  const maxAvailable = Math.min(flamesToUsdt(balance, rate), maxUsdt);

  const withdrawFn = useServerFn(requestWithdrawal);
  const mut = useMutation({
    mutationFn: (input: { amountUsdt: number; walletAddress: string }) =>
      withdrawFn({ data: input }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["withdrawals", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n < minUsdt) return toast.error(`Minimum ${minUsdt} USDT`);
    if (wallet.length < 20) return toast.error("Enter a valid BEP20 wallet address");
    mut.mutate({ amountUsdt: n, walletAddress: wallet });
  }

  const inputFlames = usdtToFlames(Number(amount) || 0, rate);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <Link
          to="/app"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black">Withdraw</h1>
          <p className="text-xs text-muted-foreground">USDT · BEP20 network</p>
        </div>
      </header>

      <div className="rounded-3xl bg-gradient-card border border-primary/20 p-5 shadow-flame">
        <div className="text-xs uppercase text-muted-foreground">Available</div>
        <div className="mt-1 text-3xl font-black text-gradient-gold">
          {formatUsdt(flamesToUsdt(balance, rate))}
        </div>
        <div className="text-xs text-muted-foreground">{formatFlames(balance)} Flames</div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">Amount (USDT)</label>
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3">
              <Wallet className="h-4 w-4 text-primary" />
              <input
                inputMode="decimal"
                placeholder={`Min ${minUsdt}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent text-lg font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => setAmount(String(maxAvailable.toFixed(4)))}
                className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary"
              >
                MAX
              </button>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              = {formatFlames(inputFlames)} Flames · Max {maxUsdt} USDT
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground">
              BEP20 Wallet Address
            </label>
            <input
              placeholder="0x..."
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 font-mono text-xs outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={mut.isPending}
            className="w-full rounded-2xl bg-gradient-flame py-4 text-sm font-bold text-primary-foreground shadow-flame disabled:opacity-50"
          >
            {mut.isPending ? "Submitting…" : "Request Withdrawal"}
          </button>
        </form>
      </div>

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          History
        </h2>
        <div className="space-y-1.5">
          {(withdrawals.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
              No withdrawals yet
            </div>
          ) : (
            withdrawals.data?.map((w) => {
              const Icon =
                w.status === "approved" ? CheckCircle2 : w.status === "rejected" ? XCircle : Clock;
              const color =
                w.status === "approved"
                  ? "text-success"
                  : w.status === "rejected"
                    ? "text-destructive"
                    : "text-accent";
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <div>
                      <div className="font-bold">{formatUsdt(Number(w.amount_usdt))}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {shortAddress(w.wallet_address)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-bold uppercase ${color}`}>{w.status}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
