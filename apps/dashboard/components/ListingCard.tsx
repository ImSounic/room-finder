"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { priceLabel, type ListingView } from "@rf/core";
import { ContactPanel } from "./ContactPanel";

export function ListingCard({ listing }: { listing: ListingView }) {
  const [status, setStatus] = useState(listing.status);
  const [busy, setBusy] = useState(false);

  async function mark(next: "applied" | "dismissed") {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("listings").update({ status: next }).eq("id", listing.id);
    if (next === "applied") {
      await supabase.from("applications").insert({ listing_id: listing.id, method: "manual", status: "sent" });
    }
    setStatus(next); setBusy(false);
  }

  const high = listing.score >= 70;
  return (
    <div className={`rounded-lg border p-3 ${status === "dismissed" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <a href={listing.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
          {listing.title}
        </a>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${high ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
          {listing.score}
        </span>
      </div>
      <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {priceLabel(listing)} · {listing.type} · {listing.furnished} · {listing.source}
        {listing.available_from ? ` · from ${listing.available_from}` : ""}
      </div>
      {listing.area && <div className="text-xs text-neutral-500">{listing.area}</div>}
      <ContactPanel contact={listing.contact} />
      <div className="mt-2 flex gap-2 text-xs">
        <button disabled={busy || status === "applied"} onClick={() => mark("applied")}
          className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40">
          {status === "applied" ? "applied ✓" : "mark applied"}
        </button>
        <button disabled={busy} onClick={() => mark("dismissed")}
          className="rounded border px-2 py-1 disabled:opacity-40">dismiss</button>
      </div>
    </div>
  );
}
