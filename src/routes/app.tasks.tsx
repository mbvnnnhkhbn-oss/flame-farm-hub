import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, ListChecks } from "lucide-react";

import { useCurrentUserId } from "@/hooks/use-current-user";
import { tasksQuery } from "@/lib/queries";
import { completeTask } from "@/lib/actions.functions";
import { formatFlames } from "@/lib/format";
import { haptic } from "@/lib/telegram";

export const Route = createFileRoute("/app/tasks")({
  component: TasksPage,
});

const TYPE_LABEL: Record<string, string> = {
  telegram_join: "Join Telegram",
  telegram_group: "Join Group",
  bot_start: "Start Bot",
  website: "Visit Site",
  social_follow: "Social Follow",
  youtube: "Watch Video",
  quiz: "Quiz",
  survey: "Survey",
  app_download: "Install App",
};

function TasksPage() {
  const userId = useCurrentUserId() ?? "";
  const qc = useQueryClient();
  const tasks = useQuery({ ...tasksQuery(userId), enabled: !!userId });
  const completeFn = useServerFn(completeTask);
  const completeMut = useMutation({
    mutationFn: (taskId: string) => completeFn({ data: { taskId } }),
    onSuccess: (res) => {
      haptic("medium");
      toast.success(`+${formatFlames(res.reward)} Flames earned!`);
      qc.invalidateQueries({ queryKey: ["tasks", userId] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const all = tasks.data ?? [];
  const groups: { key: string; label: string; hint: string; rows: typeof all }[] = [
    {
      key: "main",
      label: "Main Tasks",
      hint: "Required for withdrawals",
      rows: all.filter((t) => (t.category ?? "other") === "main"),
    },
    {
      key: "partner",
      label: "Partner Tasks",
      hint: "From our partners",
      rows: all.filter((t) => (t.category ?? "other") === "partner"),
    },
    {
      key: "other",
      label: "Other Tasks",
      hint: "Extra ways to earn",
      rows: all.filter((t) => (t.category ?? "other") === "other"),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-flame shadow-flame">
          <ListChecks className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Tasks</h1>
          <p className="text-xs text-muted-foreground">Complete tasks and earn Flames instantly</p>
        </div>
      </header>

      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <section key={g.key}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </h2>
              <span className="text-[10px] text-muted-foreground">{g.hint}</span>
            </div>
            <div className="space-y-2">{g.rows.map((t) => renderTask(t))}</div>
          </section>
        ))}

      {all.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No active tasks right now. Check back soon!
        </div>
      )}
    </div>
  );

  function renderTask(t: (typeof all)[number]) {
    return (

          <div
            key={t.id}
            className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {TYPE_LABEL[t.type] ?? t.type}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
                )}
                <div className="mt-1 text-xs font-bold text-gradient-gold">
                  +{formatFlames(t.reward)} Flames
                </div>
              </div>
              {t.completed ? (
                <div className="flex flex-col items-center gap-1 rounded-xl bg-success/20 px-3 py-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-[10px] font-bold text-success">DONE</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {t.target_url && (
                    <a
                      href={t.target_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => haptic("light")}
                      className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-[11px] font-medium"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    disabled={completeMut.isPending}
                    onClick={() => completeMut.mutate(t.id)}
                    className="rounded-full bg-gradient-flame px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-flame disabled:opacity-50"
                  >
                    Claim
                  </button>
                </div>
              )}
            </div>
      </div>
    );
  }
}

