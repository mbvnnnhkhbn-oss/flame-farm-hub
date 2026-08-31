import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { adminTasksQuery } from "@/lib/admin.queries";
import { upsertTask, deleteTask } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tasks")({
  component: AdminTasks,
});

type TaskRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  reward: number;
  target_url: string | null;
  target_chat: string | null;
  verification_type: string | null;
  priority: number | null;
  active: boolean;
  category?: string | null;
};

const TYPES = [
  "telegram_join","telegram_group","bot_start","website","social_follow","youtube","quiz","survey","app_download",
];

const CATEGORIES = ["main", "partner", "other"] as const;


function AdminTasks() {
  const qc = useQueryClient();
  const tasks = useQuery(adminTasksQuery());
  const [editing, setEditing] = useState<Partial<TaskRow> | null>(null);
  const upFn = useServerFn(upsertTask);
  const delFn = useServerFn(deleteTask);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<TaskRow>) =>
      upFn({
        data: {
          id: payload.id,
          type: (payload.type as never) ?? "website",
          title: payload.title ?? "",
          description: payload.description ?? null,
          reward: Number(payload.reward ?? 0),
          target_url: payload.target_url || null,
          target_chat: payload.target_chat || null,
          verification_type: (payload.verification_type as never) ?? "manual",
          priority: Number(payload.priority ?? 0),
          active: payload.active ?? true,
          category: ((payload.category as never) ?? "other"),
        },
      }),
    onSuccess: () => {
      toast.success("Task saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "tasks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "tasks"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Tasks</h1>
          <p className="text-xs text-muted-foreground">{tasks.data?.length ?? 0} total</p>
        </div>
        <button
          onClick={() => setEditing({ active: true, verification_type: "manual", type: "website", reward: 1000, category: "other" })}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-2 text-xs font-bold text-primary-foreground shadow-flame"
        >
          <Plus className="h-3.5 w-3.5" /> New Task
        </button>
      </div>

      {editing && (
        <TaskForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={(v) => saveMut.mutate(v)}
          saving={saveMut.isPending}
        />
      )}

      <div className="space-y-2">
        {(tasks.data ?? []).map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${t.active ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  {t.category ?? "other"}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.type}</span>
                <span className="text-xs text-primary">+{Number(t.reward).toLocaleString()} 🔥</span>
              </div>
              <div className="mt-1 font-bold">{t.title}</div>
              {t.description && <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>}
              {(t.target_url || t.target_chat) && (
                <div className="mt-1 truncate text-[11px] text-muted-foreground">→ {t.target_url ?? t.target_chat}</div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(t)} className="rounded-lg border border-border/60 p-1.5 hover:bg-card">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => confirm("Delete this task?") && delMut.mutate(t.id)}
                className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(tasks.data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No tasks yet
          </div>
        )}
      </div>
    </div>
  );
}

function TaskForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: Partial<TaskRow>;
  onCancel: () => void;
  onSave: (v: Partial<TaskRow>) => void;
  saving: boolean;
}) {
  const [v, setV] = useState<Partial<TaskRow>>(initial);
  return (
    <div className="rounded-2xl border border-primary/30 bg-card/70 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.title ?? ""}
            onChange={(e) => setV({ ...v, title: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.type ?? "website"}
            onChange={(e) => setV({ ...v, type: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Section">
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.category ?? "other"}
            onChange={(e) => setV({ ...v, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Reward (Flames)">
          <input
            type="number"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.reward ?? 0}
            onChange={(e) => setV({ ...v, reward: Number(e.target.value) })}
          />
        </Field>
        <Field label="Priority">
          <input
            type="number"
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.priority ?? 0}
            onChange={(e) => setV({ ...v, priority: Number(e.target.value) })}
          />
        </Field>
        <Field label="Target URL">
          <input
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.target_url ?? ""}
            onChange={(e) => setV({ ...v, target_url: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Target Chat (@channel)">
          <input
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.target_chat ?? ""}
            onChange={(e) => setV({ ...v, target_chat: e.target.value })}
            placeholder="@coinflames"
          />
        </Field>
        <Field label="Verification">
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={v.verification_type ?? "manual"}
            onChange={(e) => setV({ ...v, verification_type: e.target.value })}
          >
            <option value="manual">manual (auto-approve)</option>
            <option value="bot">bot (check via Telegram)</option>
            <option value="auto">auto</option>
          </select>
        </Field>
        <Field label="Active">
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            value={String(v.active ?? true)}
            onChange={(e) => setV({ ...v, active: e.target.value === "true" })}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              value={v.description ?? ""}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full border border-border/60 px-4 py-2 text-xs">
          Cancel
        </button>
        <button
          disabled={saving}
          onClick={() => onSave(v)}
          className="rounded-full bg-gradient-flame px-5 py-2 text-xs font-bold text-primary-foreground shadow-flame disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
