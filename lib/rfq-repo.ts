import type { Client } from "@libsql/client";
import { isCategory, type Category } from "@/lib/constants";
import type { QuoteInput, QuoteStatus, RfqInput, RfqStatus, Unit } from "@/lib/rfq";
import type { MessageRow } from "@/lib/types";

export type Rfq = RfqInput & {
  id: string;
  ownerId: string;
  companyId: string | null;
  companyName: string;
  businessType: string;
  companyVerified: boolean;
  status: RfqStatus;
  awardedQuoteId: string | null;
  isExample: boolean;
  quoteCount: number;
  createdAt: number;
  updatedAt: number;
};

export type Quote = QuoteInput & {
  id: string;
  rfqId: string;
  quoterId: string;
  companyId: string | null;
  companyName: string;
  businessType: string;
  status: QuoteStatus;
  createdAt: number;
  updatedAt: number;
};

export type RfqFile = {
  id: string;
  rfqId: string;
  quoteId: string | null;
  uploaderId: string;
  name: string;
  pathname: string;
  contentType: string;
  size: number;
  createdAt: number;
};

const RFQ_SELECT = `
  SELECT r.*, COALESCE(c.name, u.shop_name) AS company_name,
    COALESCE(c.business_type, '') AS business_type,
    COALESCE(c.verified, u.verified_seller, 0) AS company_verified,
    (SELECT COUNT(*) FROM rfq_quotes q WHERE q.rfq_id = r.id) AS quote_count
  FROM rfqs r
  JOIN users u ON u.id = r.owner_id
  LEFT JOIN companies c ON c.id = u.company_id
`;

const QUOTE_SELECT = `
  SELECT q.*, COALESCE(c.name, u.shop_name) AS company_name,
    COALESCE(c.business_type, '') AS business_type
  FROM rfq_quotes q
  JOIN users u ON u.id = q.quoter_id
  LEFT JOIN companies c ON c.id = u.company_id
`;

export async function insertRfq(
  db: Client,
  rfq: RfqInput & { id: string; ownerId: string; isExample?: boolean; createdAt?: number },
): Promise<void> {
  const now = rfq.createdAt ?? Date.now();
  await db.execute({
    sql: `INSERT INTO rfqs (id, owner_id, company_id, title, category, subtype, quantity, unit, specs,
      needed_by, delivery_zip, delivery_location, budget_cents, expires_on, status, is_example,
      created_at, updated_at)
      VALUES (?, ?, (SELECT company_id FROM users WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    args: [
      rfq.id,
      rfq.ownerId,
      rfq.ownerId,
      rfq.title,
      rfq.category,
      rfq.subtype,
      rfq.quantity,
      rfq.unit,
      rfq.specs,
      rfq.neededBy,
      rfq.deliveryZip,
      rfq.deliveryLocation,
      rfq.budgetCents,
      rfq.expiresOn,
      rfq.isExample ? 1 : 0,
      now,
      now,
    ],
  });
}

export async function listRfqs(db: Client): Promise<Rfq[]> {
  const result = await db.execute(`${RFQ_SELECT} ORDER BY r.created_at DESC LIMIT 500`);
  return result.rows.map(mapRfq);
}

export async function listRfqsByOwner(db: Client, ownerId: string): Promise<Rfq[]> {
  const result = await db.execute({
    sql: `${RFQ_SELECT} WHERE r.owner_id = ? ORDER BY r.created_at DESC`,
    args: [ownerId],
  });
  return result.rows.map(mapRfq);
}

export async function getRfqById(db: Client, id: string): Promise<Rfq | null> {
  const result = await db.execute({ sql: `${RFQ_SELECT} WHERE r.id = ?`, args: [id] });
  const row = result.rows[0];
  return row ? mapRfq(row) : null;
}

export async function setRfqStatus(
  db: Client,
  id: string,
  ownerId: string,
  status: RfqStatus,
): Promise<boolean> {
  const result = await db.execute({
    sql: "UPDATE rfqs SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    args: [status, Date.now(), id, ownerId],
  });
  return result.rowsAffected > 0;
}

export async function insertQuote(
  db: Client,
  quote: QuoteInput & { id: string; rfqId: string; quoterId: string; createdAt?: number },
): Promise<void> {
  const now = quote.createdAt ?? Date.now();
  await db.execute({
    sql: `INSERT INTO rfq_quotes (id, rfq_id, quoter_id, company_id, price_cents, price_basis, quantity,
      lead_time_days, notes, valid_until, status, created_at, updated_at)
      VALUES (?, ?, ?, (SELECT company_id FROM users WHERE id = ?), ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
    args: [
      quote.id,
      quote.rfqId,
      quote.quoterId,
      quote.quoterId,
      quote.priceCents,
      quote.priceBasis,
      quote.quantity,
      quote.leadTimeDays,
      quote.notes,
      quote.validUntil,
      now,
      now,
    ],
  });
}

export async function findQuoteByQuoter(
  db: Client,
  rfqId: string,
  quoterId: string,
): Promise<Quote | null> {
  const result = await db.execute({
    sql: `${QUOTE_SELECT} WHERE q.rfq_id = ? AND q.quoter_id = ?`,
    args: [rfqId, quoterId],
  });
  const row = result.rows[0];
  return row ? mapQuote(row) : null;
}

export async function listQuotesForRfq(db: Client, rfqId: string): Promise<Quote[]> {
  const result = await db.execute({
    sql: `${QUOTE_SELECT} WHERE q.rfq_id = ? ORDER BY q.created_at ASC`,
    args: [rfqId],
  });
  return result.rows.map(mapQuote);
}

export async function listQuotesByQuoter(
  db: Client,
  quoterId: string,
): Promise<(Quote & { rfqTitle: string; rfqStatus: string; rfqExpiresOn: string })[]> {
  const result = await db.execute({
    sql: `SELECT q.*, '' AS company_name, '' AS business_type, r.title AS rfq_title,
        r.status AS rfq_status, r.expires_on AS rfq_expires_on
      FROM rfq_quotes q JOIN rfqs r ON r.id = q.rfq_id
      WHERE q.quoter_id = ? ORDER BY q.created_at DESC`,
    args: [quoterId],
  });
  return result.rows.map((row) => ({
    ...mapQuote(row),
    rfqTitle: text(row.rfq_title),
    rfqStatus: text(row.rfq_status),
    rfqExpiresOn: text(row.rfq_expires_on),
  }));
}

/**
 * Owner decision on one quote. Accepting awards the RFQ to that quote and
 * declines the other open quotes; declining only changes that quote.
 */
export async function decideQuote(
  db: Client,
  rfqId: string,
  ownerId: string,
  quoteId: string,
  decision: "accepted" | "declined",
): Promise<boolean> {
  const rfq = await db.execute({
    sql: "SELECT status FROM rfqs WHERE id = ? AND owner_id = ?",
    args: [rfqId, ownerId],
  });
  const status = rfq.rows[0]?.status;
  if (status == null || status !== "open") return false;
  const quote = await db.execute({
    sql: "SELECT id FROM rfq_quotes WHERE id = ? AND rfq_id = ? AND status = 'submitted'",
    args: [quoteId, rfqId],
  });
  if (!quote.rows[0]) return false;
  const now = Date.now();
  if (decision === "declined") {
    await db.execute({
      sql: "UPDATE rfq_quotes SET status = 'declined', updated_at = ? WHERE id = ?",
      args: [now, quoteId],
    });
    return true;
  }
  await db.batch(
    [
      {
        sql: "UPDATE rfq_quotes SET status = 'accepted', updated_at = ? WHERE id = ?",
        args: [now, quoteId],
      },
      {
        sql: "UPDATE rfq_quotes SET status = 'declined', updated_at = ? WHERE rfq_id = ? AND id != ? AND status = 'submitted'",
        args: [now, rfqId, quoteId],
      },
      {
        sql: "UPDATE rfqs SET status = 'awarded', awarded_quote_id = ?, updated_at = ? WHERE id = ?",
        args: [quoteId, now, rfqId],
      },
    ],
    "write",
  );
  return true;
}

export async function insertRfqFile(db: Client, file: Omit<RfqFile, "createdAt">): Promise<void> {
  await db.execute({
    sql: `INSERT INTO rfq_files (id, rfq_id, quote_id, uploader_id, name, pathname, content_type, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      file.id,
      file.rfqId,
      file.quoteId,
      file.uploaderId,
      file.name,
      file.pathname,
      file.contentType,
      file.size,
      Date.now(),
    ],
  });
}

export async function listRfqFiles(db: Client, rfqId: string): Promise<RfqFile[]> {
  const result = await db.execute({
    sql: "SELECT * FROM rfq_files WHERE rfq_id = ? ORDER BY created_at ASC",
    args: [rfqId],
  });
  return result.rows.map(mapFile);
}

export async function getRfqFile(db: Client, id: string): Promise<RfqFile | null> {
  const result = await db.execute({ sql: "SELECT * FROM rfq_files WHERE id = ?", args: [id] });
  const row = result.rows[0];
  return row ? mapFile(row) : null;
}

/**
 * Who may open a file: any business can see RFQ-level files; a quote's file is
 * visible only to the quoter and the RFQ owner.
 */
export function canViewFile(
  file: Pick<RfqFile, "quoteId" | "uploaderId">,
  viewerId: string,
  rfqOwnerId: string,
): boolean {
  if (!file.quoteId) return true;
  return viewerId === file.uploaderId || viewerId === rfqOwnerId;
}

/** Who may message whom about an RFQ. */
export async function canMessageAboutRfq(
  db: Client,
  rfq: Pick<Rfq, "id" | "ownerId">,
  senderId: string,
  recipientId: string,
): Promise<boolean> {
  if (senderId === recipientId) return false;
  // Any business can contact the RFQ owner.
  if (recipientId === rfq.ownerId) return true;
  // The owner can contact businesses that quoted or already wrote to them.
  if (senderId !== rfq.ownerId) return false;
  const quoted = await db.execute({
    sql: "SELECT 1 FROM rfq_quotes WHERE rfq_id = ? AND quoter_id = ? LIMIT 1",
    args: [rfq.id, recipientId],
  });
  if (quoted.rows[0]) return true;
  const wrote = await db.execute({
    sql: "SELECT 1 FROM messages WHERE rfq_id = ? AND sender_id = ? AND recipient_id = ? LIMIT 1",
    args: [rfq.id, recipientId, senderId],
  });
  return Boolean(wrote.rows[0]);
}

export async function insertRfqMessage(
  db: Client,
  message: { id: string; rfqId: string; senderId: string; recipientId: string; body: string },
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO messages (id, listing_id, rfq_id, sender_id, recipient_id, body, created_at, read_at)
      VALUES (?, '', ?, ?, ?, ?, ?, NULL)`,
    args: [message.id, message.rfqId, message.senderId, message.recipientId, message.body, Date.now()],
  });
}

export async function listRfqThread(
  db: Client,
  rfqId: string,
  userId: string,
  otherUserId: string,
): Promise<MessageRow[]> {
  const result = await db.execute({
    sql: `SELECT m.id, m.listing_id, m.rfq_id, r.title AS listing_title,
        m.sender_id, su.shop_name AS sender_shop, m.recipient_id, ru.shop_name AS recipient_shop,
        m.body, m.created_at, m.read_at
      FROM messages m
      JOIN rfqs r ON r.id = m.rfq_id
      JOIN users su ON su.id = m.sender_id
      JOIN users ru ON ru.id = m.recipient_id
      WHERE m.rfq_id = ?
        AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
      ORDER BY m.created_at ASC`,
    args: [rfqId, userId, otherUserId, otherUserId, userId],
  });
  return result.rows.map((row) => ({
    id: text(row.id),
    listingId: "",
    rfqId: text(row.rfq_id),
    listingTitle: text(row.listing_title),
    senderId: text(row.sender_id),
    senderShop: text(row.sender_shop),
    recipientId: text(row.recipient_id),
    recipientShop: text(row.recipient_shop),
    body: text(row.body),
    createdAt: num(row.created_at),
    readAt: row.read_at == null ? null : num(row.read_at),
  }));
}

export async function markRfqThreadRead(
  db: Client,
  rfqId: string,
  recipientId: string,
  senderId: string,
): Promise<void> {
  await db.execute({
    sql: `UPDATE messages SET read_at = ?
      WHERE rfq_id = ? AND recipient_id = ? AND sender_id = ? AND read_at IS NULL`,
    args: [Date.now(), rfqId, recipientId, senderId],
  });
}

function mapRfq(row: Record<string, unknown>): Rfq {
  const categoryRaw = text(row.category);
  const statusRaw = text(row.status);
  return {
    id: text(row.id),
    ownerId: text(row.owner_id),
    companyId: row.company_id ? text(row.company_id) : null,
    companyName: text(row.company_name),
    businessType: text(row.business_type),
    companyVerified: Number(row.company_verified ?? 0) === 1,
    title: text(row.title),
    category: (isCategory(categoryRaw) ? categoryRaw : "other") as Category,
    subtype: text(row.subtype),
    quantity: num(row.quantity),
    unit: text(row.unit) as Unit,
    specs: text(row.specs),
    neededBy: row.needed_by ? text(row.needed_by) : null,
    deliveryZip: text(row.delivery_zip),
    deliveryLocation: text(row.delivery_location),
    budgetCents: row.budget_cents == null ? null : num(row.budget_cents),
    expiresOn: text(row.expires_on),
    status: statusRaw === "awarded" || statusRaw === "closed" ? statusRaw : "open",
    awardedQuoteId: row.awarded_quote_id ? text(row.awarded_quote_id) : null,
    isExample: Number(row.is_example ?? 0) === 1,
    quoteCount: num(row.quote_count),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  const statusRaw = text(row.status);
  return {
    id: text(row.id),
    rfqId: text(row.rfq_id),
    quoterId: text(row.quoter_id),
    companyId: row.company_id ? text(row.company_id) : null,
    companyName: text(row.company_name),
    businessType: text(row.business_type),
    priceCents: num(row.price_cents),
    priceBasis: text(row.price_basis) === "per-unit" ? "per-unit" : "total",
    quantity: num(row.quantity),
    leadTimeDays: num(row.lead_time_days),
    notes: text(row.notes),
    validUntil: text(row.valid_until),
    status: statusRaw === "accepted" || statusRaw === "declined" ? statusRaw : "submitted",
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function mapFile(row: Record<string, unknown>): RfqFile {
  return {
    id: text(row.id),
    rfqId: text(row.rfq_id),
    quoteId: row.quote_id ? text(row.quote_id) : null,
    uploaderId: text(row.uploader_id),
    name: text(row.name),
    pathname: text(row.pathname),
    contentType: text(row.content_type),
    size: num(row.size),
    createdAt: num(row.created_at),
  };
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
