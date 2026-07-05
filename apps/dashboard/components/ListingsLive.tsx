"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortAndFilter, linkByAddress, typeCategory, type ListingView, type ListingFilter } from "@rf/core";
import { ListingCard } from "./ListingCard";

const SCORE_STEPS = [
  { value: undefined, label: "Any score" },
  { value: 70, label: "70+" },
  { value: 80, label: "80+" },
] as const;

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "studio", label: "Studios" },
  { value: "shared", label: "Shared" },
  { value: "other", label: "Other" },
] as const;

export function ListingsLive({ initial }: { initial: ListingView[] }) {
  const [rows, setRows] = useState<ListingView[]>(initial);
  const [filter, setFilter] = useState<ListingFilter>({ hideDismissed: true, category: "all" });
  // Ids that arrived via realtime this session — they get the arrival animation.
  const freshIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("listings-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" },
        (payload) => {
          const row = payload.new as ListingView;
          freshIds.current.add(row.id);
          setRows((cur) => [row, ...cur]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings" },
        (payload) => setRows((cur) => cur.map((r) => (r.id === (payload.new as ListingView).id ? (payload.new as ListingView) : r))))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))].sort(), [rows]);
  // Tab counts reflect hideDismissed only — not category/score/source — so each tab shows what's inside it before secondary filters narrow things further.
  const categoryCounts = useMemo(() => {
    const base = sortAndFilter(rows, { hideDismissed: filter.hideDismissed });
    const counts: Record<(typeof CATEGORIES)[number]["value"], number> = { all: base.length, studio: 0, shared: 0, other: 0 };
    for (const r of base) counts[typeCategory(r.type)]++;
    return counts;
  }, [rows, filter.hideDismissed]);
  const view = useMemo(() => sortAndFilter(rows, filter), [rows, filter]);
  const twins = useMemo(() => {
    const m = new Map<string, ListingView>();
    for (const r of rows) {
      const t = linkByAddress(r, rows);
      if (t) m.set(r.id, t);
    }
    return m;
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
      {/* Type-category tabs — primary navigation, bigger and full-width so it reads as the top-level split */}
      <div role="group" aria-label="listing type" className="mb-3 flex rounded-(--radius-control) border border-line bg-surface p-1">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter((f) => ({ ...f, category: value }))}
            aria-pressed={(filter.category ?? "all") === value}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
              (filter.category ?? "all") === value ? "bg-bg text-ink shadow-(--shadow-card)" : "text-muted hover:text-ink"
            }`}
          >
            {label} ({categoryCounts[value]})
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Score steps as segmented pills — the filter used most, one tap away */}
        <div role="group" aria-label="minimum score" className="flex rounded-(--radius-control) border border-line bg-surface p-0.5">
          {SCORE_STEPS.map(({ value, label }) => (
            <button
              key={label}
              onClick={() => setFilter((f) => ({ ...f, minScore: value }))}
              aria-pressed={filter.minScore === value}
              className={`min-h-9 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                filter.minScore === value ? "bg-bg text-ink shadow-(--shadow-card)" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sources.length > 1 && (
          <select
            aria-label="source"
            className="min-h-9 rounded-(--radius-control) border border-line bg-surface px-2 text-sm text-ink"
            onChange={(e) => setFilter((f) => ({ ...f, source: e.target.value || undefined }))}
          >
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <label className="inline-flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-(--radius-control) px-2 text-sm text-muted hover:text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-(--primary)"
            checked={filter.hideDismissed ?? false}
            onChange={(e) => setFilter((f) => ({ ...f, hideDismissed: e.target.checked }))}
          />
          Hide dismissed
        </label>

        <span className="ml-auto text-sm tabular-nums text-muted" aria-live="polite">
          {view.length} {view.length === 1 ? "listing" : "listings"}
        </span>
      </div>

      {view.length === 0 ? (
        <div className="mx-auto max-w-md rounded-(--radius-card) border border-dashed border-line bg-surface/50 p-8 text-center">
          <div className="mb-2 text-3xl" aria-hidden>🔭</div>
          <p className="font-medium">No matches here right now</p>
          <p className="mt-1 text-sm text-muted">
            The scrapers check Roomspot every 5 minutes and Pararius every 15 —
            new matches appear here instantly and ping your phone.
            {filter.minScore || filter.source || (filter.category && filter.category !== "all") ? " Try loosening the filters above." : ""}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {view.map((l) => (
            <ListingCard key={l.id} listing={l} fresh={freshIds.current.has(l.id)} twin={twins.get(l.id) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
