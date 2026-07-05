import { CAMPUS_ZONES, CRITERIA } from "./config.js";
import type { RawListing } from "./types.js";

const TYPE_POINTS: Record<RawListing["type"], number> = {
  studio: 30, apartment: 30, "room-private-bath": 15, "room-shared": 0, unknown: 5,
};
const FURNISHED_POINTS: Record<RawListing["furnished"], number> = {
  yes: 15, semi: 7, no: 0, unknown: 0,
};
const BILLS_POINTS: Record<RawListing["bills"], number> = { incl: 10, excl: 0, unknown: 3 };

function zonePoints(l: RawListing): number {
  const hay = `${l.area ?? ""} ${l.postalcode ?? ""} ${l.title}`.toLowerCase();
  if (CAMPUS_ZONES.onCampus.some((k) => hay.includes(k))) return 25;
  if (CAMPUS_ZONES.nearCampus.some((k) => hay.includes(k))) return 15;
  return 0;
}

function pricePoints(price: number | null): number {
  if (price === null) return 0;
  return Math.max(0, Math.min(30, (CRITERIA.maxPrice - price) / 15));
}

export function scoreListing(l: RawListing): number {
  const total = TYPE_POINTS[l.type] + FURNISHED_POINTS[l.furnished] +
    BILLS_POINTS[l.bills] + zonePoints(l) + pricePoints(l.price);
  return Math.round(Math.max(0, Math.min(100, total)));
}
