"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { priceLabel, CRITERIA, type ListingView } from "@rf/core";
import { ContactPanel } from "./ContactPanel";
import { timeAgo } from "@/lib/time";

function scoreTone(score: number): string {
  if (score >= CRITERIA.highPriorityScore) return "bg-accent text-white";
  if (score >= 50) return "bg-primary-soft text-primary";
  return "bg-surface-2 text-muted";
}

export function ListingCard({ listing, fresh = false, twin = null }: { listing: ListingView; fresh?: boolean; twin?: ListingView | null }) {
  const [pending, setPending] = useState<string | null>(null);
  const status = pending ?? listing.status;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark(next: "applied" | "dismissed") {
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase.from("listings").update({ status: next }).eq("id", listing.id);
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    if (next === "applied") {
      const { error: insErr } = await supabase.from("applications").insert({ listing_id: listing.id, method: "manual", status: "sent" });
      if (insErr) { setError(insErr.message); setBusy(false); return; }
    }
    setPending(next); setBusy(false);
  }

  const high = listing.score >= CRITERIA.highPriorityScore;
  const dismissed = status === "dismissed";
  const hasContact = !!listing.contact && !!(listing.contact.phone || listing.contact.email || listing.contact.agency);
  const showTwin = twin !== null && !hasContact;

  return (
    <article
      className={`group relative flex flex-col rounded-(--radius-card) border border-line bg-bg p-4 shadow-(--shadow-card) transition-[box-shadow,opacity,transform] duration-200 hover:shadow-(--shadow-lift) ${
        dismissed ? "opacity-45" : ""
      } ${fresh ? "animate-arrive animate-fresh" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Score is the hero — readable from a meter away */}
        <div
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-bold tabular-nums ${scoreTone(listing.score)}`}
          title={high ? "High priority — act now" : "Match score"}
        >
          {listing.score}
        </div>
        <div className="min-w-0 flex-1">
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 font-semibold leading-snug hover:text-primary hover:underline"
          >
            {listing.title}
          </a>
          <div className="mt-0.5 text-sm font-medium">
            {priceLabel(listing)}
            <span className="font-normal text-muted"> / month</span>
          </div>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div className="inline-flex items-center gap-1">
          <dt className="sr-only">type</dt>
          <dd className="rounded-md bg-surface px-1.5 py-0.5 font-medium text-ink">{listing.type}</dd>
        </div>
        {!listing.is_match && (
          <div className="inline-flex items-center gap-1">
            <dt className="sr-only">match</dt>
            <dd className="rounded-md bg-surface-2 px-1.5 py-0.5">outside criteria</dd>
          </div>
        )}
        {listing.furnished !== "unknown" && (
          <div className="inline-flex items-center gap-1">
            <dt className="sr-only">furnished</dt>
            <dd>{listing.furnished === "yes" ? "furnished" : listing.furnished === "semi" ? "semi-furnished" : "unfurnished"}</dd>
          </div>
        )}
        {listing.area && (
          <div className="inline-flex items-center gap-1 min-w-0">
            <dt className="sr-only">area</dt>
            <dd className="truncate">📍 {listing.area}</dd>
          </div>
        )}
        {listing.available_from && (
          <div className="inline-flex items-center gap-1">
            <dt className="sr-only">available</dt>
            <dd>from {listing.available_from}</dd>
          </div>
        )}
        <div className="inline-flex items-center gap-1">
          <dt className="sr-only">seen</dt>
          <dd>{listing.source} · {timeAgo(listing.first_seen_at)}</dd>
        </div>
      </dl>

      <ContactPanel contact={listing.contact} />

      {showTwin && (
        <a
          href={twin.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 self-start rounded-full bg-accent-soft px-3 text-xs font-medium text-accent hover:brightness-105"
        >
          ↔ Also on {twin.source}
          {twin.contact?.phone ? ` — ${twin.contact.phone}` : twin.contact?.agency ? ` — ${twin.contact.agency}` : ""} · free contact
        </a>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={busy || status === "applied"}
          onClick={() => mark("applied")}
          className="inline-flex min-h-11 items-center justify-center rounded-(--radius-control) bg-primary px-4 text-sm font-semibold text-primary-ink transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
        >
          {busy ? "…" : status === "applied" ? "Applied ✓" : "Mark applied"}
        </button>
        {!dismissed && status !== "applied" && (
          <button
            disabled={busy}
            onClick={() => mark("dismissed")}
            className="inline-flex min-h-11 items-center justify-center rounded-(--radius-control) border border-line px-4 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            Dismiss
          </button>
        )}
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        >
          Open ↗
        </a>
      </div>
      {error && <p className="mt-2 text-xs text-danger" role="alert">Couldn’t save — {error}</p>}
    </article>
  );
}
