import { describe, it, expect } from "vitest";
import { insertNewListings } from "../src/db.js";
import type { Listing } from "../src/types.js";

const l = (id: string): Listing => ({
  source: "test", externalId: id, url: `https://e.x/${id}`, title: id,
  price: 700, bills: "incl", type: "studio", furnished: "yes", area: null,
  postalcode: null, availableFrom: null, contact: null, raw: {}, score: 80,
});

function fakeSupabase(existing: Set<string>) {
  return {
    from: () => ({
      upsert: (rows: Record<string, unknown>[], _opts: unknown) => ({
        select: async () => ({
          data: rows.filter((r) => !existing.has(`${r.source}:${r.external_id}`)),
          error: null,
        }),
      }),
    }),
  };
}

describe("insertNewListings", () => {
  it("returns only rows that were actually new", async () => {
    const db = fakeSupabase(new Set(["test:a"]));
    const inserted = await insertNewListings(db as never, [l("a"), l("b")]);
    expect(inserted.map((r) => r.external_id)).toEqual(["b"]);
  });
  it("snake_cases fields for postgres", async () => {
    const db = fakeSupabase(new Set());
    const [row] = await insertNewListings(db as never, [l("c")]);
    expect(row.external_id).toBe("c");
    expect(row.available_from).toBeNull();
  });
  it("returns [] for empty input without touching the client", async () => {
    const inserted = await insertNewListings(null as never, []);
    expect(inserted).toEqual([]);
  });
});
