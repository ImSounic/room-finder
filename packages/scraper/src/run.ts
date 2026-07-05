import { roomspotAdapter, parariusAdapter, kamernetAdapter, kamerAdapter, housingAnywhereAdapter } from "@rf/adapters";
import { buildAlertPayload, sendDiscord, buildPushPayload, sendPush, deadEndpoints } from "@rf/notifier";
import {
  insertNewListings,
  isSourceUnhealthy,
  logSourceRun,
  supabaseFromEnv,
  getActivePushSubscriptions,
  deletePushSubscriptions,
} from "@rf/core";
import type { SourceAdapter } from "@rf/core";
import { processListings } from "./pipeline.js";

// Discord webhook rate limit headroom (~30 req/min): pace the backfill burst
const ALERT_DELAY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALL: SourceAdapter[] = [roomspotAdapter, parariusAdapter, kamernetAdapter, kamerAdapter, housingAnywhereAdapter];
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
    const matches = processListings(adapter.name, raws);
    const enriched = adapter.enrichMatches ? await adapter.enrichMatches(matches) : matches;
    const inserted = await insertNewListings(db, enriched);
    // Alert ONLY on rows that were actually new (race-proof across overlapping runs)
    const byId = new Map(enriched.map((m) => [m.externalId, m]));
    for (const row of inserted) {
      const listing = byId.get(row.external_id);
      if (listing) {
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
    // Web push to the dashboard (same new listings). No-op if no subscriptions / VAPID unset.
    if (inserted.length > 0) {
      const subs = await getActivePushSubscriptions(db);
      if (subs.length > 0) {
        for (const row of inserted) {
          const listing = byId.get(row.external_id);
          if (!listing) continue;
          const results = await sendPush(subs, buildPushPayload(listing));
          const dead = deadEndpoints(results);
          if (dead.length > 0) await deletePushSubscriptions(db, dead);
        }
      }
    }
    await logSourceRun(db, { source: adapter.name, ok: true,
      total_found: raws.length, new_matches: inserted.length,
      ...(alertFailures > 0 ? { error: `${alertFailures} alert(s) failed to send` } : {}) });
    console.log(`${adapter.name}: ${raws.length} found, ${matches.length} match, ` +
      `${inserted.length} new (${Date.now() - started}ms)` +
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

if (adapterFailures > 0) process.exitCode = 1;
