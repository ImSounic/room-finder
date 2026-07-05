import { roomspotAdapter, parariusAdapter } from "@rf/adapters";
import { buildAlertPayload, sendDiscord } from "@rf/notifier";
import { insertNewListings, isSourceUnhealthy, logSourceRun, supabaseFromEnv } from "@rf/core";
import type { SourceAdapter } from "@rf/core";
import { processListings } from "./pipeline.js";

// Discord webhook rate limit headroom (~30 req/min): pace the backfill burst
const ALERT_DELAY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALL: SourceAdapter[] = [roomspotAdapter, parariusAdapter];
const laneIdx = process.argv.indexOf("--lane");
const lane = laneIdx !== -1 ? process.argv[laneIdx + 1] : null; // 'http' | 'browser' | null = all
const adapters = lane ? ALL.filter((a) => a.kind === lane) : ALL;

const db = supabaseFromEnv();

for (const adapter of adapters) {
  const started = Date.now();
  try {
    const raws = await adapter.fetchListings({ fetch });
    const matches = processListings(adapter.name, raws);
    const inserted = await insertNewListings(db, matches);
    // Alert ONLY on rows that were actually new (race-proof across overlapping runs)
    const byId = new Map(matches.map((m) => [m.externalId, m]));
    for (const row of inserted) {
      const listing = byId.get(row.external_id);
      if (listing) {
        await sendDiscord(buildAlertPayload(listing));
        await sleep(ALERT_DELAY_MS);
      }
    }
    await logSourceRun(db, { source: adapter.name, ok: true,
      total_found: raws.length, new_matches: inserted.length });
    console.log(`${adapter.name}: ${raws.length} found, ${matches.length} match, ` +
      `${inserted.length} new (${Date.now() - started}ms)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${adapter.name} FAILED: ${msg}`);
    await logSourceRun(db, { source: adapter.name, ok: false,
      total_found: 0, new_matches: 0, error: msg.slice(0, 500) });
  }
  if (await isSourceUnhealthy(db, adapter.name)) {
    await sendDiscord({ content: `⚠️ **${adapter.name}** returned nothing/failed 3 runs in a row — adapter may be broken.` })
      .catch(() => {});
  }
}
