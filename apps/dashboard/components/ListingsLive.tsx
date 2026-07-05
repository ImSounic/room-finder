"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sortAndFilter, type ListingView, type ListingFilter } from "@rf/core";
import { ListingCard } from "./ListingCard";

export function ListingsLive({ initial }: { initial: ListingView[] }) {
  const [rows, setRows] = useState<ListingView[]>(initial);
  const [filter, setFilter] = useState<ListingFilter>({ hideDismissed: true });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("listings-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" },
        (payload) => setRows((cur) => [payload.new as ListingView, ...cur]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings" },
        (payload) => setRows((cur) => cur.map((r) => (r.id === (payload.new as ListingView).id ? (payload.new as ListingView) : r))))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))].sort(), [rows]);
  const view = useMemo(() => sortAndFilter(rows, filter), [rows, filter]);

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-2 mb-4 text-sm items-center">
        <select className="rounded border p-1 bg-transparent"
          onChange={(e) => setFilter((f) => ({ ...f, source: e.target.value || undefined }))}>
          <option value="">all sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="rounded border p-1 bg-transparent"
          onChange={(e) => setFilter((f) => ({ ...f, minScore: e.target.value ? Number(e.target.value) : undefined }))}>
          <option value="">any score</option>
          <option value="70">70+</option>
          <option value="80">80+</option>
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filter.hideDismissed ?? false}
            onChange={(e) => setFilter((f) => ({ ...f, hideDismissed: e.target.checked }))} />
          hide dismissed
        </label>
        <span className="ml-auto text-neutral-500">{view.length} shown</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {view.map((l) => <ListingCard key={l.id} listing={l} />)}
      </div>
    </div>
  );
}
