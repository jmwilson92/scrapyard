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
      form: "round",
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
