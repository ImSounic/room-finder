import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "./types.js";

export function supabaseFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface ListingRow {
  source: string; external_id: string; url: string; title: string;
  price: number | null; bills: string; type: string; furnished: string;
  area: string | null; postalcode: string | null; available_from: string | null;
  score: number; contact: unknown; raw: unknown;
}

function toRow(l: Listing): ListingRow {
  return {
    source: l.source, external_id: l.externalId, url: l.url, title: l.title,
    price: l.price, bills: l.bills, type: l.type, furnished: l.furnished,
    area: l.area, postalcode: l.postalcode, available_from: l.availableFrom,
    score: l.score, contact: l.contact, raw: l.raw,
  };
}

/** Insert listings; rows already present (source, external_id) are ignored.
 *  Returns ONLY the rows actually inserted — alert on exactly these. */
export async function insertNewListings(db: SupabaseClient, listings: Listing[]): Promise<ListingRow[]> {
  if (listings.length === 0) return [];
  const { data, error } = await db
    .from("listings")
    .upsert(listings.map(toRow), { onConflict: "source,external_id", ignoreDuplicates: true })
    .select();
  if (error) throw new Error(`insert failed: ${error.message}`);
  return (data ?? []) as ListingRow[];
}

export async function logSourceRun(db: SupabaseClient, run: {
  source: string; ok: boolean; total_found: number; new_matches: number; error?: string;
}): Promise<void> {
  await db.from("source_runs").insert(run);
}

/** True if the last `n` runs for this source all failed or found 0 listings. */
export async function isSourceUnhealthy(db: SupabaseClient, source: string, n = 3): Promise<boolean> {
  const { data } = await db.from("source_runs").select("ok,total_found")
    .eq("source", source).order("ran_at", { ascending: false }).limit(n);
  if (!data || data.length < n) return false;
  return data.every((r) => !r.ok || r.total_found === 0);
}
