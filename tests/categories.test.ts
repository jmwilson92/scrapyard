import { describe, expect, it } from "vitest";
import { createDbClient, migrate } from "@/lib/db";
import { parseSearchQuery, searchListings } from "@/lib/search";
import { SEED_LISTINGS } from "@/lib/seed-data";
import { parseListingForm } from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const zipExists = (zip: string) => lookupZip(zip) != null;

describe("categories", () => {
  it("defaults to metal when no category is posted", () => {
    const parsed = parseListingForm(
      {
        title: "6061 drops",
        metalType: "al-6061",
        alloy: "6061-T6",
        form: "round",
        lengthIn: "24",
        quantity: "1",
        price: "10",
        zip: "92111",
        certsAvailable: "on",
      },
      zipExists,
    );
    expect(parsed.ok && parsed.value.category).toBe("metal");
    expect(parsed.ok && parsed.value.subtype).toBe("al-6061");
    expect(parsed.ok && parsed.value.certsAvailable).toBe(true);
  });

  it("accepts a non-metal lot without grade or dimensions and drops certs", () => {
    const parsed = parseListingForm(
      {
        title: "Drywall sheets",
        category: "construction",
        subtype: "drywall",
        form: "plate-sheet",
        quantity: "12",
        price: "60",
        zip: "92071",
        certsAvailable: "on",
      },
      zipExists,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.category).toBe("construction");
    expect(parsed.value.subtype).toBe("drywall");
    expect(parsed.value.certsAvailable).toBe(false);
  });

  it("rejects a subtype from another category", () => {
    const parsed = parseListingForm(
      {
        title: "Wood?",
        category: "wood",
        subtype: "drywall",
        form: "lot-bundle",
        quantity: "1",
        price: "5",
        zip: "92071",
      },
      zipExists,
    );
    expect(parsed.ok).toBe(false);
  });

  it("filters by category and subtype", () => {
    const rows = SEED_LISTINGS.map((row, index) => ({
      ...row,
      status: "active",
      createdAt: index,
    }));
    const wood = searchListings(rows, parseSearchQuery({ category: "wood" }), lookupZip);
    expect(wood.ok && wood.results.length).toBeGreaterThan(0);
    expect(wood.ok && wood.results.every((row) => row.category === "wood")).toBe(true);
    const tile = searchListings(
      rows,
      parseSearchQuery({ category: "construction", type: "tile" }),
      lookupZip,
    );
    expect(tile.ok && tile.results.map((row) => row.id)).toEqual(["ex-20"]);
  });

  it("migrates old listings to metal", async () => {
    const db = createDbClient(":memory:");
    await db.execute(`CREATE TABLE listings (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, title TEXT NOT NULL,
      material TEXT NOT NULL, metal_type TEXT NOT NULL DEFAULT 'other',
      alloy TEXT NOT NULL, form TEXT NOT NULL, quantity INTEGER NOT NULL,
      zip TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`);
    await db.execute(`INSERT INTO listings
      (id, seller_id, title, material, metal_type, alloy, form, quantity, zip, created_at, updated_at)
      VALUES ('old', 's', 'Old lot', 'aluminum', 'al-6061', '6061', 'bar-round', 1, '92111', 0, 0)`);
    await migrate(db);
    await migrate(db);
    const row = (await db.execute("SELECT category, subtype FROM listings WHERE id = 'old'")).rows[0];
    expect(row.category).toBe("metal");
    expect(row.subtype).toBe("al-6061");
  });
});
