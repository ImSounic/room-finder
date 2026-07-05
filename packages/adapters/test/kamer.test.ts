import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKamer, parseKamerContact } from "../src/kamer.js";

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
  it("keeps only Enschede listings (drops nearby-city suggestion cards)", () => {
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l.url).toMatch(/\/huren\/huurwoning-enschede\//);
    }
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

describe("parseKamerContact", () => {
  // Verified against live detail-page fixtures (see fixtures/kamer-detail.html,
  // captured 2026-07-05 from three different Enschede listings): kamer.nl does
  // not render a broker/agency name or phone anywhere on the detail page —
  // there is no `tel:` link on the page at all, and the only "aangeboden door"
  // strings in the markup belong to the Cookiebot consent dialog boilerplate
  // (cookie-provider disclosures), not a listing agent block. Contact happens
  // exclusively via kamer.nl's own "reageren" (respond) lead form. So the
  // realistic behavior today is: real detail pages parse to null, same as
  // synthetic HTML with no contact block.
  it("returns null for a real detail page (kamer.nl exposes no public broker contact)", () => {
    const detail = readFileSync(new URL("../fixtures/kamer-detail.html", import.meta.url), "utf8");
    const c = parseKamerContact(detail);
    expect(c).toBeNull();
  });
  it("returns null when no contact block present", () => {
    expect(parseKamerContact("<html><body>nothing</body></html>")).toBeNull();
  });
  it("extracts agency and phone if the markup ever adds a contact block", () => {
    const html =
      '<section class="agent-summary"><a class="agent-summary__title-link">Test Makelaar</a><a href="tel:+31612345678">bel</a></section>';
    const c = parseKamerContact(html);
    expect(c).not.toBeNull();
    expect(c!.agency).toBe("Test Makelaar");
    expect(c!.phone).toBe("+31612345678");
  });
});
