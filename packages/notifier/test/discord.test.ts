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
});
