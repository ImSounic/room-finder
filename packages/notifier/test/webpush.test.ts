import { describe, it, expect } from "vitest";
import { buildPushPayload, deadEndpoints } from "../src/webpush.js";
import type { Listing } from "@rf/core";

const l: Listing = {
  source: "roomspot", externalId: "1", url: "https://roomspot.nl/x", title: "Calslaan 1, Enschede",
  price: 650, bills: "incl", type: "studio", furnished: "yes", area: "Calslaan", postalcode: null,
  availableFrom: "2026-08-01", contact: null, raw: {}, score: 88,
};

describe("buildPushPayload", () => {
  it("summarizes the listing for a notification", () => {
    const p = JSON.parse(buildPushPayload(l));
    expect(p.title).toContain("88");
    expect(p.body).toContain("€650");
    expect(p.body.toLowerCase()).toContain("studio");
    expect(p.url).toBe(l.url);
  });
  it("handles null price", () => {
    const p = JSON.parse(buildPushPayload({ ...l, price: null }));
    expect(p.body).toContain("€?");
  });
});

describe("deadEndpoints", () => {
  it("returns endpoints whose send rejected with 404/410", () => {
    const results = [
      { endpoint: "a", ok: true, status: 201 },
      { endpoint: "b", ok: false, status: 410 },
      { endpoint: "c", ok: false, status: 404 },
      { endpoint: "d", ok: false, status: 429 },
    ];
    expect(deadEndpoints(results)).toEqual(["b", "c"]);
  });
  it("returns empty when all ok", () => {
    expect(deadEndpoints([{ endpoint: "a", ok: true, status: 201 }])).toEqual([]);
  });
});
