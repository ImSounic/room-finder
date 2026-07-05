import { describe, it, expect } from "vitest";
import { scoreListing } from "../src/score.js";
import type { RawListing } from "../src/types.js";

const base: RawListing = {
  externalId: "x", url: "u", title: "t", price: 950, bills: "unknown",
  type: "room-shared", furnished: "unknown", area: null, postalcode: null,
  availableFrom: null, contact: null, raw: {},
};

describe("scoreListing", () => {
  it("worst case scores ~0, best case ≥ 90", () => {
    expect(scoreListing(base)).toBeLessThanOrEqual(5);
    expect(scoreListing({ ...base, type: "studio", furnished: "yes", bills: "incl",
      price: 600, postalcode: "7522 NB", area: "Calslaan" })).toBeGreaterThanOrEqual(90);
  });
  it("type points: studio/apartment 30, private bath 15", () => {
    const shared = scoreListing(base);
    expect(scoreListing({ ...base, type: "studio" }) - shared).toBe(30);
    expect(scoreListing({ ...base, type: "apartment" }) - shared).toBe(30);
    expect(scoreListing({ ...base, type: "room-private-bath" }) - shared).toBe(15);
  });
  it("campus zones: on-campus +25 beats near-campus +15", () => {
    const none = scoreListing(base);
    expect(scoreListing({ ...base, area: "Witbreuksweg 401" }) - none).toBe(25);
    expect(scoreListing({ ...base, area: "Roombeek" }) - none).toBe(15);
    expect(scoreListing({ ...base, postalcode: "7522 AB" }) - none).toBe(25);
  });
  it("cheaper is better, capped at 30", () => {
    expect(scoreListing({ ...base, price: 500 })).toBe(scoreListing(base) + 30);
    expect(scoreListing({ ...base, price: null })).toBe(scoreListing(base));
  });
  it("clamps to 0-100", () => {
    const best = { ...base, type: "studio" as const, furnished: "yes" as const,
      bills: "incl" as const, price: 500, area: "Campuslaan", postalcode: "7522 AA" };
    expect(scoreListing(best)).toBeLessThanOrEqual(100);
  });
});
