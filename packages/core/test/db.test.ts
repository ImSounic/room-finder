import { describe, it, expect, vi, afterEach } from "vitest";
import { insertNewListings, isSourceUnhealthy, existingExternalIds } from "../src/db.js";
import type { Listing } from "../src/types.js";

const l = (id: string, addressKey?: string | null): Listing => ({
  source: "test", externalId: id, url: `https://e.x/${id}`, title: id,
  price: 700, bills: "incl", type: "studio", furnished: "yes", area: null,
  postalcode: null, availableFrom: null, contact: null, raw: {}, score: 80,
  addressKey, isMatch: true,
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
    const [row] = await insertNewListings(db as never, [l("c", "x")]);
    expect(row.external_id).toBe("c");
    expect(row.available_from).toBeNull();
    expect(row.address_key).toBe("x");
    expect(row.is_match).toBe(true);
  });
  it("returns [] for empty input without touching the client", async () => {
    const inserted = await insertNewListings(null as never, []);
    expect(inserted).toEqual([]);
  });
});

describe("existingExternalIds", () => {
  it("returns [] without touching the client for empty ids", async () => {
    const result = await existingExternalIds(null as never, "test", []);
    expect(result).toEqual(new Set());
  });
  it("returns a Set of only the ids that already exist", async () => {
    const fakeDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({
              data: [{ external_id: "a" }, { external_id: "c" }],
              error: null,
            }),
          }),
        }),
      }),
    };
    const result = await existingExternalIds(fakeDb as never, "test", ["a", "b", "c"]);
    expect(result).toEqual(new Set(["a", "c"]));
  });
  it("returns empty Set and logs when the query errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fakeDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({
              data: null,
              error: { message: "boom" },
            }),
          }),
        }),
      }),
    };
    const result = await existingExternalIds(fakeDb as never, "test", ["a"]);
    expect(result).toEqual(new Set());
    expect(consoleErrorSpy).toHaveBeenCalledWith("existingExternalIds query failed: boom");
    consoleErrorSpy.mockRestore();
  });
  it("unions results from multiple chunks (150 ids spanning 2 chunks)", async () => {
    let callCount = 0;
    const fakeDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: (slice: string[]) => {
              callCount++;
              // First chunk (100 ids): return matches for a5, a25, a50, a99
              if (callCount === 1) {
                return Promise.resolve({
                  data: [
                    { external_id: "a5" },
                    { external_id: "a25" },
                    { external_id: "a50" },
                    { external_id: "a99" },
                  ],
                  error: null,
                });
              }
              // Second chunk (50 ids): return matches for a105, a120, a149
              if (callCount === 2) {
                return Promise.resolve({
                  data: [
                    { external_id: "a105" },
                    { external_id: "a120" },
                    { external_id: "a149" },
                  ],
                  error: null,
                });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        }),
      }),
    };

    const ids = Array.from({ length: 150 }, (_, i) => `a${i}`);
    const result = await existingExternalIds(fakeDb as never, "test", ids);

    // Verify we got matches from both chunks
    expect(result).toEqual(
      new Set(["a5", "a25", "a50", "a99", "a105", "a120", "a149"])
    );
    expect(callCount).toBe(2); // called once for each chunk
  });
});

describe("isSourceUnhealthy", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when n <= 0", async () => {
    const fakeDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    const result = await isSourceUnhealthy(fakeDb as never, "test", 0);
    expect(result).toBe(false);
  });

  it("returns false and logs when the query errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fakeDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: null,
                error: { message: "boom" },
              }),
            }),
          }),
        }),
      }),
    };
    const result = await isSourceUnhealthy(fakeDb as never, "test", 3);
    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith("source_runs query failed: boom");
    consoleErrorSpy.mockRestore();
  });
});
