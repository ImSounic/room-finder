"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["sent", "replied", "viewing", "offer", "rejected"];

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
      <select className="rounded border p-1 text-xs bg-transparent" value={status} disabled={busy}
        onChange={(e) => change(e.target.value)}>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
