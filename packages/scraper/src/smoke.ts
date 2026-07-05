import { roomspotAdapter, parariusAdapter, kamernetAdapter } from "@rf/adapters";
import { matchesCriteria, scoreListing } from "@rf/core";
import type { SourceAdapter } from "@rf/core";

const adapters: Record<string, SourceAdapter> = {
  roomspot: roomspotAdapter,
  pararius: parariusAdapter,
  kamernet: kamernetAdapter,
};
const name = process.argv[2] ?? "";
const adapter = adapters[name];
if (!adapter) {
  console.error(`unknown adapter: "${name}" — available: ${Object.keys(adapters).join(", ")}`);
  process.exit(1);
}

const listings = await adapter.fetchListings({ fetch });
const matches = listings.filter((l) => matchesCriteria(l).pass);
console.log(`${adapter.name}: ${listings.length} listings, ${matches.length} match`);
for (const m of matches.slice(0, 10)) {
  console.log(`  [${scoreListing(m)}] €${m.price} ${m.type} — ${m.title} — ${m.url}`);
}
