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
  score: number; contact: unknown; raw: unknown; address_key: string | null;
  is_match: boolean;
}

function toRow(l: Listing): ListingRow {
  return {
    source: l.source, external_id: l.externalId, url: l.url, title: l.title,
    price: l.price, bills: l.bills, type: l.type, furnished: l.furnished,
    area: l.area, postalcode: l.postalcode, available_from: l.availableFrom,
    score: l.score, contact: l.contact, raw: l.raw, address_key: l.addressKey ?? null,
    is_match: l.isMatch,
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

/** Which of these external_ids already exist in `listings` for this source.
 *  Used to enrich only listings new to the DB (first sighting), once. */
export async function existingExternalIds(db: SupabaseClient, source: string, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const CHUNK = 100; // keep each PostgREST GET well under its URL-length limit
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await db.from("listings").select("external_id").eq("source", source).in("external_id", slice);
    if (error) { console.error(`existingExternalIds query failed: ${error.message}`); continue; }
    for (const r of data ?? []) found.add((r as { external_id: string }).external_id);
  }
  return found;
}

export async function logSourceRun(db: SupabaseClient, run: {
  source: string; ok: boolean; total_found: number; new_matches: number; error?: string;
}): Promise<void> {
  const { error } = await db.from("source_runs").insert(run);
  if (error) console.error(`source_runs insert failed: ${error.message}`);
}

/** True only at the MOMENT a source crosses into failure: the last `n` runs all errored
 *  (ok === false) AND the run just before that streak was ok (or there is no earlier run).
 *  A successful run that found 0 listings is healthy — some sources are legitimately empty,
 *  so total_found is intentionally ignored here. Edge-triggered so we warn once per outage,
 *  not every cron tick. */
export async function justBecameUnhealthy(db: SupabaseClient, source: string, n = 3): Promise<boolean> {
  if (n <= 0) return false;
  const { data, error } = await db.from("source_runs").select("ok,ran_at")
    .eq("source", source).order("ran_at", { ascending: false }).limit(n + 1);
  if (error) { console.error(`justBecameUnhealthy query failed: ${error.message}`); return false; }
  if (!data || data.length < n) return false;
  const recent = data.slice(0, n);
  if (!recent.every((r) => (r as { ok: boolean }).ok === false)) return false; // need n consecutive failures
  const prior = data[n] as { ok: boolean } | undefined;                        // run just before the streak
  return !prior || prior.ok === true;                                          // fire only on the transition
}

export async function getActivePushSubscriptions(db: SupabaseClient): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }[]> {
  const { data, error } = await db.from("push_subscriptions").select("endpoint,keys");
  if (error) { console.error(`push_subscriptions query failed: ${error.message}`); return []; }
  return (data ?? []) as { endpoint: string; keys: { p256dh: string; auth: string } }[];
}

export async function deletePushSubscriptions(db: SupabaseClient, endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const { error } = await db.from("push_subscriptions").delete().in("endpoint", endpoints);
  if (error) console.error(`push_subscriptions delete failed: ${error.message}`);
}
