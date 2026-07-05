import { describe, it, expect } from "vitest";
import { priceLabel, sortAndFilter, computeSourceHealth, typeCategory, type ListingView } from "../src/present.js";

const v = (over: Partial<ListingView> = {}): ListingView => ({
  id: "1", source: "kamernet", url: "u", title: "t", price: 700, bills: "incl",
  type: "studio", furnished: "yes", area: "Calslaan", postalcode: null,
  available_from: null, score: 80, contact: null, status: "new", first_seen_at: "2026-07-05T10:00:00Z",
  address_key: null, is_match: true, ...over,
});

describe("ListingView shape", () => {
  it("includes address_key for cross-reference linking", () => {
    expect(v({ address_key: "7500aa-teststraat-1" }).address_key).toBe("7500aa-teststraat-1");
    expect(v().address_key).toBeNull();
  });
});

describe("priceLabel", () => {
  it("formats price with bills, and handles null", () => {
    expect(priceLabel(v({ price: 650, bills: "incl" }))).toBe("€650 incl.");
    expect(priceLabel(v({ price: 650, bills: "excl" }))).toBe("€650 excl.");
    expect(priceLabel(v({ price: 650, bills: "unknown" }))).toBe("€650");
    expect(priceLabel(v({ price: null }))).toBe("price ?");
  });
});

describe("sortAndFilter", () => {
  const rows = [v({ id: "a", score: 60, source: "pararius", status: "new" }),
                v({ id: "b", score: 90, source: "kamernet", status: "new" }),
                v({ id: "c", score: 75, source: "kamernet", status: "dismissed" })];
  it("sorts by score desc by default", () => {
    expect(sortAndFilter(rows, {}).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
  it("filters by source", () => {
    expect(sortAndFilter(rows, { source: "kamernet" }).map((r) => r.id)).toEqual(["b", "c"]);
  });
  it("filters by min score", () => {
    expect(sortAndFilter(rows, { minScore: 70 }).map((r) => r.id)).toEqual(["b", "c"]);
  });
  it("hides dismissed when hideDismissed", () => {
    expect(sortAndFilter(rows, { hideDismissed: true }).map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.id);
    sortAndFilter(rows, {});
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  const catRows = [
    v({ id: "s", type: "studio" }),
    v({ id: "r", type: "room-shared" }),
    v({ id: "u", type: "unknown" }),
  ];
  it("filters by type category", () => {
    expect(sortAndFilter(catRows, { category: "shared" }).map((r) => r.id)).toEqual(["r"]);
  });
  it("keeps all rows when category is all", () => {
    expect(sortAndFilter(catRows, { category: "all" }).map((r) => r.id).sort()).toEqual(["r", "s", "u"]);
  });
});

describe("typeCategory", () => {
  it("buckets types into tabs", () => {
    expect(typeCategory("studio")).toBe("studio");
    expect(typeCategory("apartment")).toBe("studio");
    expect(typeCategory("room-private-bath")).toBe("studio");
    expect(typeCategory("room-shared")).toBe("shared");
    expect(typeCategory("unknown")).toBe("other");
  });
});

describe("computeSourceHealth", () => {
  it("marks a source ok on recent ok run, broken on failure", () => {
    const runs = [
      { source: "kamernet", ok: true, total_found: 5, new_matches: 0, ran_at: "2026-07-05T10:00:00Z" },
      { source: "pararius", ok: false, total_found: 0, new_matches: 0, ran_at: "2026-07-05T09:55:00Z" },
    ];
    const h = computeSourceHealth(runs);
    expect(h.find((x) => x.source === "kamernet")!.ok).toBe(true);
    expect(h.find((x) => x.source === "pararius")!.ok).toBe(false);
  });
  it("keeps only the latest run per source", () => {
    const runs = [
      { source: "kamernet", ok: false, total_found: 0, new_matches: 0, ran_at: "2026-07-05T09:00:00Z" },
      { source: "kamernet", ok: true, total_found: 5, new_matches: 1, ran_at: "2026-07-05T10:00:00Z" },
    ];
    const h = computeSourceHealth(runs);
    expect(h.length).toBe(1);
    expect(h[0].ok).toBe(true);
  });
});
