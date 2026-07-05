import * as cheerio from "cheerio";
import type { Contact, Furnished, Listing, RawListing, SourceAdapter, UnitType } from "@rf/core";
import { withPage, withBrowserPages } from "./browser.js";

// Cloudflare-fronted: curl with a browser UA passed recon, but Node's
// undici fetch (any headers) is challenged with a 403 "Just a moment..."
// page — same TLS-fingerprint block as pararius. fetchListings therefore
// goes through Playwright (see browser.ts) rather than plain http fetch.
// City URL pattern is /huren/huurwoning-{city}/.
const SEARCH_URL = "https://www.kamer.nl/huren/huurwoning-enschede/";
const BASE = "https://www.kamer.nl";

// Verified 2026-07-05 against the live fixture: cards carry a category+city
// tag like "Huurwoning Enschede" (no room/studio/apartment distinction there),
// so type is classified from the free-text title/description instead.
function classifyFromTitle(title: string): UnitType {
  const t = title.toLowerCase();
  if (t.includes("studio")) return "studio";
  if (t.includes("appartement") || t.includes("flat")) return "apartment";
  if (t.includes("kamer")) return "room-shared";
  return "unknown";
}

export function parseKamer(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $(".search-results-list div.group[id]").each((_, el) => {
    try {
      const $el = $(el);
      const link = $el.find('a[href^="/huren/huurwoning-"], a[data-href^="/huren/huurwoning-"]').first();
      // Some cards lazy-load and only populate data-href, not href.
      const href = link.attr("href") || link.attr("data-href");
      if (!href) return; // junk/promo card without a listing link
      // Search results include nearby-city suggestions (Hengelo, Losser, …) — keep Enschede only.
      const cityMatch = href.match(/huurwoning-([^/]+)/);
      if ((cityMatch?.[1] ?? "").toLowerCase() !== "enschede") return;
      let url: string;
      try {
        url = new URL(href, BASE).toString();
      } catch {
        return; // malformed href
      }
      const title = $el
        .find("p.font-bold.md\\:text-lg.overflow-hidden")
        .first()
        .text()
        .trim()
        .replace(/\s+/g, " ");
      if (!title) return;
      // e.g. "€ 1.700 p/m"; strip thousands separators before matching digits.
      const priceText = $el.find("p.font-bold.md\\:text-lg.flex-none").first().text();
      const priceMatch = priceText.replace(/[.,](?=\d{3})/g, "").match(/€\s*(\d+)/);
      const description = $el.find("p.leading-7").first().text().toLowerCase();
      const furnished: Furnished = description.includes("gemeubileerd")
        ? "yes"
        : description.includes("gestoffeerd")
          ? "semi"
          : "unknown";
      const combinedText = `${title} ${description}`;
      const postal = combinedText.match(/\b(\d{4})\s?([A-Z]{2})\b/i);
      // href shape: /huren/huurwoning-{city}/{street-slug}/{id}/ — the id in
      // the card's own `id` attribute is the stable external id.
      const externalId = $el.attr("id") ?? "";
      if (!externalId) return;
      out.push({
        externalId,
        url,
        title,
        price: priceMatch ? Number(priceMatch[1]) : null,
        bills: priceText.toLowerCase().includes("incl") || description.includes("inclusief") ? "incl" : "unknown",
        type: classifyFromTitle(combinedText),
        furnished,
        area: title || null,
        postalcode: postal ? `${postal[1]} ${postal[2].toUpperCase()}` : null,
        availableFrom: null, // only reliably parseable from detail pages
        contact: null, // agent details on detail pages — Phase 3 enrichment
        raw: { priceText, description },
      });
    } catch {
      // isolate a single malformed card from the rest of the page
      return;
    }
  });
  return out;
}

/** Parse the publicly displayed agency/broker contact block from a kamer.nl
 *  DETAIL page, if one exists. Verified 2026-07-05 against live detail-page
 *  fixtures (see fixtures/kamer-detail.html): kamer.nl does not render a
 *  broker/agency name or phone number anywhere on the detail page — the
 *  "aangeboden door" ("offered by") string that exists in the markup only
 *  ever appears inside the Cookiebot consent dialog boilerplate (e.g.
 *  "diensten die worden aangeboden door Cloudflare"), never as an actual
 *  listing agent block, and there are no `tel:` links on the page at all.
 *  Contact instead happens exclusively through kamer.nl's own in-site
 *  "reageren" (respond) lead form (a `/<slug>/<id>/reageren/` sub-path),
 *  which requires filling out a form rather than exposing a phone number.
 *  This function is kept (mirroring pararius's parseParariusContact) in case
 *  kamer.nl's markup changes to expose real broker details, or a future
 *  listing type does render one — it defensively returns null today. */
export function parseKamerContact(html: string): Contact | null {
  if (!html) return null;
  try {
    const $ = cheerio.load(html);
    const agency = $(".agent-summary__title-link, [data-testid='agent-name'], .broker-name")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const telHref = $('a[href^="tel:"]').first().attr("href");
    const phone = telHref ? telHref.replace(/^tel:\s*/i, "").trim() : undefined;
    if (!agency && !phone) return null;
    const contact: Contact = {};
    if (agency) contact.agency = agency;
    if (phone) contact.phone = phone;
    return contact;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** For up to `limit` matched listings, open their kamer.nl detail page and
 *  fill in `contact` from the publicly displayed agency/broker block (in
 *  practice this is currently always null — see parseKamerContact). Each
 *  listing is isolated (a failure on one doesn't affect the others) and left
 *  with contact: null on failure. Pages are opened sequentially in one
 *  browser (kamer.nl is Cloudflare TLS-fingerprinted, so plain fetch is
 *  blocked — detail fetches must go through Playwright), with a polite pause
 *  between them. */
export async function enrichKamerContacts(listings: RawListing[], limit = 30): Promise<RawListing[]> {
  const targets = listings.slice(0, limit);
  const rest = listings.slice(limit);
  const enriched = await withBrowserPages(async (newPage) => {
    const out: RawListing[] = [];
    for (const listing of targets) {
      try {
        const page = await newPage();
        try {
          await page.goto(listing.url, { waitUntil: "domcontentloaded" });
          const html = await page.content();
          out.push({ ...listing, contact: parseKamerContact(html) });
        } finally {
          await page.close();
        }
      } catch {
        out.push({ ...listing, contact: null });
      }
      await sleep(1000 + Math.random() * 1000);
    }
    return out;
  });
  return [...enriched, ...rest];
}

export const kamerAdapter: SourceAdapter = {
  name: "kamer",
  kind: "browser",
  async fetchListings() {
    const html = await withPage(async (page) => {
      await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".search-results-list div.group[id]", { timeout: 20000 });
      return page.content();
    });
    return parseKamer(html);
  },
  async enrichListings(listings: Listing[]): Promise<Listing[]> {
    return (await enrichKamerContacts(listings)) as Listing[];
  },
};
