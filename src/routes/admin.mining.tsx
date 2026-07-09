import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Pickaxe, Plus, Save, Trash2 } from "lucide-react";
import {
  adminListMiningPackages,
  upsertMiningPackage,
  deleteMiningPackage,
} from "@/lib/mining.functions";

export const Route = createFileRoute("/admin/mining")({
  component: AdminMining,
});

type Row = {
  id?: string;
  name: string;
  hourly_reward: number;
  ads_required: number;
  daily_claim_limit: number;
  cooldown_seconds: number;
  sort_order: number;
  active: boolean;
};

const blank: Row = {
  name: "",
  hourly_reward: 20,
  ads_required: 1,
  daily_claim_limit: 10,
  cooldown_seconds: 3600,
  sort_order: 0,
  active: true,
};

function AdminMining() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListMiningPackages);
  const saveFn = useServerFn(upsertMiningPackage);
  const delFn = useServerFn(deleteMiningPackage);

  const q = useQuery({
    queryKey: ["admin", "mining_packages"],
    queryFn: () => listFn(),
  });

  const saveMut = useMutation({
    mutationFn: (p: Row) => saveFn({ data: p }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "mining_packages"] });
      qc.invalidateQueries({ queryKey: ["mining", "state"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "mining_packages"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [draft, setDraft] = useState<Row>(blank);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Pickaxe className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-black">Mining Machines</h1>
          <p className="text-xs text-muted-foreground">
            Tune each package's reward, ads required, and daily limits.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
          <Plus className="h-4 w-4" /> New machine
        </div>
        <RowForm value={draft} onChange={setDraft} />
        <button
          onClick={() => {
            if (!draft.name.trim()) return toast.error("Name required");
            saveMut.mutate(draft);
            setDraft(blank);
          }}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-1.5 text-[11px] font-bold text-primary-foreground shadow-flame"
        >
          <Save className="h-3 w-3" /> Add machine
        </button>
      </div>

      <div className="space-y-3">
        {(q.data ?? []).map((p) => (
          <EditableRow
            key={p.id}
            initial={p as Row}
            onSave={(v) => saveMut.mutate({ ...v, id: p.id })}
            onDelete={() => {
              if (confirm(`Delete ${p.name}?`)) delMut.mutate(p.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EditableRow({
  initial,
  onSave,
  onDelete,
}: {
  initial: Row;
  onSave: (v: Row) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState<Row>(initial);
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <RowForm value={v} onChange={setV} />
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-[11px] font-bold text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <button
          onClick={() => onSave(v)}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-1.5 text-[11px] font-bold text-primary-foreground shadow-flame"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </div>
    </div>
  );
}

function RowForm({
  value,
  onChange,
}: {
  value: Row;
  onChange: (v: Row) => void;
}) {
  const upd = <K extends keyof Row>(k: K, v: Row[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
      <Field label="Name">
        <input
          value={value.name}
          onChange={(e) => upd("name", e.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <Field label="Hourly Reward">
        <input
          type="number"
          value={value.hourly_reward}
          onChange={(e) => upd("hourly_reward", Number(e.target.value))}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <Field label="Ads Required">
        <input
          type="number"
          value={value.ads_required}
          onChange={(e) => upd("ads_required", Number(e.target.value))}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <Field label="Daily Limit">
        <input
          type="number"
          value={value.daily_claim_limit}
          onChange={(e) => upd("daily_claim_limit", Number(e.target.value))}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <Field label="Cooldown (sec)">
        <input
          type="number"
          value={value.cooldown_seconds}
          onChange={(e) => upd("cooldown_seconds", Number(e.target.value))}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <Field label="Sort Order">
        <input
          type="number"
          value={value.sort_order}
          onChange={(e) => upd("sort_order", Number(e.target.value))}
          className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5"
        />
      </Field>
      <label className="col-span-2 flex items-center gap-2 md:col-span-3">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(e) => upd("active", e.target.checked)}
        />
        <span className="text-[11px] text-muted-foreground">Active</span>
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
