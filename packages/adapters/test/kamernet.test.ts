import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKamernet } from "../src/kamernet.js";

const html = readFileSync(new URL("../fixtures/kamernet.html", import.meta.url), "utf8");

describe("parseKamernet", () => {
  const listings = parseKamernet(html);
  it("extracts Enschede listings with numeric external ids", () => {
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l.externalId).toMatch(/^\d+$/);
      expect(l.url).toContain("kamernet.nl");
    }
  });
  it("maps price and bills flag", () => {
    const priced = listings.filter((l) => l.price !== null);
    expect(priced.length).toBeGreaterThan(0);
    for (const l of priced) {
      expect(l.price).toBeGreaterThan(100);
      expect(["incl", "excl", "unknown"]).toContain(l.bills);
    }
  });
  it("dedupes repeated ids (topAdListings overlap)", () => {
    const ids = listings.map((l) => l.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns [] for junk / missing NEXT_DATA", () => {
    expect(parseKamernet("")).toEqual([]);
    expect(parseKamernet("<html>no data</html>")).toEqual([]);
  });
});
