import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { adminAllSettingsQuery } from "@/lib/admin.queries";
import { updateSetting } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const settings = useQuery(adminAllSettingsQuery());
  const fn = useServerFn(updateSetting);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings.data) {
      const next: Record<string, string> = {};
      for (const s of settings.data) next[s.key] = JSON.stringify(s.value, null, 2);
      setDrafts(next);
    }
  }, [settings.data]);

  const saveMut = useMutation({
    mutationFn: (p: { key: string; value: unknown }) => fn({ data: p }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function save(key: string) {
    try {
      const parsed = JSON.parse(drafts[key]);
      saveMut.mutate({ key, value: parsed });
    } catch (e) {
      toast.error(`Invalid JSON: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-xs text-muted-foreground">Global economy, ads, referral & branding. Edit JSON values.</p>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-bold text-primary">AdsGram Setup</div>
        Enter your AdsGram Block ID in the <code className="rounded bg-secondary px-1">ads</code> setting as
        <code className="mx-1 rounded bg-secondary px-1">"block_id": "1-2345"</code>. Get one at
        <a href="https://partner.adsgram.ai" target="_blank" rel="noreferrer" className="ml-1 text-primary underline">
          partner.adsgram.ai
        </a>.
      </div>

      <div className="space-y-3">
        {(settings.data ?? []).map((s) => (
          <div key={s.key} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-xs font-bold text-primary">{s.key}</div>
              <button
                onClick={() => save(s.key)}
                disabled={saveMut.isPending}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-1.5 text-[11px] font-bold text-primary-foreground shadow-flame disabled:opacity-50"
              >
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
            <textarea
              rows={Math.min(10, (drafts[s.key] ?? "").split("\n").length + 1)}
              value={drafts[s.key] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
              className="w-full rounded-lg border border-border/60 bg-background p-3 font-mono text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
