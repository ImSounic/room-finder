"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AddReply({ applications }: { applications: { id: string; title: string }[] }) {
  const router = useRouter();
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [channel, setChannel] = useState("email");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId) return;
    setBusy(true); setError(null);
    const { error } = await createClient().from("replies").insert({
      application_id: applicationId,
      channel,
      body: body.trim() || null,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setBody(""); router.refresh();
  }

  if (applications.length === 0) return null;

  return (
    <form onSubmit={add} className="mb-4 flex flex-col gap-2.5 rounded-(--radius-card) border border-line bg-surface/50 p-4">
      <div className="text-sm font-semibold">Log a reply</div>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="application"
          className="min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-line bg-bg px-2 text-sm"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
        >
          {applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <select
          aria-label="channel"
          className="min-h-11 rounded-(--radius-control) border border-line bg-bg px-2 text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          {["email", "platform", "phone", "manual"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <textarea
        className="min-h-20 rounded-(--radius-control) border border-line bg-bg p-2.5 text-sm placeholder:text-muted"
        placeholder="What did they say?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="text-xs text-danger" role="alert">Couldn’t save — {error}</p>}
      <button
        className="self-start rounded-(--radius-control) bg-primary px-4 py-2.5 text-sm font-semibold text-primary-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50"
        disabled={busy}
      >
        {busy ? "Saving…" : "Add reply"}
      </button>
    </form>
  );
}
