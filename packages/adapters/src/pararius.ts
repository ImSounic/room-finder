import * as cheerio from "cheerio";
import type { Contact, Listing, RawListing, SourceAdapter, UnitType, Furnished } from "@rf/core";
import { withPage, withBrowserPages } from "./browser.js";

// Cloudflare-fronted: plain fetch returns 403, so fetchListings goes through
// Playwright (see browser.ts). Search URL is Enschede, max €950.
const SEARCH_URL = "https://www.pararius.nl/huurwoningen/enschede/0-950";
const BASE = "https://www.pararius.nl";

function classifyFromTitle(title: string): UnitType {
  const t = title.toLowerCase();
  if (t.startsWith("studio")) return "studio";
  if (t.startsWith("appartement") || t.startsWith("flat")) return "apartment";
  if (t.startsWith("kamer")) return "room-shared"; // refine from detail text when available
  return "unknown";
}

export function parsePararius(html: string): RawListing[] {
  const $ = cheerio.load(html);
  const out: RawListing[] = [];
  $("section.listing-search-item").each((_, el) => {
    const $el = $(el);
    const link = $el.find("a.listing-search-item__link--title").first();
    const href = link.attr("href");
    if (!href) return; // junk/ad card without a title link
    let url: string;
    try {
      url = new URL(href, BASE).toString();
    } catch {
      return; // malformed href
    }
    const title = link.text().trim().replace(/\s+/g, " ");
    if (!title) return;
    // e.g. "€ 550 per maand" (nbsp after €); strip thousands separators first.
    const priceText = $el.find(".listing-search-item__price").first().text();
    const priceMatch = priceText.replace(/[.,](?=\d{3})/g, "").match(/€\s*(\d+)/);
    // e.g. "7523 CR Enschede (Voortman-Amelink)"
    const sub = $el
      .find(".listing-search-item__sub-title")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const features = $el
      .find(".illustrated-features__item")
      .map((_, f) => $(f).text().toLowerCase())
      .get();
    const furnished: Furnished = features.some((f) => f.includes("gemeubileerd"))
      ? "yes"
      : features.some((f) => f.includes("gestoffeerd"))
        ? "semi"
        : "unknown";
    const postal = sub.match(/\b(\d{4})\s?([A-Z]{2})\b/);
    // href shape: /kamer-te-huur/enschede/<hash>/<street> — hash+street is stable.
    const externalId = url.split("/").filter(Boolean).slice(-2).join("/");
    if (!externalId) return;
    out.push({
      externalId,
      url,
      title,
      price: priceMatch ? Number(priceMatch[1]) : null,
      bills: priceText.toLowerCase().includes("incl") ? "incl" : "unknown",
      type: classifyFromTitle(title),
      furnished,
      area: sub || null,
      postalcode: postal ? `${postal[1]} ${postal[2]}` : null,
      availableFrom: null, // only on detail pages — hard filter tolerates null
      contact: null, // agent details on detail pages — Phase 3 enrichment
      raw: { sub, features, priceText },
    });
  });
  return out;
}

/** Parse the publicly displayed agent/agency contact block from a Pararius
 *  DETAIL page. Agency name is always shown; phone is only present when the
 *  `tel:` link happens to be in the initial HTML (some listings hide it
 *  behind a "toon telefoonnummer" reveal that isn't in the markup at all —
 *  we never simulate that click, we just extract what's already there). */
export function parseParariusContact(html: string): Contact | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  const agency = $(".agent-summary__title-link").first().text().trim().replace(/\s+/g, " ");
  const telHref = $('a[href^="tel:"]').first().attr("href");
  const phone = telHref ? telHref.replace(/^tel:\s*/i, "").trim() : undefined;
  if (!agency && !phone) return null;
  const contact: Contact = {};
  if (agency) contact.agency = agency;
  if (phone) contact.phone = phone;
  return contact;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** For up to `limit` matched listings, open their Pararius detail page and
 *  fill in `contact` from the publicly displayed agent block. Each listing is
 *  isolated (a failure on one doesn't affect the others) and left with
 *  contact: null on failure. Pages are opened sequentially in one browser,
 *  with a polite pause between them. */
export async function enrichParariusContacts(listings: RawListing[], limit = 30): Promise<RawListing[]> {
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
          out.push({ ...listing, contact: parseParariusContact(html) });
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

export const parariusAdapter: SourceAdapter = {
  name: "pararius",
  kind: "browser",
  async fetchListings() {
    const html = await withPage(async (page) => {
      await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("section.listing-search-item", { timeout: 20000 });
      return page.content();
    });
    return parsePararius(html);
  },
  async enrichListings(listings: Listing[]): Promise<Listing[]> {
    return (await enrichParariusContacts(listings)) as Listing[];
  },
};
