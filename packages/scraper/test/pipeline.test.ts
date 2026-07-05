import { describe, it, expect } from "vitest";
import { processListings } from "../src/pipeline.js";
import type { RawListing } from "@rf/core";

const raw = (id: string, over: Partial<RawListing> = {}): RawListing => ({
  externalId: id, url: `https://e.x/${id}`, title: `Listing ${id}`,
  price: 700, bills: "incl", type: "studio", furnished: "yes", area: null,
  postalcode: null, availableFrom: null, contact: null, raw: {}, ...over,
});

describe("processListings", () => {
  it("filters, scores and stamps source", () => {
    const out = processListings("roomspot", [
      raw("keep"),
      raw("too-expensive", { price: 1400 }),
      raw("shared", { type: "room-shared" }),
    ]);
    expect(out.map((l) => l.externalId)).toEqual(["keep"]);
    expect(out[0].source).toBe("roomspot");
    expect(out[0].score).toBeGreaterThan(0);
  });
  it("sorts by score descending", () => {
    const out = processListings("x", [
      raw("cheap-campus", { price: 550, area: "Calslaan" }),
      raw("pricey-far", { price: 940 }),
    ]);
    expect(out[0].externalId).toBe("cheap-campus");
  });
});
