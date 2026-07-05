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
    const { error } = await createClient().from("replies").insert({ application_id: applicationId, channel, body });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setBody(""); router.refresh();
  }

  if (applications.length === 0) return <p className="text-neutral-500 text-sm">Apply to something first to log replies.</p>;
  return (
    <form onSubmit={add} className="flex flex-col gap-2 rounded-lg border p-3 mb-3 text-sm">
      <select className="rounded border p-1 bg-transparent" value={applicationId}
        onChange={(e) => setApplicationId(e.target.value)}>
        {applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
      </select>
      <select className="rounded border p-1 bg-transparent" value={channel} onChange={(e) => setChannel(e.target.value)}>
        {["email", "platform", "phone", "manual"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <textarea className="rounded border p-1 bg-transparent" placeholder="reply text" value={body}
        onChange={(e) => setBody(e.target.value)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40 self-start" disabled={busy}>
        add reply
      </button>
    </form>
  );
}
