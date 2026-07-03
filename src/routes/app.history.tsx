import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Flame, PlayCircle, Gift, ListChecks, Wallet } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import {
  adsTodayQuery,
  checkinsQuery,
  withdrawalsQuery,
} from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatFlames, formatUsdt, shortAddress } from "@/lib/format";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

const TABS = [
  { key: "ads", label: "Ads", icon: PlayCircle },
  { key: "checkin", label: "Check-in", icon: Gift },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "withdraw", label: "Withdraw", icon: Wallet },
] as const;

function HistoryPage() {
  const userId = useCurrentUserId() ?? "";
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ads");

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <Link
          to="/app/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-black">History</h1>
      </header>

      <div className="flex gap-1 rounded-2xl border border-border/60 bg-card/40 p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                active
                  ? "flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-flame py-2 text-xs font-bold text-primary-foreground shadow-flame"
                  : "flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium text-muted-foreground"
              }
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "ads" && <AdsHistory userId={userId} />}
      {tab === "checkin" && <CheckinHistory userId={userId} />}
      {tab === "tasks" && <TasksHistory userId={userId} />}
      {tab === "withdraw" && <WithdrawHistory userId={userId} />}
    </div>
  );
}

function AdsHistory({ userId }: { userId: string }) {
  const q = useQuery({ ...adsTodayQuery(userId), enabled: !!userId });
  return <List items={q.data} render={(a) => rowFlame(a.watched_at, a.reward)} empty="No ads today" />;
}
function CheckinHistory({ userId }: { userId: string }) {
  const q = useQuery({ ...checkinsQuery(userId), enabled: !!userId });
  return (
    <List
      items={q.data}
      render={(c) => rowFlame(c.claimed_date, c.reward, `Day ${c.streak_day}`)}
      empty="No check-ins yet"
    />
  );
}
function TasksHistory({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["task_completions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("*, tasks(title)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
  return (
    <List
      items={q.data}
      render={(c) => (
        <>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ListChecks className="h-3 w-3 text-primary" />
            <span className="truncate">{(c.tasks as { title?: string } | null)?.title ?? "Task"}</span>
          </div>
          <span className="font-bold text-gradient-gold">+{formatFlames(c.reward)}</span>
        </>
      )}
      empty="No completed tasks"
    />
  );
}
function WithdrawHistory({ userId }: { userId: string }) {
  const q = useQuery({ ...withdrawalsQuery(userId), enabled: !!userId });
  return (
    <List
      items={q.data}
      render={(w) => (
        <>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-3 w-3 text-primary" />
            <div>
              <div className="font-bold text-foreground">{formatUsdt(Number(w.amount_usdt))}</div>
              <div className="font-mono text-[10px]">{shortAddress(w.wallet_address)}</div>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase text-accent">{w.status}</span>
        </>
      )}
      empty="No withdrawals"
    />
  );
}

function List<T>({
  items,
  render,
  empty,
}: {
  items: T[] | undefined;
  render: (item: T) => React.ReactNode;
  empty: string;
}) {
  if (!items || items.length === 0)
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-xs text-muted-foreground">
        {empty}
      </div>
    );
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-xs"
        >
          {render(it)}
        </div>
      ))}
    </div>
  );
}

function rowFlame(date: string, reward: number | bigint | null, label?: string) {
  return (
    <>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Flame className="h-3 w-3 text-primary" />
        <span>
          {new Date(date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {label ? ` · ${label}` : ""}
        </span>
      </div>
      <span className="font-bold text-gradient-gold">+{formatFlames(reward)}</span>
    </>
  );
}
