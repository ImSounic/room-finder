import { describe, it, expect } from "vitest";
import { buildAlertPayload } from "../src/discord.js";
import type { Listing } from "@rf/core";

const l: Listing = {
  source: "roomspot", externalId: "1", url: "https://roomspot.nl/x",
  title: "Calslaan 1, Enschede", price: 650, bills: "unknown", type: "studio",
  furnished: "yes", area: "Calslaan (7522 AB)", postalcode: "7522 AB",
  availableFrom: "2026-08-01", contact: null, raw: {}, score: 88,
};

describe("buildAlertPayload", () => {
  it("high score pings, low score does not", () => {
    expect(buildAlertPayload(l).content).toContain("@everyone");
    expect(buildAlertPayload({ ...l, score: 40 }).content ?? "").not.toContain("@everyone");
  });
  it("embed carries the essentials", () => {
    const e = buildAlertPayload(l).embeds[0];
    expect(e.title).toContain("Calslaan");
    expect(e.url).toBe(l.url);
    const text = JSON.stringify(e.fields);
    for (const s of ["650", "studio", "roomspot", "88", "2026-08-01"]) expect(text).toContain(s);
  });
  it("shows contact details when scraped", () => {
    const withContact = { ...l, contact: { email: "agent@x.nl", phone: "053-123" } };
    expect(JSON.stringify(buildAlertPayload(withContact).embeds[0].fields)).toContain("agent@x.nl");
  });
  it("ping boundary: exactly 70 pings, 69 does not", () => {
    expect(buildAlertPayload({ ...l, score: 70 }).content).toContain("@everyone");
    expect(buildAlertPayload({ ...l, score: 69 }).content).toBeUndefined();
  });
  it("truncates title over 250 chars", () => {
    const long = { ...l, title: "x".repeat(300) };
    expect(buildAlertPayload(long).embeds[0].title.length).toBeLessThanOrEqual(250);
  });
  it("renders null area/availableFrom/price as ?", () => {
    const nulled = { ...l, area: null, availableFrom: null, price: null };
    const fields = buildAlertPayload(nulled).embeds[0].fields;
    expect(fields.filter((f) => f.value === "?").length).toBe(3);
  });
  it("includes bills flag in price field", () => {
    const fields = buildAlertPayload({ ...l, bills: "incl" as const }).embeds[0].fields;
    expect(fields.find((f) => f.name === "Price")?.value).toBe("€650 (incl)");
  });
});
