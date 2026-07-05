import type { RawListing, SourceAdapter, UnitType } from "@rf/core";

const API = "https://www.roomspot.nl/portal/object/frontend/getallobjects/format/json";
// Verified 2026-07-05: detail pages live at /aanbod/te-huur/details/<urlKey>.
const DETAIL_BASE = "https://www.roomspot.nl/aanbod/te-huur/details/";

interface RsObject {
  id: string;
  urlKey: string;
  street: string;
  houseNumber: string;
  houseNumberAddition: string | null;
  postalcode: string;
  city: { name: string } | null;
  totalRent: number | null;
  netRent: number | null;
  dwellingType: { localizedName?: string } | null;
  isZelfstandig: boolean;
  availableFromDate: string | null;
  publicationDate: string | null;
  closingDate: string | null;
  infoveldKort: string | null;
  isGepubliceerd: boolean;
  rentBuy: string | null;
  specifiekeVoorzieningen?: unknown;
}

// Note: this API payload carries no free-text description or amenity labels
// (infoveldKort is always empty, specifiekeVoorzieningen are opaque numeric
// ids with no accompanying label). So "private bathroom" / "furnished" can't
// be derived from the feed today; those default to the safe "unknown"/
// "room-shared" values below rather than guessing.
function classify(o: RsObject): UnitType {
  const dt = (o.dwellingType?.localizedName ?? "").toLowerCase();
  if (o.isZelfstandig) {
    if (dt.includes("studio")) return "studio";
    if (dt.includes("kamer")) return "studio"; // zelfstandige kamer = private facilities
    return "apartment";
  }
  return "room-shared";
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(raw);
  return match ? match[0] : null;
}

export function parseRoomspot(payload: { result: RsObject[] }): RawListing[] {
  const items = Array.isArray(payload?.result) ? payload.result : [];
  return items
    .filter((o): o is RsObject => o != null && typeof o === "object")
    .filter((o) => o.isGepubliceerd !== false)
    .filter((o) => (o.rentBuy ?? "Huur").toLowerCase() !== "koop")
    .filter((o) => (o.city?.name ?? "").toLowerCase() === "enschede")
    .filter((o) => !!o.id && !!o.urlKey)
    .map((o) => ({
      externalId: String(o.id),
      url: `${DETAIL_BASE}${o.urlKey}`,
      title: `${o.street} ${o.houseNumber}${o.houseNumberAddition ? " " + o.houseNumberAddition : ""}, Enschede`,
      price: o.totalRent != null ? Math.round(o.totalRent) : null,
      bills: "unknown" as const, // totalRent includes service costs; utilities vary
      type: classify(o),
      furnished: "unknown" as const, // not present in this feed (see classify() note)
      area: `${o.street} (${o.postalcode})`,
      postalcode: o.postalcode ?? null,
      availableFrom: normalizeDate(o.availableFromDate),
      contact: null, // corporation portal — respond via site (Phase 3)
      raw: o,
    }));
}

export const roomspotAdapter: SourceAdapter = {
  name: "roomspot",
  kind: "http",
  async fetchListings(ctx) {
    const res = await ctx.fetch(API, {
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`roomspot HTTP ${res.status}`);
    return parseRoomspot(await res.json());
  },
};
