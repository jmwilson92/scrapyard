import type { InStatement, ResultSet } from "@libsql/client";
import { hashPassword } from "@/lib/passwords";
import {
  NON_METAL_SEED_LISTINGS,
  SEED_LISTINGS,
  SEED_SHOPS,
  DEMO_PASSWORD,
  type SeedListing,
} from "@/lib/seed-data";

type Executor = {
  execute(stmt: InStatement): Promise<ResultSet>;
};

export async function seedExampleData(db: Executor): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();

  for (const shop of SEED_SHOPS) {
    await db.execute({
      sql: `INSERT INTO users
        (id, email, password_hash, shop_name, zip, is_example, verified_seller, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        shop.id,
        shop.email,
        passwordHash,
        shop.shopName,
        shop.zip,
        shop.verifiedSeller ? 1 : 0,
        now,
      ],
    });
  }

  await insertSeedListings(db, SEED_LISTINGS, now);
}

/**
 * Adds the non-metal sample lots to a database that was seeded before they
 * existed. Only runs when the example shops are present; skips ids already there.
 */
export async function backfillNonMetalExamples(db: Executor): Promise<void> {
  const shops = await db.execute(
    "SELECT COUNT(*) AS c FROM users WHERE is_example = 1",
  );
  if (Number(shops.rows[0]?.c ?? 0) === 0) return;
  await insertSeedListings(db, NON_METAL_SEED_LISTINGS, Date.now());
}

async function insertSeedListings(
  db: Executor,
  listings: readonly SeedListing[],
  now: number,
): Promise<void> {
  for (let index = 0; index < listings.length; index += 1) {
    const listing = listings[index];
    const createdAt = now - (listings.length - index) * 60_000;
    await db.execute({
      sql: `INSERT OR IGNORE INTO listings (
        id, seller_id, title, category, subtype, material, metal_type, alloy, form,
        length_in, width_in, thickness_in, diameter_in,
        quantity, weight_lbs, price_cents, zip, notes, photo_url,
        status, is_example, delivery_mode, delivery_radius_miles, delivery_fee_cents,
        certs_available, certs_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        listing.id,
        listing.sellerId,
        listing.title,
        listing.category,
        listing.subtype,
        listing.material,
        listing.metalType,
        listing.alloy,
        listing.form,
        listing.lengthIn,
        listing.widthIn,
        listing.thicknessIn,
        listing.diameterIn,
        listing.quantity,
        listing.weightLbs,
        listing.priceCents,
        listing.zip,
        listing.notes,
        `/seed/${listing.id}.svg`,
        listing.deliveryMode,
        listing.deliveryRadiusMiles,
        listing.deliveryFeeCents,
        listing.certsAvailable ? 1 : 0,
        listing.certsNote,
        createdAt,
        createdAt,
      ],
    });
  }
}
