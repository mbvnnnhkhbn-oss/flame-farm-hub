import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";

import { adminRewardCodesQuery } from "@/lib/admin.queries";
import { deleteRewardCode, upsertRewardCode } from "@/lib/admin.functions";
import { formatFlames } from "@/lib/format";

export const Route = createFileRoute("/admin/reward-codes")({
  component: AdminRewardCodes,
});

type RewardCodeRow = {
  id: string;
  code: string;
  reward: number;
  max_claims: number | null;
  per_user_limit: number;
  active: boolean;
  expires_at: string | null;
  claims?: { id: string }[] | null;
};

function AdminRewardCodes() {
  const qc = useQueryClient();
  const codes = useQuery(adminRewardCodesQuery());
  const [editing, setEditing] = useState<Partial<RewardCodeRow> | null>(null);
  const upFn = useServerFn(upsertRewardCode);
  const delFn = useServerFn(deleteRewardCode);

  const saveMut = useMutation({
    mutationFn: (v: Partial<RewardCodeRow>) =>
      upFn({
        data: {
          id: v.id,
          code: v.code ?? "",
          reward: Number(v.reward ?? 0),
          max_claims: v.max_claims ? Number(v.max_claims) : null,
          per_user_limit: Number(v.per_user_limit ?? 1),
          active: v.active ?? true,
          expires_at: v.expires_at || null,
        },
      }),
    onSuccess: () => {
      toast.success("Reward code saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "reward_codes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "reward_codes"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Reward Codes</h1>
          <p className="text-xs text-muted-foreground">Create claim codes for Home screen rewards</p>
        </div>
        <button
          onClick={() => setEditing({ active: true, per_user_limit: 1, reward: 100 })}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-2 text-xs font-bold text-primary-foreground shadow-flame"
        >
          <Plus className="h-3.5 w-3.5" /> New Code
        </button>
      </div>

      {editing && (
        <CodeForm
          initial={editing}
          saving={saveMut.isPending}
          onCancel={() => setEditing(null)}
          onSave={(v) => saveMut.mutate(v)}
        />
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(codes.data ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-accent" />
                  <span className="font-mono text-lg font-black">{c.code}</span>
                </div>
                <div className="mt-1 text-sm font-bold text-gradient-gold">
                  +{formatFlames(c.reward)} Flames
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Claims {(c.claims?.length ?? 0).toLocaleString()}
                  {c.max_claims ? ` / ${c.max_claims}` : ""} · {c.active ? "active" : "off"}
                </div>
                {c.expires_at && (
                  <div className="text-[11px] text-muted-foreground">
                    Expires {new Date(c.expires_at).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => setEditing(c)} className="rounded-lg border border-border/60 p-1.5 hover:bg-card">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => confirm("Delete this code?") && delMut.mutate(c.id)}
                  className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {(codes.data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No reward codes yet
          </div>
        )}
      </div>
    </div>
  );
}

function CodeForm({
  initial,
  saving,
  onCancel,
  onSave,
}: {
  initial: Partial<RewardCodeRow>;
  saving: boolean;
  onCancel: () => void;
  onSave: (v: Partial<RewardCodeRow>) => void;
}) {
  const [v, setV] = useState<Partial<RewardCodeRow>>(initial);
  return (
    <div className="rounded-2xl border border-primary/30 bg-card/70 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code">
          <input
            value={v.code ?? ""}
            onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 font-mono text-sm"
            placeholder="FLAME100"
          />
        </Field>
        <Field label="Reward">
          <input
            type="number"
            value={v.reward ?? 0}
            onChange={(e) => setV({ ...v, reward: Number(e.target.value) })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Max Claims">
          <input
            type="number"
            value={v.max_claims ?? ""}
            onChange={(e) => setV({ ...v, max_claims: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            placeholder="Unlimited"
          />
        </Field>
        <Field label="Per User Limit">
          <input
            type="number"
            value={v.per_user_limit ?? 1}
            onChange={(e) => setV({ ...v, per_user_limit: Number(e.target.value) })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Expires At">
          <input
            type="datetime-local"
            value={v.expires_at ? v.expires_at.slice(0, 16) : ""}
            onChange={(e) => setV({ ...v, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Active">
          <select
            value={String(v.active ?? true)}
            onChange={(e) => setV({ ...v, active: e.target.value === "true" })}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-full border border-border/60 px-4 py-2 text-xs">
          Cancel
        </button>
        <button
          disabled={saving || !v.code || !v.reward}
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