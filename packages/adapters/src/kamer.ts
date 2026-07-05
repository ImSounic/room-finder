import * as cheerio from "cheerio";
import type { Furnished, RawListing, SourceAdapter, UnitType } from "@rf/core";
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
};
