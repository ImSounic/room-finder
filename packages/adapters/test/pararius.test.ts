import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePararius } from "../src/pararius.js";

const html = readFileSync(new URL("../fixtures/pararius.html", import.meta.url), "utf8");

describe("parsePararius", () => {
  const listings = parsePararius(html);
  it("extracts listing cards", () => expect(listings.length).toBeGreaterThan(0));
  it("maps core fields", () => {
    for (const l of listings) {
      expect(l.externalId.length).toBeGreaterThan(4);
      expect(l.url).toMatch(/^https:\/\/www\.pararius\.nl\//);
      expect(l.title.length).toBeGreaterThan(3);
    }
  });
  it("parses at least half the prices", () => {
    const priced = listings.filter((l) => l.price !== null);
    expect(priced.length).toBeGreaterThanOrEqual(listings.length / 2);
    for (const l of priced) expect(l.price).toBeGreaterThan(100);
  });
});
