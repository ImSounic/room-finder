import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseHousingAnywhere } from "../src/housinganywhere.js";

const fixture = readFileSync(new URL("../fixtures/housinganywhere.html", import.meta.url), "utf8");

describe("parseHousingAnywhere", () => {
  const listings = parseHousingAnywhere(fixture);
  it("extracts listings", () => expect(listings.length).toBeGreaterThan(0));
  it("maps core fields", () => {
    for (const l of listings) {
      expect(l.externalId.length).toBeGreaterThan(0);
      expect(l.url).toMatch(/^https:\/\/housinganywhere\.com\//);
      expect(l.title.length).toBeGreaterThan(2);
    }
  });
  it("parses at least half the prices", () => {
    const priced = listings.filter((l) => l.price !== null);
    expect(priced.length).toBeGreaterThanOrEqual(listings.length / 2);
    for (const l of priced) expect(l.price).toBeGreaterThan(100);
  });
});

describe("defensive parsing", () => {
  it("returns [] for empty / junk input", () => {
    expect(parseHousingAnywhere("")).toEqual([]);
    expect(parseHousingAnywhere("not html or json")).toEqual([]);
  });
});
