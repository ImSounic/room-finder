import { matchesCriteria, scoreListing, type Listing, type RawListing } from "@rf/core";

export function processListings(source: string, raws: RawListing[]): Listing[] {
  return raws
    .filter((r) => matchesCriteria(r).pass)
    .map((r) => ({ ...r, source, score: scoreListing(r) }))
    .sort((a, b) => b.score - a.score);
}
