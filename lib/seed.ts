import type { InStatement, ResultSet } from "@libsql/client";
import { hashPassword } from "@/lib/passwords";
import { SEED_LISTINGS, SEED_SHOPS, DEMO_PASSWORD } from "@/lib/seed-data";

type Executor = {
  execute(stmt: InStatement): Promise<ResultSet>;
};

export async function seedExampleData(db: Executor): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();

  for (const shop of SEED_SHOPS) {
    await db.execute({
      sql: `INSERT INTO users
        (id, email, password_hash, shop_name, zip, is_example, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)`,
      args: [shop.id, shop.email, passwordHash, shop.shopName, shop.zip, now],
    });
  }

  for (let index = 0; index < SEED_LISTINGS.length; index += 1) {
    const listing = SEED_LISTINGS[index];
    const createdAt = now - (SEED_LISTINGS.length - index) * 60_000;
    await db.execute({
      sql: `INSERT INTO listings (
        id, seller_id, title, material, alloy, form,
        length_in, width_in, thickness_in, diameter_in,
        quantity, weight_lbs, price_cents, zip, notes, photo_url,
        status, is_example, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      args: [
        listing.id,
        listing.sellerId,
        listing.title,
        listing.material,
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
        createdAt,
        createdAt,
      ],
    });
  }
}
