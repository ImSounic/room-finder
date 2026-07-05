import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKamer } from "../src/kamer.js";

const html = readFileSync(new URL("../fixtures/kamer.html", import.meta.url), "utf8");

describe("parseKamer", () => {
  const listings = parseKamer(html);
  it("extracts listing cards", () => expect(listings.length).toBeGreaterThan(0));
  it("maps core fields", () => {
    for (const l of listings) {
      expect(l.externalId.length).toBeGreaterThan(2);
      expect(l.url).toMatch(/^https:\/\/www\.kamer\.nl\//);
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
  it("returns [] for empty / non-HTML input", () => {
    expect(parseKamer("")).toEqual([]);
    expect(parseKamer("not html")).toEqual([]);
  });
  it("skips card with no listing link", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><p class="font-bold md:text-lg flex-none">€ 500 p/m</p></div></div>';
    expect(parseKamer(html)).toEqual([]);
  });
  it("skips card with link but empty title text", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><a href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">   </p></div></div>';
    expect(parseKamer(html)).toEqual([]);
  });
  it("skips card with no id attribute", () => {
    const html =
      '<div class="search-results-list"><div class="group"><a href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">Teststraat, Enschede</p></div></div>';
    expect(parseKamer(html)).toEqual([]);
  });
  it("resolves data-href when href is absent", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><a data-href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">Teststraat, Enschede</p></div></div>';
    const listings = parseKamer(html);
    expect(listings.length).toBe(1);
    expect(listings[0].url).toBe("https://www.kamer.nl/huren/huurwoning-enschede/teststraat/123/");
  });
  it("handles unparseable price and returns null with bills=unknown", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><a href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">Teststraat, Enschede</p><p class="font-bold md:text-lg flex-none">Prijs op aanvraag</p></div></div>';
    const listings = parseKamer(html);
    expect(listings.length).toBe(1);
    expect(listings[0].price).toBeNull();
    expect(listings[0].bills).toBe("unknown");
  });
  it("parses thousands separator in price", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><a href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">Teststraat, Enschede</p><p class="font-bold md:text-lg flex-none">€ 1.250 p/m</p></div></div>';
    const listings = parseKamer(html);
    expect(listings.length).toBe(1);
    expect(listings[0].price).toBe(1250);
  });
  it("detects furnished from description text", () => {
    const html =
      '<div class="search-results-list"><div id="123" class="group"><a href="/huren/huurwoning-enschede/teststraat/123/"></a><p class="font-bold md:text-lg overflow-hidden">Teststraat, Enschede</p><p class="leading-7">Een gemeubileerde kamer te huur</p></div></div>';
    const listings = parseKamer(html);
    expect(listings.length).toBe(1);
    expect(listings[0].furnished).toBe("yes");
  });
});
