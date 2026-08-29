import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  Megaphone,
  Circle,
} from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import {
  profileQuery,
  settingsQuery,
  withdrawalsQuery,
  withdrawEligibilityQuery,
} from "@/lib/queries";
import { requestWithdrawal, recordWithdrawGateAd } from "@/lib/actions.functions";
import { formatFlames, formatUsdt, usdtToFlames, flamesToUsdt, shortAddress } from "@/lib/format";

const PAYMENT_CHANNEL = "https://t.me/coinflamespayment";

export const Route = createFileRoute("/app/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const profile = useQuery({ ...profileQuery(userId), enabled: !!userId });
  const settings = useQuery(settingsQuery());
  const withdrawals = useQuery({ ...withdrawalsQuery(userId), enabled: !!userId });
  const elig = useQuery({ ...withdrawEligibilityQuery(userId), enabled: !!userId });

  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState("");
  const [walletTouched, setWalletTouched] = useState(false);
  const [adsWatched, setAdsWatched] = useState(0);
  const [watching, setWatching] = useState(false);

  // Auto-fill the saved wallet address
  useEffect(() => {
    const saved = profile.data?.wallet_address ?? elig.data?.walletAddress ?? "";
    if (saved && !walletTouched && !wallet) setWallet(saved);
  }, [profile.data?.wallet_address, elig.data?.walletAddress, walletTouched, wallet]);

  const rate = settings.data?.economy.flames_per_usdt ?? 10000;
  const minUsdt = elig.data?.minWithdrawUsdt ?? settings.data?.economy.min_withdraw_usdt ?? 0.1;
  const maxUsdt = settings.data?.economy.max_withdraw_usdt ?? 100;
  const feeFlat = settings.data?.economy.withdraw_fee_flat_usdt ?? 0.01;
  const feePct = settings.data?.economy.withdraw_fee_pct ?? 5;
  const balance = Number(profile.data?.balance ?? 0);
  const maxAvailable = Math.min(flamesToUsdt(balance, rate), maxUsdt);
  const gross = Number(amount) || 0;
  const fee = gross > 0 ? +(feeFlat + (gross * feePct) / 100).toFixed(6) : 0;
  const net = gross > 0 ? Math.max(0, +(gross - fee).toFixed(6)) : 0;

  const adsNeeded = elig.data?.adsBeforeSubmit ?? 5;
  const gateDone = adsWatched >= adsNeeded;
  const requirementsMet = elig.data?.ok ?? false;

  const withdrawFn = useServerFn(requestWithdrawal);
  const gateAdFn = useServerFn(recordWithdrawGateAd);

  const mut = useMutation({
    mutationFn: (input: { amountUsdt: number; walletAddress: string }) =>
      withdrawFn({ data: input }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!");
      setAmount("");
      setAdsWatched(0);
      qc.invalidateQueries({ queryKey: ["withdrawals", userId] });
      qc.invalidateQueries({ queryKey: ["withdraw_eligibility", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function watchGateAd() {
    const cfg = settings.data?.ads;
    const minWatch = Number(cfg?.watch_seconds ?? 10);
    setWatching(true);
    try {
      const { pickRandomBlockId, showAdTimed } = await import("@/lib/adsgram");
      const blockId = pickRandomBlockId(cfg?.block_id_reward, cfg?.block_id_interstitial);
      let seconds = minWatch;
      if (blockId) {
        const res = await showAdTimed(blockId, minWatch);
        if (!res.ok) {
          toast.error(res.message ?? "Ad not completed");
          return;
        }
        seconds = res.seconds;
      } else {
        await new Promise((r) => setTimeout(r, minWatch * 1000));
      }
      const out = await gateAdFn({ data: { watchedSeconds: seconds } });
      setAdsWatched(out.watched);
      toast.success(`Ad ${out.watched}/${adsNeeded} verified`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ad failed");
    } finally {
      setWatching(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n < minUsdt) return toast.error(`Minimum ${minUsdt} USDT`);
    if (wallet.length < 20) return toast.error("Enter a valid BEP20 wallet address");
    if (!requirementsMet) return toast.error("Complete the withdrawal requirements first");
    if (!gateDone) return toast.error(`Watch ${adsNeeded} ads to confirm`);
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

      <a
        href={PAYMENT_CHANNEL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-card/60 p-4"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-flame">
          <Megaphone className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Payment Proof Channel</div>
          <div className="text-[11px] text-muted-foreground">
            All payouts are posted here — check every payment we send.
          </div>
        </div>
        <span className="rounded-full bg-primary/20 px-3 py-1 text-[11px] font-bold text-primary">
          View
        </span>
      </a>

      <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Withdrawal Requirements
        </h2>
        <div className="mt-2 space-y-1.5 text-xs">
          <Requirement
            met={(elig.data?.adsToday ?? 0) >= (elig.data?.adsRequired ?? 10)}
            label={`Watch ${elig.data?.adsRequired ?? 10} ads today`}
            value={`${elig.data?.adsToday ?? 0}/${elig.data?.adsRequired ?? 10}`}
          />
          <Requirement
            met={(elig.data?.referrals ?? 0) >= (elig.data?.referralsRequired ?? 2)}
            label={`Invite ${elig.data?.referralsRequired ?? 2} friends`}
            value={`${elig.data?.referrals ?? 0}/${elig.data?.referralsRequired ?? 2}`}
          />
          {(elig.data?.allTasksRequired ?? true) && (
            <Requirement
              met={(elig.data?.tasksDone ?? 0) >= (elig.data?.tasksTotal ?? 0)}
              label="Complete all active tasks"
              value={`${elig.data?.tasksDone ?? 0}/${elig.data?.tasksTotal ?? 0}`}
            />
          )}
          <Requirement
            met={!(elig.data?.pendingWithdrawal ?? false)}
            label="No pending withdrawal"
            value={elig.data?.pendingWithdrawal ? "pending" : "ok"}
          />
        </div>
      </section>

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
            <div className="mt-2 rounded-xl bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Fee</span>
                <span>
                  ${feeFlat.toFixed(2)} + {feePct}% = ${fee.toFixed(4)}
                </span>
              </div>
              <div className="mt-1 flex justify-between font-bold text-foreground">
                <span>You receive</span>
                <span>${net.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground">
              BEP20 Wallet Address
            </label>
            <input
              placeholder="0x..."
              value={wallet}
              onChange={(e) => {
                setWalletTouched(true);
                setWallet(e.target.value);
              }}
              className="mt-1 w-full rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 font-mono text-xs outline-none"
            />
            <div className="mt-1 text-[10px] text-muted-foreground">
              Saved in your profile and filled automatically.
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold">Watch {adsNeeded} ads to confirm</span>
              <span className="text-muted-foreground">
                {Math.min(adsWatched, adsNeeded)}/{adsNeeded}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/50">
              <div
                className="h-full bg-gradient-flame transition-all"
                style={{ width: `${Math.min(100, (adsWatched / adsNeeded) * 100)}%` }}
              />
            </div>
            <button
              type="button"
              disabled={watching || gateDone}
              onClick={watchGateAd}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary/60 py-2.5 text-xs font-bold disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4 text-primary" />
              {watching ? "Watching…" : gateDone ? "Ads completed" : "Watch ad"}
            </button>
          </div>

          <button
            type="submit"
            disabled={mut.isPending || !requirementsMet || !gateDone}
            className="w-full rounded-2xl bg-gradient-flame py-4 text-sm font-bold text-primary-foreground shadow-flame disabled:opacity-50"
          >
            {mut.isPending ? "Submitting…" : "Confirm Withdrawal"}
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
                  className="rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <div>
                        <div className="font-bold">
                          {formatUsdt(Number(w.net_usdt ?? w.amount_usdt))}
                        </div>
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
                  {w.tx_hash && (
                    <a
                      href={`https://bscscan.com/tx/${w.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate font-mono text-[10px] text-success underline"
                    >
                      tx: {w.tx_hash}
                    </a>
                  )}
                  {w.admin_note && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      note: {w.admin_note}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Requirement({
  met,
  label,
  value,
}: {
  met: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        {met ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      </span>
      <span className={`font-bold ${met ? "text-success" : "text-muted-foreground"}`}>{value}</span>
    </div>
  );
}
