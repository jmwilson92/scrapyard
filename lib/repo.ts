import type { Client } from "@libsql/client";
import { canonicalForm, isCategory, isDeliveryMode, isMetalType } from "@/lib/constants";
import type { Listing, ListingInput, MessageRow, PublicUser, UserRecord } from "@/lib/types";

const LISTING_SELECT = `
  SELECT
    l.id, l.seller_id, u.shop_name, u.zip AS shop_zip, l.title, l.category, l.subtype, l.material,
    l.metal_type, l.alloy, l.form,
    l.length_in, l.width_in, l.thickness_in, l.diameter_in,
    l.quantity, l.weight_lbs, l.price_cents, l.zip, l.notes, l.photo_url,
    l.status, l.is_example, l.delivery_mode, l.delivery_radius_miles,
    l.delivery_fee_cents, l.certs_available, l.certs_note, u.verified_seller,
    l.created_at, l.updated_at
  FROM listings l
  JOIN users u ON u.id = l.seller_id
`;

export async function insertUser(
  db: Client,
  user: {
    id: string;
    email: string;
    passwordHash: string;
    shopName: string;
    zip: string;
    isExample?: boolean;
    verifiedSeller?: boolean;
    createdAt?: number;
  },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO users
      (id, email, password_hash, shop_name, zip, is_example, verified_seller, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      user.id,
      user.email,
      user.passwordHash,
      user.shopName,
      user.zip,
      user.isExample ? 1 : 0,
      user.verifiedSeller ? 1 : 0,
      user.createdAt ?? Date.now(),
    ],
  });
}

export async function findUserByEmail(
  db: Client,
  email: string,
): Promise<UserRecord | null> {
  const result = await db.execute({
    sql: `SELECT id, email, password_hash, shop_name, zip, is_example, verified_seller, created_at
      FROM users WHERE email = ?`,
    args: [email],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: text(row.id),
    email: text(row.email),
    passwordHash: text(row.password_hash),
    shopName: text(row.shop_name),
    zip: text(row.zip),
    isExample: flag(row.is_example),
    verifiedSeller: flag(row.verified_seller),
    createdAt: num(row.created_at),
  };
}

export async function updateUserShop(
  db: Client,
  userId: string,
  shopName: string,
  zip: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET shop_name = ?, zip = ? WHERE id = ?",
    args: [shopName, zip, userId],
  });
}

export async function findUserBySession(
  db: Client,
  tokenHash: string,
  now = Date.now(),
): Promise<PublicUser | null> {
  const result = await db.execute({
    sql: `SELECT u.id, u.email, u.shop_name, u.zip, u.is_example, u.verified_seller
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    args: [tokenHash, now],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: text(row.id),
    email: text(row.email),
    shopName: text(row.shop_name),
    zip: text(row.zip),
    isExample: flag(row.is_example),
    verifiedSeller: flag(row.verified_seller),
  };
}

export async function findPublicUserById(
  db: Client,
  id: string,
): Promise<PublicUser | null> {
  const result = await db.execute({
    sql: `SELECT id, email, shop_name, zip, is_example, verified_seller FROM users WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: text(row.id),
    email: text(row.email),
    shopName: text(row.shop_name),
    zip: text(row.zip),
    isExample: flag(row.is_example),
    verifiedSeller: flag(row.verified_seller),
  };
}

export async function createSession(
  db: Client,
  session: { id: string; userId: string; tokenHash: string; expiresAt: number },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)`,
    args: [session.id, session.userId, session.tokenHash, session.expiresAt],
  });
}

export async function deleteSession(db: Client, tokenHash: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM sessions WHERE token_hash = ?",
    args: [tokenHash],
  });
}

export async function insertListing(
  db: Client,
  listing: ListingInput & {
    id: string;
    sellerId: string;
    photoUrl: string | null;
    isExample?: boolean;
    createdAt?: number;
  },
): Promise<void> {
  const createdAt = listing.createdAt ?? Date.now();
  await db.execute({
    sql: `INSERT INTO listings (
      id, seller_id, title, category, subtype, material, metal_type, alloy, form,
      length_in, width_in, thickness_in, diameter_in,
      quantity, weight_lbs, price_cents, zip, notes, photo_url,
      status, is_example, delivery_mode, delivery_radius_miles, delivery_fee_cents,
      certs_available, certs_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      listing.photoUrl,
      listing.isExample ? 1 : 0,
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

export async function listListings(db: Client): Promise<Listing[]> {
  const result = await db.execute(
    `${LISTING_SELECT} ORDER BY l.created_at DESC`,
  );
  return result.rows.map(mapListing);
}

export async function listListingsBySeller(
  db: Client,
  sellerId: string,
): Promise<Listing[]> {
  const result = await db.execute({
    sql: `${LISTING_SELECT} WHERE l.seller_id = ? ORDER BY l.created_at DESC`,
    args: [sellerId],
  });
  return result.rows.map(mapListing);
}

export async function getListingById(
  db: Client,
  id: string,
): Promise<Listing | null> {
  const result = await db.execute({
    sql: `${LISTING_SELECT} WHERE l.id = ?`,
    args: [id],
  });
  const row = result.rows[0];
  return row ? mapListing(row) : null;
}

export async function updateListingStatus(
  db: Client,
  id: string,
  sellerId: string,
  status: "active" | "sold",
): Promise<boolean> {
  const result = await db.execute({
    sql: `UPDATE listings SET status = ?, updated_at = ?
      WHERE id = ? AND seller_id = ?`,
    args: [status, Date.now(), id, sellerId],
  });
  return result.rowsAffected > 0;
}

export async function deleteListingForSeller(
  db: Client,
  id: string,
  sellerId: string,
): Promise<boolean> {
  const owned = await db.execute({
    sql: "SELECT id, photo_url FROM listings WHERE id = ? AND seller_id = ?",
    args: [id, sellerId],
  });
  if (!owned.rows[0]) return false;
  await db.batch(
    [
      { sql: "DELETE FROM messages WHERE listing_id = ?", args: [id] },
      { sql: "DELETE FROM reports WHERE listing_id = ?", args: [id] },
      {
        sql: "DELETE FROM listings WHERE id = ? AND seller_id = ?",
        args: [id, sellerId],
      },
    ],
    "write",
  );
  return true;
}

export async function insertMessage(
  db: Client,
  message: {
    id: string;
    listingId: string;
    senderId: string;
    recipientId: string;
    body: string;
    createdAt?: number;
  },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO messages
      (id, listing_id, sender_id, recipient_id, body, created_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      message.id,
      message.listingId,
      message.senderId,
      message.recipientId,
      message.body,
      message.createdAt ?? Date.now(),
    ],
  });
}

export async function listMessagesForUser(
  db: Client,
  userId: string,
): Promise<MessageRow[]> {
  const result = await db.execute({
    sql: `SELECT
        m.id, m.listing_id, l.title AS listing_title,
        m.sender_id, su.shop_name AS sender_shop,
        m.recipient_id, ru.shop_name AS recipient_shop,
        m.body, m.created_at, m.read_at
      FROM messages m
      JOIN listings l ON l.id = m.listing_id
      JOIN users su ON su.id = m.sender_id
      JOIN users ru ON ru.id = m.recipient_id
      WHERE m.sender_id = ? OR m.recipient_id = ?
      ORDER BY m.created_at ASC`,
    args: [userId, userId],
  });
  return result.rows.map(mapMessage);
}

export async function listThreadMessages(
  db: Client,
  listingId: string,
  userId: string,
  otherUserId: string,
): Promise<MessageRow[]> {
  const result = await db.execute({
    sql: `SELECT
        m.id, m.listing_id, l.title AS listing_title,
        m.sender_id, su.shop_name AS sender_shop,
        m.recipient_id, ru.shop_name AS recipient_shop,
        m.body, m.created_at, m.read_at
      FROM messages m
      JOIN listings l ON l.id = m.listing_id
      JOIN users su ON su.id = m.sender_id
      JOIN users ru ON ru.id = m.recipient_id
      WHERE m.listing_id = ?
        AND (
          (m.sender_id = ? AND m.recipient_id = ?)
          OR (m.sender_id = ? AND m.recipient_id = ?)
        )
      ORDER BY m.created_at ASC`,
    args: [listingId, userId, otherUserId, otherUserId, userId],
  });
  return result.rows.map(mapMessage);
}

export async function markThreadRead(
  db: Client,
  listingId: string,
  recipientId: string,
  senderId: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE messages SET read_at = ?
      WHERE listing_id = ? AND recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
    args: [Date.now(), listingId, recipientId, senderId],
  });
}

export async function countUnread(db: Client, userId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL",
    args: [userId],
  });
  return num(result.rows[0]?.c);
}

export async function insertReport(
  db: Client,
  report: {
    id: string;
    listingId: string;
    reporterId: string;
    reason: string;
    note: string;
  },
): Promise<"ok" | "duplicate"> {
  const existing = await db.execute({
    sql: "SELECT id FROM reports WHERE listing_id = ? AND reporter_id = ?",
    args: [report.listingId, report.reporterId],
  });
  if (existing.rows[0]) return "duplicate";
  await db.execute({
    sql: `INSERT INTO reports
      (id, listing_id, reporter_id, reason, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      report.id,
      report.listingId,
      report.reporterId,
      report.reason,
      report.note,
      Date.now(),
    ],
  });
  return "ok";
}

function mapListing(row: Record<string, unknown>): Listing {
  const status = text(row.status) === "sold" ? "sold" : "active";
  const metalRaw = text(row.metal_type);
  const deliveryRaw = text(row.delivery_mode);
  const categoryRaw = text(row.category);
  const category = isCategory(categoryRaw) ? categoryRaw : "metal";
  const metalType = isMetalType(metalRaw) ? metalRaw : "other";
  const subtypeRaw = text(row.subtype);
  return {
    id: text(row.id),
    sellerId: text(row.seller_id),
    shopName: text(row.shop_name),
    shopZip: text(row.shop_zip || row.zip),
    title: text(row.title),
    category,
    subtype: subtypeRaw || (category === "metal" ? metalType : "other"),
    material: text(row.material) as Listing["material"],
    metalType,
    alloy: text(row.alloy),
    form: canonicalForm(text(row.form)) ?? "bar-round",
    lengthIn: optionalNum(row.length_in),
    widthIn: optionalNum(row.width_in),
    thicknessIn: optionalNum(row.thickness_in),
    diameterIn: optionalNum(row.diameter_in),
    quantity: num(row.quantity),
    weightLbs: optionalNum(row.weight_lbs),
    priceCents: optionalNum(row.price_cents),
    zip: text(row.zip),
    notes: text(row.notes),
    photoUrl: row.photo_url == null ? null : text(row.photo_url),
    status,
    isExample: flag(row.is_example),
    sellerVerified: flag(row.verified_seller),
    deliveryMode: isDeliveryMode(deliveryRaw) ? deliveryRaw : "pickup",
    deliveryRadiusMiles: optionalNum(row.delivery_radius_miles),
    deliveryFeeCents: optionalNum(row.delivery_fee_cents),
    certsAvailable: flag(row.certs_available),
    certsNote: text(row.certs_note),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): MessageRow {
  return {
    id: text(row.id),
    listingId: text(row.listing_id),
    listingTitle: text(row.listing_title),
    senderId: text(row.sender_id),
    senderShop: text(row.sender_shop),
    recipientId: text(row.recipient_id),
    recipientShop: text(row.recipient_shop),
    body: text(row.body),
    createdAt: num(row.created_at),
    readAt: row.read_at == null ? null : num(row.read_at),
  };
}

function text(value: unknown): string {
  return String(value ?? "");
}

function num(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value ?? 0);
}

function optionalNum(value: unknown): number | null {
  if (value == null) return null;
  return num(value);
}

function flag(value: unknown): boolean {
  return num(value) === 1;
}
