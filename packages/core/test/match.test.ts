import { describe, it, expect } from "vitest";
import { matchesCriteria } from "../src/match.js";
import type { RawListing } from "../src/types.js";

const base: RawListing = {
  externalId: "x1", url: "https://e.x/1", title: "Studio Enschede",
  price: 700, bills: "incl", type: "studio", furnished: "yes",
  area: "Enschede", postalcode: "7522 AB", availableFrom: "2026-08-01",
  contact: null, raw: {},
};

describe("matchesCriteria", () => {
  it("accepts a matching studio", () => expect(matchesCriteria(base).pass).toBe(true));
  it("accepts apartment and room-private-bath", () => {
    expect(matchesCriteria({ ...base, type: "apartment" }).pass).toBe(true);
    expect(matchesCriteria({ ...base, type: "room-private-bath" }).pass).toBe(true);
  });
  it("rejects fully shared rooms", () =>
    expect(matchesCriteria({ ...base, type: "room-shared" }).pass).toBe(false));
  it("accepts unknown type (never silently drop ambiguous)", () =>
    expect(matchesCriteria({ ...base, type: "unknown" }).pass).toBe(true));
  it("enforces price band boundaries", () => {
    expect(matchesCriteria({ ...base, price: 499 }).pass).toBe(false);
    expect(matchesCriteria({ ...base, price: 500 }).pass).toBe(true);
    expect(matchesCriteria({ ...base, price: 950 }).pass).toBe(true);
    expect(matchesCriteria({ ...base, price: 951 }).pass).toBe(false);
  });
  it("accepts null price (unparseable — keep visible)", () =>
    expect(matchesCriteria({ ...base, price: null }).pass).toBe(true));
  it("rejects availability after deadline, accepts on/before/unknown", () => {
    expect(matchesCriteria({ ...base, availableFrom: "2026-09-01" }).pass).toBe(false);
    expect(matchesCriteria({ ...base, availableFrom: "2026-08-17" }).pass).toBe(true);
    expect(matchesCriteria({ ...base, availableFrom: null }).pass).toBe(true);
  });
  it("gives reasons on rejection", () => {
    const r = matchesCriteria({ ...base, price: 1200, type: "room-shared" });
    expect(r.pass).toBe(false);
    expect(r.reasons.length).toBe(2);
  });
});
