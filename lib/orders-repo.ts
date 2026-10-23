import type { Client } from "@libsql/client";

export const ORDER_STATUSES = ["pending", "paid", "shipped", "completed", "refunded", "failed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Order = {
  id: string;
  buyerId: string;
  buyerCompanyId: string | null;
  buyerName: string;
  sellerId: string;
  sellerCompanyId: string | null;
  sellerName: string;
  listingId: string | null;
  rfqId: string | null;
  quoteId: string | null;
  title: string;
  baseCents: number;
  cardFeeCents: number;
  amountCents: number;
  feeCents: number;
  currency: string;
  status: OrderStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeAccountId: string;
  paidAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type NewOrder = Pick<
  Order,
  | "id"
  | "buyerId"
  | "sellerId"
  | "listingId"
  | "rfqId"
  | "quoteId"
  | "title"
  | "baseCents"
  | "cardFeeCents"
  | "amountCents"
  | "feeCents"
  | "stripeAccountId"
>;

export type CompanyPayments = { stripeAccountId: string | null; chargesEnabled: boolean };

const ORDER_SELECT = `
  SELECT o.*, COALESCE(bc.name, bu.shop_name) AS buyer_name, COALESCE(sc.name, su.shop_name) AS seller_name
  FROM orders o
  JOIN users bu ON bu.id = o.buyer_id
  JOIN users su ON su.id = o.seller_id
  LEFT JOIN companies bc ON bc.id = o.buyer_company_id
  LEFT JOIN companies sc ON sc.id = o.seller_company_id
`;

export async function getCompanyPayments(db: Client, companyId: string): Promise<CompanyPayments> {
  const result = await db.execute({
    sql: "SELECT stripe_account_id, charges_enabled FROM companies WHERE id = ?",
    args: [companyId],
  });
  const row = result.rows[0];
  return {
    stripeAccountId: row?.stripe_account_id ? String(row.stripe_account_id) : null,
    chargesEnabled: Number(row?.charges_enabled ?? 0) === 1,
  };
}

/** Payments state for the company a user belongs to. */
export async function getUserCompanyPayments(
  db: Client,
  userId: string,
): Promise<CompanyPayments & { companyId: string | null }> {
  const result = await db.execute({ sql: "SELECT company_id FROM users WHERE id = ?", args: [userId] });
  const companyId = result.rows[0]?.company_id ? String(result.rows[0].company_id) : null;
  if (!companyId) return { companyId: null, stripeAccountId: null, chargesEnabled: false };
  return { companyId, ...(await getCompanyPayments(db, companyId)) };
}

export async function setCompanyStripeAccount(db: Client, companyId: string, accountId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE companies SET stripe_account_id = ? WHERE id = ? AND stripe_account_id IS NULL",
    args: [accountId, companyId],
  });
}

export async function setChargesEnabledByAccount(db: Client, accountId: string, enabled: boolean): Promise<void> {
  await db.execute({
    sql: "UPDATE companies SET charges_enabled = ? WHERE stripe_account_id = ?",
    args: [enabled ? 1 : 0, accountId],
  });
}

export async function insertOrder(db: Client, order: NewOrder): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO orders (id, buyer_id, buyer_company_id, seller_id, seller_company_id, listing_id, rfq_id,
      quote_id, title, base_cents, card_fee_cents, amount_cents, fee_cents, status, stripe_account_id,
      created_at, updated_at)
      VALUES (?, ?, (SELECT company_id FROM users WHERE id = ?), ?, (SELECT company_id FROM users WHERE id = ?),
        ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    args: [
      order.id,
      order.buyerId,
      order.buyerId,
      order.sellerId,
      order.sellerId,
      order.listingId,
      order.rfqId,
      order.quoteId,
      order.title,
      order.baseCents,
      order.cardFeeCents,
      order.amountCents,
      order.feeCents,
      order.stripeAccountId,
      now,
      now,
    ],
  });
}

export async function setOrderCheckoutSession(db: Client, orderId: string, sessionId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE orders SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?",
    args: [sessionId, Date.now(), orderId],
  });
}

export async function getOrderById(db: Client, id: string): Promise<Order | null> {
  const result = await db.execute({ sql: `${ORDER_SELECT} WHERE o.id = ?`, args: [id] });
  return result.rows[0] ? mapOrder(result.rows[0]) : null;
}

export async function listOrdersForUser(db: Client, userId: string): Promise<{ buying: Order[]; selling: Order[] }> {
  const [buying, selling] = await Promise.all([
    db.execute({ sql: `${ORDER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 200`, args: [userId] }),
    db.execute({ sql: `${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 200`, args: [userId] }),
  ]);
  return { buying: buying.rows.map(mapOrder), selling: selling.rows.map(mapOrder) };
}

/** Marks a pending order paid. Returns the order when this call changed it. */
export async function markOrderPaid(
  db: Client,
  orderId: string,
  sessionId: string,
  paymentIntentId: string | null,
): Promise<Order | null> {
  const now = Date.now();
  const result = await db.execute({
    sql: `UPDATE orders SET status = 'paid', paid_at = ?, updated_at = ?, stripe_checkout_session_id = ?,
        stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
      WHERE id = ? AND status IN ('pending', 'failed')`,
    args: [now, now, sessionId, paymentIntentId, orderId],
  });
  if (result.rowsAffected === 0) return null;
  const order = await getOrderById(db, orderId);
  if (order?.listingId) {
    await db.execute({
      sql: "UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?",
      args: [now, order.listingId],
    });
  }
  return order;
}

export async function markOrderFailed(db: Client, orderId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'",
    args: [Date.now(), orderId],
  });
}

export async function markOrderRefundedByPaymentIntent(db: Client, paymentIntentId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE orders SET status = 'refunded', updated_at = ? WHERE stripe_payment_intent_id = ?",
    args: [Date.now(), paymentIntentId],
  });
}

/** Seller fulfilment: paid → shipped → completed (or paid → completed). */
export async function advanceOrder(
  db: Client,
  orderId: string,
  sellerId: string,
  next: "shipped" | "completed",
): Promise<boolean> {
  const from = next === "shipped" ? ["paid"] : ["paid", "shipped"];
  const result = await db.execute({
    sql: `UPDATE orders SET status = ?, updated_at = ?
      WHERE id = ? AND seller_id = ? AND status IN (${from.map(() => "?").join(", ")})`,
    args: [next, Date.now(), orderId, sellerId, ...from],
  });
  return result.rowsAffected > 0;
}

/** Records a webhook event id. Returns false when it was already processed. */
export async function claimStripeEvent(db: Client, id: string, type: string): Promise<boolean> {
  const result = await db.execute({
    sql: "INSERT INTO stripe_events (id, type, received_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING",
    args: [id, type, Date.now()],
  });
  return result.rowsAffected > 0;
}

export async function releaseStripeEvent(db: Client, id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM stripe_events WHERE id = ?", args: [id] });
}

/** Paid/active order already exists for this listing or quote. */
export async function hasOpenOrder(
  db: Client,
  target: { listingId?: string; quoteId?: string },
): Promise<boolean> {
  const column = target.listingId ? "listing_id" : "quote_id";
  const value = target.listingId ?? target.quoteId ?? "";
  const result = await db.execute({
    sql: `SELECT 1 FROM orders WHERE ${column} = ? AND status IN ('paid', 'shipped', 'completed') LIMIT 1`,
    args: [value],
  });
  return Boolean(result.rows[0]);
}

export function orderStatusLabel(status: OrderStatus): string {
  return {
    pending: "Awaiting payment",
    paid: "Paid",
    shipped: "Shipped",
    completed: "Completed",
    refunded: "Refunded",
    failed: "Payment failed",
  }[status];
}

function mapOrder(row: Record<string, unknown>): Order {
  const status = String(row.status ?? "pending");
  return {
    id: text(row.id),
    buyerId: text(row.buyer_id),
    buyerCompanyId: opt(row.buyer_company_id),
    buyerName: text(row.buyer_name),
    sellerId: text(row.seller_id),
    sellerCompanyId: opt(row.seller_company_id),
    sellerName: text(row.seller_name),
    listingId: opt(row.listing_id),
    rfqId: opt(row.rfq_id),
    quoteId: opt(row.quote_id),
    title: text(row.title),
    baseCents: num(row.base_cents),
    cardFeeCents: num(row.card_fee_cents),
    amountCents: num(row.amount_cents),
    feeCents: num(row.fee_cents),
    currency: text(row.currency) || "usd",
    status: (ORDER_STATUSES as readonly string[]).includes(status) ? (status as OrderStatus) : "pending",
    stripeCheckoutSessionId: opt(row.stripe_checkout_session_id),
    stripePaymentIntentId: opt(row.stripe_payment_intent_id),
    stripeAccountId: text(row.stripe_account_id),
    paidAt: row.paid_at == null ? null : num(row.paid_at),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function text(v: unknown): string {
  return v == null ? "" : String(v);
}
function opt(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}
function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
