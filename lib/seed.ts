import type { InStatement, ResultSet } from "@libsql/client";
import { hashPassword } from "@/lib/passwords";
import { lookupZip } from "@/lib/zip";
import {
  NON_METAL_SEED_LISTINGS,
  SEED_LISTINGS,
  SEED_SHOPS,
  DEMO_PASSWORD,
  EXAMPLE_BUSINESS_TYPES,
  exampleCompanyId,
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

/**
 * Gives every user without a company its own company, then attaches that
 * user's listings to it. Example shops get complete example profiles; real
 * accounts get a draft profile (name + ZIP) they must finish before posting.
 * Safe to run on every boot: it only touches rows with no company yet.
 */
export async function ensureCompanies(db: Executor): Promise<void> {
  const users = await db.execute(
    `SELECT id, shop_name, zip, is_example, verified_seller, created_at
     FROM users WHERE company_id IS NULL OR company_id = ''`,
  );
  for (const row of users.rows) {
    const userId = String(row.id);
    const isExample = Number(row.is_example ?? 0) === 1;
    const zip = String(row.zip ?? "");
    const place = lookupZip(zip);
    const companyId = exampleCompanyId(userId);
    await db.execute({
      sql: `INSERT OR IGNORE INTO companies
        (id, name, business_type, street, city, state, zip, service_radius_miles,
         ein, website, contact_name, contact_phone, is_example, verified, created_at)
        VALUES (?, ?, ?, '', ?, ?, ?, ?, '', '', ?, '', ?, ?, ?)`,
      args: [
        companyId,
        String(row.shop_name ?? "Company"),
        isExample ? (EXAMPLE_BUSINESS_TYPES[userId] ?? "machine-shop") : "",
        place?.city ?? "",
        place?.state ?? "",
        zip,
        isExample ? 50 : null,
        isExample ? "Example contact" : "",
        isExample ? 1 : 0,
        Number(row.verified_seller ?? 0) === 1 ? 1 : 0,
        Number(row.created_at ?? Date.now()),
      ],
    });
    await db.execute({
      sql: "UPDATE users SET company_id = ? WHERE id = ?",
      args: [companyId, userId],
    });
  }
  await db.execute(
    `UPDATE listings SET company_id = (SELECT u.company_id FROM users u WHERE u.id = listings.seller_id)
     WHERE company_id IS NULL OR company_id = ''`,
  );
}
