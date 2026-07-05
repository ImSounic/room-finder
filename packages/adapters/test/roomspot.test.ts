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
  it("classifies zelfstandige kamer as studio", () => {
    const zelfKamer = listings.find((l) => {
      const raw = l.raw as { isZelfstandig?: boolean; dwellingType?: { localizedName?: string } };
      return raw.isZelfstandig === true && (raw.dwellingType?.localizedName ?? "") === "Kamer";
    });
    expect(zelfKamer).toBeDefined();
    expect(zelfKamer?.type).toBe("studio");
  });
});

describe("defensive parsing", () => {
  it("returns [] when result is a non-array object", () => {
    expect(parseRoomspot({ result: { foo: 1 } } as never)).toEqual([]);
  });
  it("returns [] when result is a string", () => {
    expect(parseRoomspot({ result: "oops" } as never)).toEqual([]);
  });
  it("skips null/undefined array elements without throwing", () => {
    const validObject = payload.result.find(
      (o: any) => (o.city?.name ?? "").toLowerCase() === "enschede" && o.isGepubliceerd !== false,
    );
    const result = parseRoomspot({ result: [null, validObject] } as never);
    expect(result.length).toBe(1);
  });
  it("skips records missing id", () => {
    const validObject = payload.result.find(
      (o: any) => (o.city?.name ?? "").toLowerCase() === "enschede" && o.isGepubliceerd !== false,
    );
    const clone = { ...validObject };
    delete clone.id;
    const result = parseRoomspot({ result: [clone] } as never);
    expect(result.length).toBe(0);
  });
  it("skips records missing urlKey", () => {
    const validObject = payload.result.find(
      (o: any) => (o.city?.name ?? "").toLowerCase() === "enschede" && o.isGepubliceerd !== false,
    );
    const clone = { ...validObject };
    delete clone.urlKey;
    const result = parseRoomspot({ result: [clone] } as never);
    expect(result.length).toBe(0);
  });
  it("includes houseNumberAddition in title when present", () => {
    const withAddition = payload.result.find(
      (o: any) =>
        (o.city?.name ?? "").toLowerCase() === "enschede" &&
        o.isGepubliceerd !== false &&
        o.houseNumberAddition,
    );
    expect(withAddition).toBeDefined();
    const [listing] = parseRoomspot({ result: [withAddition] } as never);
    expect(listing.title).toBe(
      `${withAddition.street} ${withAddition.houseNumber} ${withAddition.houseNumberAddition}, Enschede`,
    );
  });
});
