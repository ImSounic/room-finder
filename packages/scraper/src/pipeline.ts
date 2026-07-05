import { matchesCriteria, scoreListing, addressKey, type Listing, type RawListing } from "@rf/core";

export function processListings(source: string, raws: RawListing[]): Listing[] {
  return raws
    .map((r) => ({
      ...r, source, score: scoreListing(r),
      isMatch: matchesCriteria(r).pass,
      // Prefer the adapter's clean street; else assume "Street N, City" titles (true for
      // kamernet/kamer/pararius — NOT for sentence-style titles, which must set streetAddress).
      addressKey: addressKey((r.streetAddress ?? r.title.split(",")[0]) || null, r.postalcode),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Re-derive isMatch + score from a listing's current fields. Needed after
 *  enrichment, since detail-page data (e.g. Kamernet's bathroom/kitchen
 *  facility text) can change `type`, which feeds matchesCriteria/scoreListing. */
export function recomputeMatch(l: Listing): Listing {
  return { ...l, isMatch: matchesCriteria(l).pass, score: scoreListing(l) };
}
