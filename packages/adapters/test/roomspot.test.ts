import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseRoomspot } from "../src/roomspot.js";

const payload = JSON.parse(readFileSync(new URL("../fixtures/roomspot.json", import.meta.url), "utf8"));

describe("parseRoomspot", () => {
  const listings = parseRoomspot(payload);
  it("returns only published Enschede rental listings", () => {
    expect(listings.length).toBeGreaterThan(50);
    for (const l of listings) expect(l.externalId).toMatch(/^\d+$/);
  });
  it("maps fields", () => {
    const l = listings[0];
    expect(l.url).toContain("roomspot.nl");
    expect(l.title.length).toBeGreaterThan(3);
    expect(typeof l.price).toBe("number");
    expect(l.availableFrom === null || /^\d{4}-\d{2}-\d{2}$/.test(l.availableFrom!)).toBe(true);
  });
  it("classifies studios from dwellingType", () => {
    const studio = listings.find((l) =>
      JSON.stringify(l.raw).toLowerCase().includes("studio"));
    expect(studio?.type).toBe("studio");
  });
  it("classifies unzelfstandig as room", () => {
    for (const l of listings) {
      const raw = l.raw as { isZelfstandig?: boolean };
      if (raw.isZelfstandig === false) expect(["room-shared", "room-private-bath"]).toContain(l.type);
    }
  });
});
