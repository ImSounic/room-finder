import { parariusAdapter, kamernetAdapter, kamerAdapter, housingAnywhereAdapter } from "@rf/adapters";
import { buildAlertPayload, sendDiscord, buildPushPayload, sendPush, deadEndpoints } from "@rf/notifier";
import {
  insertNewListings,
  isSourceUnhealthy,
  logSourceRun,
  supabaseFromEnv,
  getActivePushSubscriptions,
  deletePushSubscriptions,
  existingExternalIds,
} from "@rf/core";
import type { SourceAdapter } from "@rf/core";
import { processListings } from "./pipeline.js";

// Discord webhook rate limit headroom (~30 req/min): pace the backfill burst
const ALERT_DELAY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALL: SourceAdapter[] = [parariusAdapter, kamernetAdapter, kamerAdapter, housingAnywhereAdapter];
const laneIdx = process.argv.indexOf("--lane");
const lane = laneIdx !== -1 ? process.argv[laneIdx + 1] : null; // 'http' | 'browser' | null = all
const adapters = lane ? ALL.filter((a) => a.kind === lane) : ALL;

let db;
try {
  db = supabaseFromEnv();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("startup failed: " + msg);
  if (process.env.DISCORD_WEBHOOK_URL) {
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `🛑 room-finder worker failed to start: ${msg}` }),
    }).catch(() => {});
  }
  process.exit(1);
}

let adapterFailures = 0;

for (const adapter of adapters) {
  const started = Date.now();
  let alertFailures = 0;
  try {
    const raws = await adapter.fetchListings({ fetch });
    const processed = processListings(adapter.name, raws);
    const matches = processed.filter((l) => l.isMatch);
    // Enrich only listings new to the DB, once, regardless of match (contact never changes → never re-fetch).
    if (adapter.enrichListings) {
      const known = await existingExternalIds(db, adapter.name, processed.map((l) => l.externalId));
      const fresh = processed.filter((l) => !known.has(l.externalId));
      if (fresh.length > 0) {
        const enriched = await adapter.enrichListings(fresh);
        const byExt = new Map(enriched.map((l) => [l.externalId, l]));
        for (let i = 0; i < processed.length; i++) {
          const e = byExt.get(processed[i].externalId);
          if (e) processed[i] = e;
        }
      }
    }
    const inserted = await insertNewListings(db, processed);
    // Alert ONLY on rows that were actually new (race-proof across overlapping runs) AND match criteria
    const byId = new Map(processed.map((m) => [m.externalId, m]));
    for (const row of inserted) {
      const listing = byId.get(row.external_id);
      if (listing && listing.isMatch) {
        try {
          await sendDiscord(buildAlertPayload(listing));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`${adapter.name} alert failed: ${msg}`);
          alertFailures++;
        }
        await sleep(ALERT_DELAY_MS);
      }
    }
    // Web push to the dashboard (same new matching listings). No-op if no subscriptions / VAPID unset.
    if (inserted.length > 0) {
      const subs = await getActivePushSubscriptions(db);
      if (subs.length > 0) {
        for (const row of inserted) {
          const listing = byId.get(row.external_id);
          if (!listing || !listing.isMatch) continue;
          const results = await sendPush(subs, buildPushPayload(listing));
          const dead = deadEndpoints(results);
          if (dead.length > 0) await deletePushSubscriptions(db, dead);
        }
      }
    }
    const insertedMatches = inserted.filter((row) => byId.get(row.external_id)?.isMatch).length;
    await logSourceRun(db, { source: adapter.name, ok: true,
      total_found: raws.length, new_matches: insertedMatches,
      ...(alertFailures > 0 ? { error: `${alertFailures} alert(s) failed to send` } : {}) });
    console.log(`${adapter.name}: ${raws.length} found, ${matches.length} match, ` +
      `${inserted.length} new (${insertedMatches} matching) (${Date.now() - started}ms)` +
      (alertFailures > 0 ? ` [${alertFailures} alert(s) failed]` : ""));
  } catch (err) {
    adapterFailures++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${adapter.name} FAILED: ${msg}`);
    await logSourceRun(db, { source: adapter.name, ok: false,
      total_found: 0, new_matches: 0, error: msg.slice(0, 500) });
  }
  try {
    if (await isSourceUnhealthy(db, adapter.name)) {
      await sendDiscord({ content: `⚠️ **${adapter.name}** returned nothing/failed 3 runs in a row — adapter may be broken.` })
        .catch(() => {});
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`health check failed for ${adapter.name}: ${msg}`);
  }
}

// Red the workflow only if EVERY adapter failed (systemic). A single transient
// source failure is expected for best-effort scraping — the per-source health
// check (Discord) is the real signal.
if (adapterFailures > 0 && adapterFailures === adapters.length) process.exitCode = 1;
