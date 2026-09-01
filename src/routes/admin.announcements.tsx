import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pin, PinOff, Trash2, Pencil } from "lucide-react";
import { adminAnnouncementsQuery } from "@/lib/admin.queries";
import { upsertAnnouncement, deleteAnnouncement } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/announcements")({
  component: AdminAnnouncements,
});

type AnnRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  active: boolean;
};

function AdminAnnouncements() {
  const qc = useQueryClient();
  const list = useQuery(adminAnnouncementsQuery());
  const [editing, setEditing] = useState<
    (Partial<AnnRow> & { broadcast?: boolean; bot_broadcast?: boolean; channel_post?: boolean }) | null
  >(null);
  const upFn = useServerFn(upsertAnnouncement);
  const delFn = useServerFn(deleteAnnouncement);

  const saveMut = useMutation({
    mutationFn: (v: Partial<AnnRow> & { broadcast?: boolean; bot_broadcast?: boolean; channel_post?: boolean }) =>
      upFn({
        data: {
          id: v.id,
          title: v.title ?? "",
          body: v.body ?? "",
          pinned: v.pinned ?? false,
          active: v.active ?? true,
          broadcast: v.broadcast ?? false,
          bot_broadcast: v.bot_broadcast ?? false,
          channel_post: v.channel_post ?? false,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "announcements"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Announcements</h1>
          <p className="text-xs text-muted-foreground">{list.data?.length ?? 0} total</p>
        </div>
        <button
          onClick={() => setEditing({ active: true, pinned: false, broadcast: false })}
          className="inline-flex items-center gap-1 rounded-full bg-gradient-flame px-4 py-2 text-xs font-bold text-primary-foreground shadow-flame"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-primary/30 bg-card/70 p-4">
          <div className="space-y-3">
            <input
              placeholder="Title"
              value={editing.title ?? ""}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-semibold"
            />
            <textarea
              rows={3}
              placeholder="Body"
              value={editing.body ?? ""}
              onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.pinned ?? false}
                  onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                />
                Pinned
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                Active
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.broadcast ?? false}
                  onChange={(e) => setEditing({ ...editing, broadcast: e.target.checked })}
                />
                Broadcast as notification
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.bot_broadcast ?? false}
                  onChange={(e) => setEditing({ ...editing, bot_broadcast: e.target.checked })}
                />
                Send to all bot users
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editing.channel_post ?? false}
                  onChange={(e) => setEditing({ ...editing, channel_post: e.target.checked })}
                />
                Post to community channel
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-full border border-border/60 px-4 py-2 text-xs">
                Cancel
              </button>
              <button
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate(editing)}
                className="rounded-full bg-gradient-flame px-5 py-2 text-xs font-bold text-primary-foreground shadow-flame disabled:opacity-50"
              >
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(list.data ?? []).map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {a.pinned ? <Pin className="h-3 w-3 text-primary" /> : <PinOff className="h-3 w-3 text-muted-foreground" />}
                <span className={`text-[10px] uppercase tracking-widest ${a.active ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {a.active ? "active" : "hidden"}
                </span>
              </div>
              <div className="mt-1 font-bold">{a.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{a.body}</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => setEditing(a)} className="rounded-lg border border-border/60 p-1.5 hover:bg-card">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => confirm("Delete?") && delMut.mutate(a.id)}
                className="rounded-lg border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No announcements
          </div>
        )}
      </div>

      <BroadcastPanel />
    </div>
  );
}

function BroadcastPanel() {
  const sendFn = useServerFn(broadcastToUsers);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttons, setButtons] = useState<{ text: string; url: string }[]>([]);
  const [alsoInApp, setAlsoInApp] = useState(true);

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          title,
          body,
          imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
          buttons: buttons.filter((b) => b.text.trim() && b.url.trim()),
          alsoInApp,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Broadcast sent to ${r.sent} users`);
      setTitle("");
      setBody("");
      setImageUrl("");
      setButtons([]);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-2xl border border-accent/30 bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Send className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-black">Broadcast to all users</h2>
      </div>
      <div className="space-y-3">
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-semibold"
        />
        <textarea
          rows={3}
          placeholder="Message body (HTML allowed)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        />
        <input
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        />

        <div className="space-y-2">
          {buttons.map((b, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input
                placeholder="Button text"
                value={b.text}
                onChange={(e) =>
                  setButtons(buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                }
                className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"
              />
              <div className="flex gap-1">
                <input
                  placeholder="https://…"
                  value={b.url}
                  onChange={(e) =>
                    setButtons(buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                  }
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs"
                />
                <button
                  onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                  className="rounded-lg border border-destructive/40 px-2 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {buttons.length < 3 && (
            <button
              onClick={() => setButtons([...buttons, { text: "", url: "" }])}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-[11px]"
            >
              <Plus className="h-3 w-3" /> Add button
            </button>
          )}
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={alsoInApp}
            onChange={(e) => setAlsoInApp(e.target.checked)}
          />
          Also show as in-app notification
        </label>

        <div className="flex justify-end">
          <button
            disabled={sendMut.isPending || !title.trim() || !body.trim()}
            onClick={() => sendMut.mutate()}
            className="rounded-full bg-gradient-flame px-5 py-2 text-xs font-bold text-primary-foreground shadow-flame disabled:opacity-50"
          >
            {sendMut.isPending ? "Sending…" : "Send broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
}

