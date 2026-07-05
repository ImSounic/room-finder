import { describe, it, expect } from "vitest";
import { draftIntroEmail } from "../src/email.js";
import type { ListingView } from "../src/present.js";

const listing: ListingView = {
  id: "1", source: "pararius", url: "https://www.pararius.nl/x", title: "Studio Spelbergsweg",
  price: 850, bills: "incl", type: "studio", furnished: "yes", area: "Spelbergsweg (7514 AB)",
  postalcode: "7514 AB", available_from: "2026-08-01", score: 78, contact: { agency: "Bakker Vastgoed" },
  status: "new", first_seen_at: "2026-07-06T10:00:00Z", is_match: true, address_key: "7514ab-spelbergsweg",
};
const me = { name: "TESTNAME", phone: "+00 000000000" };

describe("draftIntroEmail", () => {
  const { subject, body } = draftIntroEmail(listing, me);
  it("subject references the listing", () => {
    expect(subject.toLowerCase()).toContain("spelbergsweg");
  });
  it("body mentions the property, price, sender name and phone", () => {
    expect(body).toContain("Spelbergsweg");
    expect(body).toContain("850");
    expect(body).toContain("TESTNAME");
    expect(body).toContain("+00 000000000");
  });
  it("greets the agency by name when known", () => {
    expect(body).toContain("Bakker Vastgoed");
  });
  it("is bilingual (Dutch + English)", () => {
    // a Dutch marker and an English marker both present
    expect(body.toLowerCase()).toMatch(/bezichtig|geïnteresseerd|met vriendelijke groet/);
    expect(body.toLowerCase()).toMatch(/viewing|interested|kind regards/);
  });
  it("handles a missing agency and null price gracefully", () => {
    const d = draftIntroEmail({ ...listing, contact: null, price: null }, me);
    expect(d.subject.length).toBeGreaterThan(5);
    expect(d.body).toContain("TESTNAME");
    expect(d.body).not.toContain("null");
  });
});
