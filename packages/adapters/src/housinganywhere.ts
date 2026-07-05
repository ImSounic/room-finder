import type { Furnished, RawListing, SourceAdapter, UnitType } from "@rf/core";

// Verified 2026-07-05 against a live fixture: HousingAnywhere's search page is
// a client-rendered React app, but the plain (SSR'd) HTML response already
// embeds the full search result set as a JSON-stringified blob assigned to
// `window.__staticRouterHydrationData` (a React Router `JSON.parse("...")`
// hydration payload). That blob's `loaderData["0-22"].listings` array carries
// every visible result card (price, city, street, unit type, dates, ids) —
// it covers ALL 8 results seen on the page, so no other source (ld+json is
// just an aggregate summary with offerCount/lowPrice/highPrice, no per-listing
// data; there's no separate XHR/API call for the results) was needed. Plain
// Node `fetch` with a browser UA returns 200 with this data present (verified
// against curl and Node fetch both), so this adapter is "http", not "browser".
//
// Search URL covers Enschede + surrounding area (Hengelo, Gronau DE were both
// observed in the live fixture) — filtered to city === "Enschede" below.
const SEARCH_URL = "https://housinganywhere.com/s/Enschede--Netherlands";
const BASE = "https://housinganywhere.com";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

interface HaListing {
  internalID?: number;
  id?: number;
  path?: string;
  unitTypePath?: string;
  city?: string;
  street?: string;
  propertyType?: string;
  priceEUR?: number | null;
  currency?: string;
  utilities?: string;
  facility_bedroom_furnished?: string;
  dateFrom?: string;
  countryCode?: string;
}

// Verified 2026-07-05 against the live fixture: propertyType values observed
// were PRIVATE_ROOM, SHARED_ROOM, APARTMENT (no STUDIO example in this
// sample); mapped conservatively, unknown values fall back to "unknown".
function mapType(propertyType: string | undefined): UnitType {
  switch ((propertyType ?? "").toUpperCase()) {
    case "STUDIO":
      return "studio";
    case "APARTMENT":
      return "apartment";
    case "PRIVATE_ROOM":
      return "room-private-bath";
    case "SHARED_ROOM":
      return "room-shared";
    default:
      return "unknown";
  }
}

// Verified 2026-07-05: facility_bedroom_furnished is "yes"/"no" on every
// sampled listing; no "semi"/partial value observed, so anything else maps
// to "unknown" rather than guessed.
function mapFurnished(f: string | undefined): Furnished {
  const v = (f ?? "").toLowerCase();
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  return "unknown";
}

// utilities: single-letter code observed as "I" (included) on every sampled
// listing; no "excl" example seen. Only report "incl" for the known code —
// anything else (including absence) stays "unknown" rather than guessed.
function mapBills(u: string | undefined): "incl" | "excl" | "unknown" {
  if (u === "I") return "incl";
  return "unknown";
}

// dateFrom uses "0001-01-01T00:00:00Z" as a sentinel for "no date set".
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  if (m[1] === "0001" || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function titleize(l: HaListing): string {
  const kind =
    l.propertyType === "APARTMENT"
      ? "Apartment"
      : l.propertyType === "STUDIO"
        ? "Studio"
        : l.propertyType === "SHARED_ROOM"
          ? "Shared room"
          : l.propertyType === "PRIVATE_ROOM"
            ? "Private room"
            : "Listing";
  const street = l.street ? ` on ${l.street}` : "";
  const city = l.city ? `, ${l.city}` : "";
  return `${kind}${street}${city}`.trim();
}

// Extract the JSON string assigned to window.__staticRouterHydrationData.
// It's rendered as `JSON.parse("...")`, i.e. a JS string literal containing
// escaped JSON — so this needs two parse passes: unescape the string literal,
// then parse the resulting JSON text.
function extractHydrationListings(html: string): HaListing[] {
  const marker = "window.__staticRouterHydrationData = JSON.parse(";
  const idx = html.indexOf(marker);
  if (idx === -1) return [];
  const litStart = idx + marker.length;
  if (html[litStart] !== '"') return [];

  // Walk the JS string literal to find its closing (unescaped) quote.
  let i = litStart + 1;
  while (i < html.length) {
    const c = html[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === '"') break;
    i += 1;
  }
  if (i >= html.length) return []; // never found a closing quote — malformed

  const literal = html.slice(litStart, i + 1);
  let jsonText: string;
  try {
    jsonText = JSON.parse(literal);
  } catch {
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const out: HaListing[] = [];
  try {
    if (!data || typeof data !== "object") return [];
    const loaderData = (data as Record<string, unknown>).loaderData;
    if (!loaderData || typeof loaderData !== "object") return [];
    // Depth-cap: loaderData is a flat map of route-id -> route data, so we
    // only need to walk one level deep to find a "listings" array — but stay
    // defensive with a depth guard in case the shape shifts.
    const walk = (o: unknown, depth: number): void => {
      if (depth > 6) return;
      if (Array.isArray(o)) return; // arrays here are never the container we want
      if (o && typeof o === "object") {
        const rec = o as Record<string, unknown>;
        if (Array.isArray(rec.listings)) {
          for (const item of rec.listings) {
            if (item && typeof item === "object") out.push(item as HaListing);
          }
        }
        for (const v of Object.values(rec)) {
          if (v && typeof v === "object" && !Array.isArray(v)) walk(v, depth + 1);
        }
      }
    };
    walk(loaderData, 0);
  } catch {
    return out; // fail-open with whatever was collected so far
  }
  return out;
}

export function parseHousingAnywhere(html: string): RawListing[] {
  if (!html) return [];
  let raw: HaListing[];
  try {
    raw = extractHydrationListings(html);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: RawListing[] = [];
  for (const l of raw) {
    try {
      if ((l.city ?? "").toLowerCase() !== "enschede") continue; // search includes nearby cities (Hengelo, Gronau DE)
      const idNum = l.internalID ?? l.id;
      if (idNum == null) continue;
      const externalId = String(idNum);
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      const pathname = l.unitTypePath ?? l.path;
      if (!pathname) continue;
      let url: string;
      try {
        url = new URL(pathname, BASE).toString();
      } catch {
        continue; // malformed path
      }

      const title = titleize(l);
      if (!title) continue;

      // Only trust priceEUR when currency is EUR (or unspecified — priceEUR
      // is HA's own normalized field, but skip if a non-EUR currency is
      // explicitly present without a priceEUR to be safe).
      const currency = (l.currency ?? "EUR").toUpperCase();
      const price = currency === "EUR" && typeof l.priceEUR === "number" ? Math.round(l.priceEUR) : null;

      out.push({
        externalId,
        url,
        title,
        price,
        bills: mapBills(l.utilities),
        type: mapType(l.propertyType),
        furnished: mapFurnished(l.facility_bedroom_furnished),
        area: l.street ?? null,
        streetAddress: l.street ?? null,
        postalcode: null, // not present in the search payload
        availableFrom: normalizeDate(l.dateFrom),
        contact: null, // on-platform messaging only
        raw: l,
      });
    } catch {
      // isolate a single malformed listing from the rest
      continue;
    }
  }
  return out;
}

export const housingAnywhereAdapter: SourceAdapter = {
  name: "housinganywhere",
  kind: "http",
  async fetchListings(ctx) {
    const res = await ctx.fetch(SEARCH_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`housinganywhere HTTP ${res.status}`);
    return parseHousingAnywhere(await res.text());
  },
};
