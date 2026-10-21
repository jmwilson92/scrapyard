import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import {
  isProfileComplete,
  maskEin,
  normalizeEin,
  normalizeWebsite,
  parseCompanyInput,
} from "@/lib/business";
import { createDbClient, migrate, seedIfEmpty } from "@/lib/db";
import { formatListingPrice } from "@/lib/format";
import {
  findPublicUserById,
  getCompanyById,
  getListingById,
  insertListing,
  listListings,
  updateCompany,
} from "@/lib/repo";
import { parseSearchQuery, searchListings } from "@/lib/search";
import { SEED_LISTINGS } from "@/lib/seed-data";
import { parseListingForm } from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const zipExists = (zip: string) => lookupZip(zip) != null;
const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  }
});

const validCompany = {
  companyName: "Ada Machining LLC",
  businessType: "machine-shop",
  street: "123 Main St",
  city: "San Diego",
  state: "ca",
  zip: "92111",
  serviceRadius: "50",
  ein: "123456789",
  website: "adamachining.com",
  contactName: "Ada L.",
  contactPhone: "(619) 555-0100",
};

describe("company profiles", () => {
  it("parses and normalizes a full business profile", () => {
    const parsed = parseCompanyInput(validCompany, zipExists);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.state).toBe("CA");
    expect(parsed.value.ein).toBe("12-3456789");
    expect(parsed.value.website).toBe("https://adamachining.com");
    expect(parsed.value.serviceRadiusMiles).toBe(50);
    expect(isProfileComplete(parsed.value)).toBe(true);
  });

  it("requires name, business type, city, state, ZIP, and contact; checks optional fields", () => {
    const parsed = parseCompanyInput(
      { companyName: "A", businessType: "hobbyist", zip: "00000", ein: "12", website: "nope", serviceRadius: "-3" },
      zipExists,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(
      ["businessType", "city", "companyName", "contactName", "ein", "serviceRadius", "state", "website", "zip"].sort(),
    );
  });

  it("treats a draft (migrated) profile as incomplete", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(
      isProfileComplete({ name: "Old Shop", businessType: "", city: "San Diego", state: "CA", zip: "92111", contactName: "" }),
    ).toBe(false);
  });

  it("formats EIN and website helpers", () => {
    expect(normalizeEin("12-345-6789")).toBe("12-3456789");
    expect(normalizeEin("123")).toBeNull();
    expect(maskEin("12-3456789")).toBe("••-•••6789");
    expect(normalizeWebsite("http://x.com/")).toBe("http://x.com");
    expect(normalizeWebsite("localhost")).toBeNull();
  });
});

describe("wanted posts", () => {
  const base = {
    title: "Need 1/2 in 6061 plate",
    category: "metal",
    metalType: "al-6061",
    alloy: "6061-T6",
    form: "plate",
    thicknessIn: "0.5",
    quantity: "4",
    zip: "92111",
  };

  it("allows a wanted post without a price (taking quotes) or with a budget", () => {
    const quotes = parseListingForm({ ...base, listingType: "wanted" }, zipExists);
    expect(quotes.ok).toBe(true);
    if (!quotes.ok) return;
    expect(quotes.value.listingType).toBe("wanted");
    expect(quotes.value.priceCents).toBeNull();
    expect(formatListingPrice(quotes.value)).toBe("Taking quotes");

    const budget = parseListingForm({ ...base, listingType: "wanted", price: "200" }, zipExists);
    expect(budget.ok && budget.value.priceCents).toBe(20000);
    if (budget.ok) expect(formatListingPrice(budget.value)).toBe("Budget $200");
  });

  it("defaults to an offer, still requires offer prices, and rejects unknown types", () => {
    const offer = parseListingForm(base, zipExists);
    expect(offer.ok).toBe(false);
    if (!offer.ok) expect(offer.errors.price).toBeDefined();
    const bad = parseListingForm({ ...base, listingType: "auction", price: "5" }, zipExists);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.listingType).toBeDefined();
  });

  it("filters search by post type and keeps wanted posts when free lots are hidden", () => {
    const rows = [
      { id: "a", material: "aluminum", alloy: "6061", form: "plate-sheet", priceCents: null, zip: "92111", status: "active", createdAt: 1, listingType: "wanted" },
      { id: "b", material: "aluminum", alloy: "6061", form: "plate-sheet", priceCents: 500, zip: "92111", status: "active", createdAt: 2, listingType: "offer" },
    ];
    const wanted = searchListings(rows, parseSearchQuery({ kind: "wanted", free: "0" }), lookupZip);
    expect(wanted.ok && wanted.results.map((r) => r.id)).toEqual(["a"]);
    const offers = searchListings(rows, parseSearchQuery({ kind: "offer" }), lookupZip);
    expect(offers.ok && offers.results.map((r) => r.id)).toEqual(["b"]);
    const both = searchListings(rows, parseSearchQuery({}), lookupZip);
    expect(both.ok && both.results.length).toBe(2);
  });
});

describe("company migration", () => {
  it("attaches every seeded example listing to a complete example company", async () => {
    const db = await tempFile();
    await migrate(db);
    await seedIfEmpty(db);
    const listings = await listListings(db);
    expect(listings.length).toBeGreaterThanOrEqual(SEED_LISTINGS.length);
    for (const listing of listings) {
      expect(listing.companyId).toBe(`co-${listing.sellerId}`);
      expect(listing.businessType).not.toBe("");
      expect(listing.listingType).toBe("offer");
    }
    const user = await findPublicUserById(db, "shop-kearny");
    expect(user?.profileComplete).toBe(true);
    const company = await getCompanyById(db, "co-shop-kearny");
    expect(company?.isExample).toBe(true);
    expect(company?.city).toBe("San Diego");
  });

  it("upgrades a pre-B2B database without losing data, and is idempotent", async () => {
    const db = await tempFile();
    // Legacy schema: users + listings with no company columns.
    await db.batch(
      [
        `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
          shop_name TEXT NOT NULL, zip TEXT NOT NULL, is_example INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
        `CREATE TABLE listings (id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, title TEXT NOT NULL, material TEXT NOT NULL,
          alloy TEXT NOT NULL, form TEXT NOT NULL, length_in REAL, width_in REAL, thickness_in REAL, diameter_in REAL,
          quantity INTEGER NOT NULL, weight_lbs REAL, price_cents INTEGER, zip TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
          photo_url TEXT, status TEXT NOT NULL DEFAULT 'active', is_example INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
        `INSERT INTO users VALUES ('real-1', 'bob@example.com', 'h', 'Bob Fab', '92020', 0, 1)`,
        `INSERT INTO users VALUES ('shop-kearny', 'kearny@demo.skrappily.example', 'h', 'Kearny Mesa Tool & Die', '92111', 1, 1)`,
        `INSERT INTO listings (id, seller_id, title, material, alloy, form, quantity, price_cents, zip, is_example, created_at, updated_at)
          VALUES ('old-1', 'real-1', 'Steel drops', 'steel', 'A36', 'plate', 2, 1000, '92020', 0, 1, 1)`,
        `INSERT INTO listings (id, seller_id, title, material, alloy, form, quantity, price_cents, zip, is_example, created_at, updated_at)
          VALUES ('old-ex', 'shop-kearny', 'Example drops', 'aluminum', '6061', 'bar', 2, 1000, '92111', 1, 1, 1)`,
      ],
      "write",
    );
    await migrate(db);
    await migrate(db);

    const real = await getListingById(db, "old-1");
    expect(real?.companyId).toBe("co-real-1");
    expect(real?.shopName).toBe("Bob Fab");
    expect(real?.listingType).toBe("offer");
    const realUser = await findPublicUserById(db, "real-1");
    expect(realUser?.companyId).toBe("co-real-1");
    expect(realUser?.profileComplete).toBe(false);

    const example = await getListingById(db, "old-ex");
    expect(example?.companyId).toBe("co-shop-kearny");
    expect((await findPublicUserById(db, "shop-kearny"))?.profileComplete).toBe(true);

    const companies = await db.execute("SELECT COUNT(*) AS c FROM companies WHERE id IN ('co-real-1', 'co-shop-kearny')");
    expect(Number(companies.rows[0]?.c)).toBe(2);

    // Finishing the profile unlocks posting and syncs the display name.
    const parsed = parseCompanyInput({ ...validCompany, companyName: "Bob Fab Inc", zip: "92020", city: "El Cajon" }, zipExists);
    if (!parsed.ok) throw new Error("bad fixture");
    await updateCompany(db, "co-real-1", parsed.value);
    expect((await findPublicUserById(db, "real-1"))?.profileComplete).toBe(true);
    expect((await getListingById(db, "old-1"))?.shopName).toBe("Bob Fab Inc");

    // New listings pick up the seller's company automatically.
    const wanted = parseListingForm(
      { listingType: "wanted", title: "Need 2x6 lumber", category: "wood", form: "scrap-mixed", quantity: "20", zip: "92020" },
      zipExists,
    );
    if (!wanted.ok) throw new Error(JSON.stringify(wanted.errors));
    await insertListing(db, { ...wanted.value, id: "new-1", sellerId: "real-1", photoUrl: null });
    const inserted = await getListingById(db, "new-1");
    expect(inserted?.companyId).toBe("co-real-1");
    expect(inserted?.listingType).toBe("wanted");
  });
});

async function tempFile(): Promise<Client> {
  const file = path.join(os.tmpdir(), `skrappily-b2b-${crypto.randomUUID()}.db`);
  files.push(file);
  return createDbClient(`file:${file}`);
}
