import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { createDbClient, migrate } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import {
  countUnread,
  deleteListingForSeller,
  findUserByEmail,
  getListingById,
  insertListing,
  insertMessage,
  insertReport,
  insertUser,
  listListings,
  updateListingStatus,
} from "@/lib/repo";
import { searchListings, parseSearchQuery } from "@/lib/search";
import { seedExampleData } from "@/lib/seed";
import { DEMO_PASSWORD, SEED_LISTINGS } from "@/lib/seed-data";
import { lookupZip } from "@/lib/zip";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(file + suffix, { force: true });
    }
  }
});

describe("listing records", () => {
  it("creates, searches, sells, messages, reports, and deletes a lot", async () => {
    const db = await tempDb();
    await insertUser(db, {
      id: "shop-1",
      email: "ada@example.com",
      passwordHash: "hash",
      shopName: "Ada Machining",
      zip: "92111",
    });
    await insertListing(db, {
      id: "lot-1",
      sellerId: "shop-1",
      title: "6061-T6 round drops",
      material: "aluminum",
      alloy: "6061-T6",
      form: "bar-round",
      diameterIn: 1.5,
      lengthIn: 24,
      widthIn: null,
      thicknessIn: null,
      quantity: 6,
      weightLbs: 25,
      priceCents: 3600,
      zip: "92111",
      notes: "Saw cut.",
      photoUrl: null,
      metalType: "al-6061",
      deliveryMode: "delivery",
      deliveryRadiusMiles: 25,
      deliveryFeeCents: 1500,
      certsAvailable: true,
      certsNote: "MTR on file",
    });

    const active = searchListings(
      await listListings(db),
      parseSearchQuery({ material: "aluminum", zip: "92101", miles: "25" }),
      (zip) => lookupZip(zip),
    );
    expect(active.ok).toBe(true);
    if (!active.ok) return;
    expect(active.results.map((row) => row.id)).toEqual(["lot-1"]);
    expect(active.results[0]?.distanceMiles).toBeLessThan(15);
    expect(active.results[0]?.deliveryMode).toBe("delivery");
    expect(active.results[0]?.deliveryRadiusMiles).toBe(25);
    expect(active.results[0]?.metalType).toBe("al-6061");
    expect(active.results[0]?.certsAvailable).toBe(true);
    expect(active.results[0]?.certsNote).toBe("MTR on file");

    expect(await updateListingStatus(db, "lot-1", "shop-1", "sold")).toBe(true);
    const afterSale = searchListings(
      await listListings(db),
      parseSearchQuery({}),
      () => null,
    );
    expect(afterSale.ok && afterSale.results).toEqual([]);
    expect((await getListingById(db, "lot-1"))?.status).toBe("sold");

    await insertMessage(db, {
      id: "msg-1",
      listingId: "lot-1",
      senderId: "shop-1",
      recipientId: "shop-1",
      body: "note to self is not the product path",
    });
    await insertUser(db, {
      id: "shop-2",
      email: "bea@example.com",
      passwordHash: "hash",
      shopName: "Bea Fab",
      zip: "92101",
    });
    await insertMessage(db, {
      id: "msg-2",
      listingId: "lot-1",
      senderId: "shop-2",
      recipientId: "shop-1",
      body: "Can I grab this Friday?",
    });
    expect(await countUnread(db, "shop-1")).toBe(2);

    expect(
      await insertReport(db, {
        id: "rep-1",
        listingId: "lot-1",
        reporterId: "shop-2",
        reason: "inaccurate",
        note: "Size looks off",
      }),
    ).toBe("ok");
    expect(
      await insertReport(db, {
        id: "rep-2",
        listingId: "lot-1",
        reporterId: "shop-2",
        reason: "spam",
        note: "",
      }),
    ).toBe("duplicate");

    expect(await deleteListingForSeller(db, "lot-1", "shop-2")).toBe(false);
    expect(await deleteListingForSeller(db, "lot-1", "shop-1")).toBe(true);
    expect(await getListingById(db, "lot-1")).toBeNull();
    expect(await countUnread(db, "shop-1")).toBe(0);
    db.close();
  });

  it("seeds fifteen example listings and a shared demo password", async () => {
    const db = await tempDb();
    await seedExampleData(db);
    const listings = await listListings(db);
    expect(listings).toHaveLength(SEED_LISTINGS.length);
    expect(listings.every((row) => row.isExample)).toBe(true);
    const user = await findUserByEmail(db, "kearny@demo.dropyard.example");
    expect(user?.shopName).toBe("Kearny Mesa Tool & Die");
    expect(user && (await verifyPassword(DEMO_PASSWORD, user.passwordHash))).toBe(
      true,
    );
    const delivered = listings.find((row) => row.id === "ex-05");
    expect(delivered?.metalType).toBe("ss-316");
    expect(delivered?.form).toBe("tube-pipe");
    expect(delivered?.deliveryMode).toBe("delivery");
    expect(delivered?.deliveryFeeCents).toBe(5000);
    expect(delivered?.certsAvailable).toBe(true);
    expect(delivered?.certsNote).toContain("Mill test report");
    expect(delivered?.sellerVerified).toBe(false);
    const verified = listings.find((row) => row.id === "ex-01");
    expect(verified?.sellerVerified).toBe(true);
    expect(verified?.certsAvailable).toBe(false);
    db.close();
  });

  it("migrates older listings onto metal type, form groups, and pickup", async () => {
    const file = path.join(os.tmpdir(), `dropyard-${crypto.randomUUID()}.db`);
    files.push(file);
    const db = createDbClient(`file:${file}`);
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      zip TEXT NOT NULL,
      is_example INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`);
    await db.execute(`CREATE TABLE listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      material TEXT NOT NULL,
      alloy TEXT NOT NULL,
      form TEXT NOT NULL,
      length_in REAL,
      width_in REAL,
      thickness_in REAL,
      diameter_in REAL,
      quantity INTEGER NOT NULL,
      weight_lbs REAL,
      price_cents INTEGER,
      zip TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      photo_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      is_example INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users
        (id, email, password_hash, shop_name, zip, is_example, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: ["shop-old", "old@example.com", "hash", "Old Shop", "91910", 1],
    });
    await db.execute({
      sql: `INSERT INTO listings (
        id, seller_id, title, material, alloy, form,
        length_in, width_in, thickness_in, diameter_in,
        quantity, weight_lbs, price_cents, zip, notes, photo_url,
        status, is_example, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?)`,
      args: [
        "old-1",
        "shop-old",
        "304 sheet",
        "stainless",
        "304",
        "sheet",
        36,
        24,
        0.06,
        null,
        1,
        null,
        1000,
        "91910",
        "",
        null,
        1,
        1,
      ],
    });

    await migrate(db);
    const listing = await getListingById(db, "old-1");
    expect(listing?.form).toBe("plate-sheet");
    expect(listing?.metalType).toBe("ss-304");
    expect(listing?.deliveryMode).toBe("pickup");
    expect(listing?.deliveryRadiusMiles).toBeNull();
    expect(listing?.deliveryFeeCents).toBeNull();
    expect(listing?.certsAvailable).toBe(false);
    expect(listing?.certsNote).toBe("");
    expect(listing?.sellerVerified).toBe(false);

    await migrate(db);
    expect((await getListingById(db, "old-1"))?.metalType).toBe("ss-304");
    db.close();
  });
});

async function tempDb(): Promise<Client> {
  const file = path.join(os.tmpdir(), `dropyard-${crypto.randomUUID()}.db`);
  files.push(file);
  const db = createDbClient(`file:${file}`);
  await migrate(db);
  return db;
}
