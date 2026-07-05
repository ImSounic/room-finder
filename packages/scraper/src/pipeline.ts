import { matchesCriteria, scoreListing, addressKey, type Listing, type RawListing } from "@rf/core";

export function processListings(source: string, raws: RawListing[]): Listing[] {
  return raws
    .map((r) => ({
      ...r, source, score: scoreListing(r),
      isMatch: matchesCriteria(r).pass,
      // Prefer the adapter's clean street; else assume "Street N, City" titles (true for
      // roomspot/kamernet/kamer/pararius — NOT for sentence-style titles, which must set streetAddress).
      addressKey: addressKey((r.streetAddress ?? r.title.split(",")[0]) || null, r.postalcode),
    }))
    .sort((a, b) => b.score - a.score);
}
