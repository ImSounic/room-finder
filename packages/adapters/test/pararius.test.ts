import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePararius, parseParariusContact } from "../src/pararius.js";

const html = readFileSync(new URL("../fixtures/pararius.html", import.meta.url), "utf8");
const detailHtmlWithPhone = readFileSync(new URL("../fixtures/pararius-detail.html", import.meta.url), "utf8");
const detailHtmlNoPhone = readFileSync(new URL("../fixtures/pararius-detail-no-phone.html", import.meta.url), "utf8");

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

describe("defensive parsing", () => {
  it("returns [] for non-HTML / empty input", () => {
    expect(parsePararius("")).toEqual([]);
    expect(parsePararius("not html at all")).toEqual([]);
  });
  it("skips card with no title link", () => {
    const html = '<section class="listing-search-item"><div class="listing-search-item__price">€ 500 per maand</div></section>';
    expect(parsePararius(html)).toEqual([]);
  });
  it("skips card with title link but empty title text", () => {
    const html = '<section class="listing-search-item"><a class="listing-search-item__link--title" href="/kamer-te-huur/enschede/abc12345/teststraat">   </a></section>';
    expect(parsePararius(html)).toEqual([]);
  });
  it("handles unparseable price and returns null with bills=unknown", () => {
    const html = '<section class="listing-search-item"><a class="listing-search-item__link--title" href="/studio-te-huur/enschede/def67890/anderestraat">Studio Anderestraat</a><div class="listing-search-item__price">Prijs op aanvraag</div></section>';
    const listings = parsePararius(html);
    expect(listings.length).toBe(1);
    expect(listings[0].price).toBeNull();
    expect(listings[0].bills).toBe("unknown");
  });
  it("parses thousands separator in price", () => {
    const html = '<section class="listing-search-item"><a class="listing-search-item__link--title" href="/studio-te-huur/enschede/def67890/anderestraat">Studio Anderestraat</a><div class="listing-search-item__price">€ 1.250 per maand</div></section>';
    const listings = parsePararius(html);
    expect(listings.length).toBe(1);
    expect(listings[0].price).toBe(1250);
  });
});

describe("parseParariusContact", () => {
  it("extracts agency and phone from a live detail page fixture", () => {
    const contact = parseParariusContact(detailHtmlWithPhone);
    expect(contact).not.toBeNull();
    expect(contact!.agency).toBeDefined();
    expect(contact!.agency!.length).toBeGreaterThan(2);
    expect(contact!.phone).toBe("+31534400280");
  });
  it("extracts agency without phone when no tel: link is present", () => {
    const contact = parseParariusContact(detailHtmlNoPhone);
    expect(contact).not.toBeNull();
    expect(contact!.agency).toBe("Bakker Vastgoed");
    expect(contact!.phone).toBeUndefined();
  });
  it("extracts agency from synthetic minimal HTML with .agent-summary__title-link", () => {
    const html = '<section class="agent-summary"><a class="agent-summary__title-link" href="/makelaars/enschede/test-makelaar">Test Makelaar</a></section>';
    const contact = parseParariusContact(html);
    expect(contact).not.toBeNull();
    expect(contact!.agency).toBe("Test Makelaar");
  });
  it("returns null for empty html", () => {
    expect(parseParariusContact("")).toBeNull();
  });
  it("returns null when no agent block is present", () => {
    expect(parseParariusContact("<html><body><p>no agent here</p></body></html>")).toBeNull();
  });
});
