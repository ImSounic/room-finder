"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["sent", "replied", "viewing", "offer", "rejected"] as const;

const TONE: Record<string, string> = {
  sent: "bg-surface text-muted border-line",
  replied: "bg-primary-soft text-primary border-transparent",
  viewing: "bg-accent-soft text-accent border-transparent",
  offer: "bg-accent text-white border-transparent",
  rejected: "bg-surface-2 text-muted border-transparent line-through",
};

export function StatusPicker({ applicationId, initial }: { applicationId: string; initial: string }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change(next: string) {
    setBusy(true); setError(null);
    const { error } = await createClient().from("applications").update({ status: next }).eq("id", applicationId);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setStatus(next);
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <select
        aria-label="application status"
        className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors duration-150 disabled:opacity-50 ${TONE[status] ?? TONE.sent}`}
        value={status}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {error && <span className="text-xs text-danger" role="alert">Couldn’t save — {error}</span>}
    </span>
  );
}
