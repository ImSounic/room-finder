import type { Furnished, RawListing, SourceAdapter, UnitType } from "@rf/core";

// Verified 2026-07-05: /en/for-rent/rooms-enschede 301-redirects to this slug.
const SEARCH = "https://kamernet.nl/en/for-rent/properties-enschede";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

interface KnListing {
  listingId: number;
  listingType: number;
  street: string;
  streetSlug: string;
  city: string;
  citySlug: string;
  totalRentalPrice: number | null;
  utilitiesIncluded: boolean;
  surfaceArea: number | null;
  availabilityStartDate: string | null;
  availabilityEndDate: string | null;
  furnishingId: number | null;
  isStudentHouseAdvert: boolean;
  isReactForFree: boolean;
  isTopAdvert: boolean;
}

// Verified 2026-07-05 against live detail pages: anchor hrefs on the search
// page use "room-{id}" and "apartment-{id}" slugs matching listingType 1 and
// 2 respectively (no "studio" slug observed in NL/Enschede or Amsterdam
// samples). Unknown numeric values fall back to "unknown" rather than guess.
function mapType(t: number): UnitType {
  if (t === 1) return "room-shared";
  if (t === 2) return "apartment";
  return "unknown";
}
// listingType 1 (room) maps to room-shared: the search payload has no bathroom
// info, so most Kamernet rooms won't clear the hard filter. Distinguishing
// private-bath rooms would need paywalled detail pages — deliberately not done.

// Verified 2026-07-05 by cross-referencing furnishingId against the rendered
// "<h6>...Room for rent</h6>" label on live detail pages:
//   furnishingId 1 -> "Uncarpeted" (no furniture)
//   furnishingId 2 -> "Unfurnished"
//   furnishingId 4 -> "Furnished"
// furnishingId 3 was never observed (Enschede + Amsterdam samples); treated
// as "unknown" rather than guessed.
function mapFurnished(f: number | null): Furnished {
  if (f === 4) return "yes";
  if (f === 1 || f === 2) return "no";
  return "unknown";
}

function typeSlug(t: number): string {
  return t === 2 ? "apartment" : "room";
}

function extractListings(html: string): KnListing[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out: KnListing[] = [];
  try {
    const walk = (o: unknown, depth: number = 0): void => {
      // Fail-open: stop walking past depth 20 to prevent stack overflow
      if (depth > 20) return;
      if (Array.isArray(o)) {
        o.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        // Tighten shape guard: require citySlug to be a string in addition to listingId/street
        if (
          typeof rec.listingId === "number" &&
          typeof rec.street === "string" &&
          typeof rec.citySlug === "string"
        ) {
          out.push(rec as unknown as KnListing);
        }
        Object.values(rec).forEach((item) => walk(item, depth + 1));
      }
    };
    walk(data);
  } catch {
    // Wrap entire walk in try-catch as fail-open: return what we have so far
    return out;
  }
  return out;
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw);
  return match ? match[0] : null;
}

export function parseKamernet(html: string): RawListing[] {
  const seen = new Set<number>();
  return extractListings(html)
    .filter((o) => o != null && typeof o === "object")
    .filter((o) => (o.citySlug ?? "").toLowerCase() === "enschede")
    .filter((o) => !!o.listingId && !!o.streetSlug)
    .filter((o) => {
      if (seen.has(o.listingId)) return false;
      seen.add(o.listingId);
      return true;
    })
    .map((o) => ({
      externalId: String(o.listingId),
      url: `https://kamernet.nl/en/for-rent/${typeSlug(o.listingType)}-enschede/${o.streetSlug}/${typeSlug(o.listingType)}-${o.listingId}`,
      title: `${o.street}, Enschede`,
      price: o.totalRentalPrice != null ? Math.round(o.totalRentalPrice) : null,
      bills: o.utilitiesIncluded ? ("incl" as const) : ("unknown" as const),
      type: mapType(o.listingType),
      furnished: mapFurnished(o.furnishingId),
      area: `${o.street}`,
      postalcode: null,
      availableFrom: normalizeDate(o.availabilityStartDate),
      contact: null,
      raw: o,
    }));
}

export const kamernetAdapter: SourceAdapter = {
  name: "kamernet",
  kind: "http",
  async fetchListings(ctx) {
    const res = await ctx.fetch(SEARCH, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`kamernet HTTP ${res.status}`);
    return parseKamernet(await res.text());
  },
};
