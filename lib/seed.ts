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

const EXAMPLE_RFQS = [
  {
    id: "rfq-ex-01",
    ownerId: "shop-kearny",
    title: "1/2 in 6061-T6 plate, 24 x 48, qty 6",
    category: "metal",
    subtype: "al-6061",
    quantity: 6,
    unit: "sheets",
    specs:
      "6061-T6 aluminum plate, 0.500 in thick, cut to 24 x 48 in (+/- 0.125). Mill finish OK. MTR required. Our distributor is out until next month.",
    days: 21,
    neededDays: 10,
    deliveryZip: "92111",
    deliveryLocation: "Kearny Mesa, dock door on the north side",
    budgetCents: null as number | null,
  },
  {
    id: "rfq-ex-02",
    ownerId: "shop-santee",
    title: "2x6 Doug fir #2, 12 ft, about 400 board ft",
    category: "wood",
    subtype: "dimensional-lumber",
    quantity: 400,
    unit: "board-ft",
    specs: "Doug fir #2 or better, 2x6 x 12 ft, kiln dried. Mixed lots fine if straight. For shop crating.",
    days: 14,
    neededDays: 7,
    deliveryZip: "92071",
    deliveryLocation: "Santee, forklift on site",
    budgetCents: 60000,
  },
];

/** Adds two example RFQs once the example companies exist. INSERT OR IGNORE keeps it idempotent. */
export async function seedExampleRfqs(db: Executor): Promise<void> {
  if (process.env.SEED_EXAMPLE_DATA === "false") return;
  const shops = await db.execute("SELECT COUNT(*) AS c FROM users WHERE id IN ('shop-kearny', 'shop-santee') AND is_example = 1");
  if (Number(shops.rows[0]?.c ?? 0) < 2) return;
  const done = await db.execute("SELECT id FROM schema_migrations WHERE id = 'seed-example-rfqs-v1'");
  if (done.rows[0]) return;
  const now = Date.now();
  const day = (offset: number) => new Date(now + offset * 86_400_000).toISOString().slice(0, 10);
  for (const rfq of EXAMPLE_RFQS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO rfqs (id, owner_id, company_id, title, category, subtype, quantity, unit, specs,
        needed_by, delivery_zip, delivery_location, budget_cents, expires_on, status, is_example, created_at, updated_at)
        VALUES (?, ?, (SELECT company_id FROM users WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1, ?, ?)`,
      args: [
        rfq.id, rfq.ownerId, rfq.ownerId, rfq.title, rfq.category, rfq.subtype, rfq.quantity, rfq.unit,
        rfq.specs, day(rfq.neededDays), rfq.deliveryZip, rfq.deliveryLocation, rfq.budgetCents, day(rfq.days),
        now, now,
      ],
    });
  }
  await db.execute("INSERT OR IGNORE INTO schema_migrations (id) VALUES ('seed-example-rfqs-v1')");
}
