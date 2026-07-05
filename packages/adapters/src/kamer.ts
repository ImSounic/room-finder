import * as cheerio from "cheerio";
import type { Contact, Furnished, Listing, RawListing, SourceAdapter, UnitType } from "@rf/core";
import { withPage } from "./browser.js";

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
 *  listing is fetched in its OWN fresh browser context (via withPage):
 *  kamer.nl is Cloudflare TLS-fingerprinted like pararius, and reusing one
 *  context across sequential navigations risks later requests being served a
 *  challenge interstitial, so most listings after the first 1-2 would
 *  silently come back with no contact. A fresh context per listing avoids
 *  that. Each listing is isolated (a failure on one doesn't affect the
 *  others) and left with contact: null on failure, with a polite pause
 *  between listings. */
export async function enrichKamerContacts(listings: RawListing[], limit = 30): Promise<RawListing[]> {
  const targets = listings.slice(0, limit);
  const rest = listings.slice(limit);
  const out: RawListing[] = [];
  for (let i = 0; i < targets.length; i++) {
    const listing = targets[i];
    let contact = listing.contact;
    try {
      const html = await withPage(async (page) => {
        await page.goto(listing.url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await page.waitForTimeout(2500); // let Cloudflare JS challenge settle
        return page.content();
      });
      const parsed = parseKamerContact(html);
      if (parsed) contact = parsed;
    } catch {
      // keep existing contact (usually null); isolated per listing
    }
    out.push({ ...listing, contact });
    if (i < targets.length - 1) await sleep(1000 + Math.floor(Math.random() * 1000));
  }
  return [...out, ...rest];
}

/** Fetch the search-page HTML, retrying once in a fresh browser context if
 *  the first attempt times out (e.g. a slow Cloudflare challenge from a CI
 *  datacenter IP). Throws if both attempts fail, so the adapter is still
 *  logged as failed in that case. */
async function fetchSearchHtml(url: string, selector: string): Promise<string> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await withPage(async (page) => {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForSelector(selector, { timeout: 45000 });
        return page.content();
      });
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(3000);
    }
  }
  throw new Error("unreachable");
}

export const kamerAdapter: SourceAdapter = {
  name: "kamer",
  kind: "browser",
  async fetchListings() {
    const html = await fetchSearchHtml(SEARCH_URL, ".search-results-list div.group[id]");
    return parseKamer(html);
  },
  async enrichListings(listings: Listing[]): Promise<Listing[]> {
    return (await enrichKamerContacts(listings)) as Listing[];
  },
};
