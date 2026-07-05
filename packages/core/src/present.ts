import type { Bills, Contact, UnitType, Furnished } from "./types.js";

/** Listing as the dashboard reads it: snake_case DB row shape (not the worker's camelCase Listing). */
export interface ListingView {
  id: string; source: string; url: string; title: string;
  price: number | null; bills: Bills; type: UnitType; furnished: Furnished;
  area: string | null; postalcode: string | null; available_from: string | null;
  score: number; contact: Contact | null; status: string; first_seen_at: string;
  address_key: string | null;
}

export function priceLabel(l: ListingView): string {
  if (l.price === null) return "price ?";
  if (l.bills === "incl") return `€${l.price} incl.`;
  if (l.bills === "excl") return `€${l.price} excl.`;
  return `€${l.price}`;
}

export interface ListingFilter { source?: string; minScore?: number; hideDismissed?: boolean; }

export function sortAndFilter(rows: ListingView[], f: ListingFilter): ListingView[] {
  return rows
    .filter((r) => (f.source ? r.source === f.source : true))
    .filter((r) => (f.minScore != null ? r.score >= f.minScore : true))
    .filter((r) => (f.hideDismissed ? r.status !== "dismissed" : true))
    .sort((a, b) => b.score - a.score || b.first_seen_at.localeCompare(a.first_seen_at));
}

export interface SourceRunLite { source: string; ok: boolean; total_found: number; new_matches: number; ran_at: string; }
export interface SourceHealth { source: string; ok: boolean; lastRun: string; totalFound: number; }

export function computeSourceHealth(runs: SourceRunLite[]): SourceHealth[] {
  const latest = new Map<string, SourceRunLite>();
  for (const r of runs) {
    const prev = latest.get(r.source);
    if (!prev || r.ran_at > prev.ran_at) latest.set(r.source, r);
  }
  return [...latest.values()].map((r) => ({
    source: r.source, ok: r.ok, lastRun: r.ran_at, totalFound: r.total_found,
  }));
}
