import { matchesCriteria, scoreListing, addressKey, type Listing, type RawListing } from "@rf/core";

export function processListings(source: string, raws: RawListing[]): Listing[] {
  return raws
    .filter((r) => matchesCriteria(r).pass)
    .map((r) => ({
      ...r, source, score: scoreListing(r),
      // Prefer the adapter's clean street; else assume "Street N, City" titles (true for
      // roomspot/kamernet/kamer/pararius — NOT for sentence-style titles, which must set streetAddress).
      addressKey: addressKey((r.streetAddress ?? r.title.split(",")[0]) || null, r.postalcode),
    }))
    .sort((a, b) => b.score - a.score);
}
