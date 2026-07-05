import { describe, it, expect } from "vitest";
import { processListings, recomputeMatch } from "../src/pipeline.js";
import type { RawListing } from "@rf/core";

const raw = (id: string, over: Partial<RawListing> = {}): RawListing => ({
  externalId: id, url: `https://e.x/${id}`, title: `Listing ${id}`,
  price: 700, bills: "incl", type: "studio", furnished: "yes", area: null,
  postalcode: null, availableFrom: null, contact: null, raw: {}, ...over,
});

describe("processListings", () => {
  it("scores and stamps source, keeping non-matches with isMatch false", () => {
    const out = processListings("kamernet", [
      raw("keep"),
      raw("too-expensive", { price: 1400 }),
      raw("shared", { type: "room-shared" }),
    ]);
    expect(out).toHaveLength(3);
    expect(out.find((l) => l.externalId === "keep")!.isMatch).toBe(true);
    expect(out.find((l) => l.externalId === "too-expensive")!.isMatch).toBe(false);
    expect(out.find((l) => l.externalId === "shared")!.isMatch).toBe(false);
    const keep = out.find((l) => l.externalId === "keep")!;
    expect(keep.source).toBe("kamernet");
    expect(keep.score).toBeGreaterThan(0);
  });
  it("sorts by score descending", () => {
    const out = processListings("x", [
      raw("cheap-campus", { price: 550, area: "Calslaan" }),
      raw("pricey-far", { price: 940 }),
    ]);
    expect(out[0].externalId).toBe("cheap-campus");
  });
  it("stamps an address key from title + postalcode", () => {
    const out = processListings("kamernet", [
      raw("with-number", { title: "Matenweg 14 208, Enschede", postalcode: "7522 LH" }),
      raw("no-number", { title: "Spelbergsweg, Enschede", postalcode: "7522 AB" }),
    ]);
    expect(out.find((l) => l.externalId === "with-number")!.addressKey).toBe("7522lh-matenweg-14-208");
    expect(out.find((l) => l.externalId === "no-number")!.addressKey).toBeNull();
  });
  it("prefers a clean streetAddress over a sentence-style title for the key", () => {
    const out = processListings("housinganywhere", [
      raw("ha", { title: "Private room on Getfertsingel 45, Enschede", postalcode: "7513 AB", streetAddress: "Getfertsingel 45" }),
    ]);
    expect(out[0].addressKey).toBe("7513ab-getfertsingel-45");
  });
  it("recomputeMatch flips a room to a match after type upgrade", () => {
    const shared = processListings("kamernet", [raw("r", { type: "room-shared", price: 600, title: "Janninksweg 1, Enschede", postalcode: "7511 AA" })])[0];
    expect(shared.isMatch).toBe(false);
    const upgraded = recomputeMatch({ ...shared, type: "room-private-bath" });
    expect(upgraded.isMatch).toBe(true);
    expect(upgraded.score).toBeGreaterThan(shared.score);
  });
});
