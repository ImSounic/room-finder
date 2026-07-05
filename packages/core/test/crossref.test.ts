import { describe, it, expect } from "vitest";
import { addressKey, linkByAddress } from "../src/crossref.js";

describe("addressKey", () => {
  it("normalizes street + number, ignoring case/whitespace/formatting", () => {
    expect(addressKey("Matenweg 14 208", "7522 LH")).toBe(addressKey("matenweg  14-208", "7522lh"));
  });
  it("keys differ for different houses", () => {
    expect(addressKey("Matenweg 14", "7522 LH")).not.toBe(addressKey("Matenweg 28", "7522 LH"));
  });
  it("returns null when there is no house number to anchor on", () => {
    expect(addressKey("Matenweg", null)).toBeNull();
  });
  it("returns null for null street", () => {
    expect(addressKey(null, "7522 LH")).toBeNull();
  });
  it("strips leading listing-type words so sources with different title prefixes match", () => {
    expect(addressKey("Studio Spelbergsweg 12", "7522 AB")).toBe(addressKey("Spelbergsweg 12", "7522 AB"));
    expect(addressKey("Appartement Matenweg 14", "7522 LH")).toBe(addressKey("Matenweg 14", "7522 LH"));
    expect(addressKey("Kamer Janninksweg 3", "7511 AA")).toBe(addressKey("janninksweg 3", "7511 AA"));
  });
  it("does not strip a type word that is part of the real street name", () => {
    // "Studioweg" is one token, not the prefix "Studio" — must stay intact
    expect(addressKey("Studioweg 5", "7500 AA")).not.toBe(addressKey("weg 5", "7500 AA"));
  });
});

describe("linkByAddress", () => {
  const rows = [
    { id: "a", source: "kamernet", address_key: "7522lh-matenweg-14-208", url: "k", contact: null },
    { id: "b", source: "pararius", address_key: "7522lh-matenweg-14-208", url: "p", contact: { agency: "X", phone: "053" } },
    { id: "c", source: "roomspot", address_key: "7523dt-fazantstraat-345", url: "r", contact: null },
  ];
  it("finds a free-contact twin for a paywalled listing", () => {
    const link = linkByAddress(rows[0], rows);
    expect(link?.source).toBe("pararius");
    expect(link?.contact?.phone).toBe("053");
  });
  it("returns null when no other source shares the address", () => {
    expect(linkByAddress(rows[2], rows)).toBeNull();
  });
  it("never links a row to itself", () => {
    expect(linkByAddress(rows[1], rows)).toBeNull();
  });
  it("returns null for a row without address_key", () => {
    expect(linkByAddress({ id: "d", source: "x", address_key: null, url: "u", contact: null }, rows)).toBeNull();
  });
});
