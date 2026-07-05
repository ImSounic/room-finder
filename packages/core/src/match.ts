import { CRITERIA } from "./config.js";
import type { RawListing } from "./types.js";

export interface MatchResult { pass: boolean; reasons: string[]; }

export function matchesCriteria(l: RawListing): MatchResult {
  const reasons: string[] = [];
  if (l.type !== "unknown" && !(CRITERIA.acceptedTypes as readonly string[]).includes(l.type)) {
    reasons.push(`type ${l.type} not accepted`);
  }
  if (l.price !== null && (l.price < CRITERIA.minPrice || l.price > CRITERIA.maxPrice)) {
    reasons.push(`price ${l.price} outside ${CRITERIA.minPrice}-${CRITERIA.maxPrice}`);
  }
  if (l.availableFrom !== null && l.availableFrom > CRITERIA.moveInDeadline) {
    reasons.push(`available ${l.availableFrom} after deadline`);
  }
  return { pass: reasons.length === 0, reasons };
}
