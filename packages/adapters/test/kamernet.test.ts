import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKamernet, parseKamernetDetail } from "../src/kamernet.js";

const html = readFileSync(new URL("../fixtures/kamernet.html", import.meta.url), "utf8");
const detail = readFileSync(new URL("../fixtures/kamernet-detail.html", import.meta.url), "utf8");

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
  it("returns [] for deeply nested payload without stack overflow", () => {
    // Build a synthetic deeply-nested object (500+ levels) that should not crash
    let nested: unknown = { x: 1 };
    for (let i = 0; i < 500; i++) {
      nested = { a: nested };
    }
    const html = `<script id="__NEXT_DATA__">${JSON.stringify(nested)}</script>`;
    expect(parseKamernet(html)).toEqual([]);
  });
  it("dedupes within a single NEXT_DATA with duplicate listingIds", () => {
    // Hand-built minimal NEXT_DATA with the same listingId appearing twice
    const payload = {
      props: {
        listings: [
          {
            listingId: 12345,
            listingType: 1,
            street: "Straat A",
            streetSlug: "straat-a",
            city: "Enschede",
            citySlug: "enschede",
            totalRentalPrice: 500,
            utilitiesIncluded: false,
            surfaceArea: 30,
            availabilityStartDate: "2026-08-01",
            availabilityEndDate: null,
            furnishingId: 1,
            isStudentHouseAdvert: false,
            isReactForFree: false,
            isTopAdvert: false,
          },
          {
            listingId: 12345, // Same ID
            listingType: 1,
            street: "Straat A",
            streetSlug: "straat-a",
            city: "Enschede",
            citySlug: "enschede",
            totalRentalPrice: 500,
            utilitiesIncluded: false,
            surfaceArea: 30,
            availabilityStartDate: "2026-08-01",
            availabilityEndDate: null,
            furnishingId: 1,
            isStudentHouseAdvert: false,
            isReactForFree: false,
            isTopAdvert: false,
          },
        ],
      },
    };
    const html = `<script id="__NEXT_DATA__">${JSON.stringify(payload)}</script>`;
    const result = parseKamernet(html);
    expect(result.length).toBe(1);
    expect(result[0].externalId).toBe("12345");
  });
});

describe("parseKamernetDetail", () => {
  it("reads facilities from the real fixture (Janninksweg: all shared)", () => {
    const f = parseKamernetDetail(detail);
    expect(f.bathroom).toBe("shared");
    expect(f.kitchen).toBe("shared");
    expect(f.surfaceArea).toBe(20);
    expect(f.furnished).toBe("no"); // "Unfurnished"
  });
  it("detects a private/own bathroom", () => {
    expect(parseKamernetDetail("<div>Private bathroom Shared kitchen 30 m² Furnished room</div>").bathroom).toBe(
      "private",
    );
    expect(parseKamernetDetail("<div>Own bathroom own kitchen</div>").bathroom).toBe("private");
  });
  it("returns unknowns for empty/junk", () => {
    const f = parseKamernetDetail("");
    expect(f.bathroom).toBe("unknown");
    expect(f.kitchen).toBe("unknown");
    expect(f.surfaceArea).toBeNull();
    expect(f.furnished).toBe("unknown");
  });
  it("does not read a negated facility as present", () => {
    expect(parseKamernetDetail("<div>No private bathroom, only shared bathroom</div>").bathroom).toBe("shared");
    expect(parseKamernetDetail("<div>Geen eigen badkamer</div>").bathroom).not.toBe("private");
  });
});
