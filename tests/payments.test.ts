import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import type Stripe from "stripe";
import { createDbClient, migrate } from "@/lib/db";
import { computeFees, DEFAULT_FEES, feeConfigFromEnv } from "@/lib/fees";
import {
  advanceOrder,
  getOrderById,
  getUserCompanyPayments,
  hasOpenOrder,
  insertOrder,
  listOrdersForUser,
  setCompanyStripeAccount,
} from "@/lib/orders-repo";
import { insertUser } from "@/lib/repo";
import { handleStripeEvent } from "@/lib/stripe-webhook";

const files: string[] = [];
afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  }
});

describe("fee math", () => {
  it("defaults to a 1% fee with card costs passed to the buyer", () => {
    expect(DEFAULT_FEES.platformFeePercent).toBe(1);
    expect(DEFAULT_FEES.passThroughCardFees).toBe(true);
    const fees = computeFees(100_000);
    expect(fees.platformFeeCents).toBe(1000);
    // ceil((100000 + 30) / 0.971) = 103018
    expect(fees.totalCents).toBe(103_018);
    expect(fees.cardFeeCents).toBe(3018);
    expect(fees.sellerPayoutCents).toBe(99_000);
    expect(fees.applicationFeeCents).toBe(4018);
    expect(fees.totalCents).toBe(fees.baseCents + fees.cardFeeCents);
    // Platform keeps ~its full 1% after Stripe's cut.
    expect(fees.estimatedNetCents).toBeGreaterThanOrEqual(999);
  });

  it("without pass-through, buyer pays the price and the seller absorbs the fee", () => {
    const fees = computeFees(10_000, { ...DEFAULT_FEES, passThroughCardFees: false, platformFeePercent: 3 });
    expect(fees.totalCents).toBe(10_000);
    expect(fees.cardFeeCents).toBe(0);
    expect(fees.applicationFeeCents).toBe(300);
    expect(fees.sellerPayoutCents).toBe(9700);
    expect(fees.estimatedNetCents).toBe(300 - 320);
  });

  it("never leaves the platform short across many amounts", () => {
    for (const base of [100, 999, 2500, 12_345, 777_777]) {
      const fees = computeFees(base);
      expect(fees.estimatedNetCents).toBeGreaterThanOrEqual(fees.platformFeeCents - 1);
    }
  });

  it("reads env overrides and rejects junk", () => {
    expect(feeConfigFromEnv({})).toEqual(DEFAULT_FEES);
    const cfg = feeConfigFromEnv({
      PLATFORM_FEE_PERCENT: "2.5",
      STRIPE_PASS_THROUGH_CARD_FEES: "false",
      STRIPE_CARD_FEE_PERCENT: "3.1",
      STRIPE_CARD_FEE_FIXED_CENTS: "25",
    });
    expect(cfg).toEqual({ platformFeePercent: 2.5, passThroughCardFees: false, cardFeePercent: 3.1, cardFeeFixedCents: 25 });
    expect(feeConfigFromEnv({ PLATFORM_FEE_PERCENT: "abc", STRIPE_CARD_FEE_FIXED_CENTS: "-4" })).toEqual(DEFAULT_FEES);
    expect(() => computeFees(0)).toThrow();
    expect(() => computeFees(10.5)).toThrow();
  });
});

describe("orders and webhooks", () => {
  it("marks quote orders paid once, then shipped, completed, refunded; syncs account status", async () => {
    const db = await tempDb();
    for (const id of ["buyer", "seller"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await migrate(db);
    const sellerCo = await getUserCompanyPayments(db, "seller");
    expect(sellerCo.companyId).toBeTruthy();
    await setCompanyStripeAccount(db, sellerCo.companyId!, "acct_test1");

    await handleStripeEvent(db, evt("evt_a", "account.updated", { id: "acct_test1", charges_enabled: true }));
    expect((await getUserCompanyPayments(db, "seller")).chargesEnabled).toBe(true);

    const fees = computeFees(50_000);
    await insertOrder(db, {
      id: "order-1",
      buyerId: "buyer",
      sellerId: "seller",
      listingId: null,
      rfqId: "rfq-1",
      quoteId: "quote-1",
      title: "Plate",
      baseCents: fees.baseCents,
      cardFeeCents: fees.cardFeeCents,
      amountCents: fees.totalCents,
      feeCents: fees.applicationFeeCents,
      stripeAccountId: "acct_test1",
    });
    expect(await hasOpenOrder(db, { quoteId: "quote-1" })).toBe(false);

    const completed = evt("evt_b", "checkout.session.completed", {
      id: "cs_1",
      payment_status: "paid",
      metadata: { order_id: "order-1" },
      client_reference_id: "order-1",
      payment_intent: "pi_1",
    });
    expect(await handleStripeEvent(db, completed)).toBe(true);
    expect(await handleStripeEvent(db, completed)).toBe(false); // duplicate
    let order = await getOrderById(db, "order-1");
    expect(order?.status).toBe("paid");
    expect(order?.stripePaymentIntentId).toBe("pi_1");
    expect(await hasOpenOrder(db, { quoteId: "quote-1" })).toBe(true);

    expect(await advanceOrder(db, "order-1", "buyer", "shipped")).toBe(false);
    expect(await advanceOrder(db, "order-1", "seller", "shipped")).toBe(true);
    expect(await advanceOrder(db, "order-1", "seller", "completed")).toBe(true);
    expect(await advanceOrder(db, "order-1", "seller", "shipped")).toBe(false);

    await handleStripeEvent(db, evt("evt_c", "charge.refunded", { id: "ch_1", refunded: true, payment_intent: "pi_1" }));
    order = await getOrderById(db, "order-1");
    expect(order?.status).toBe("refunded");

    const lists = await listOrdersForUser(db, "seller");
    expect(lists.selling.map((o) => o.id)).toEqual(["order-1"]);
    expect(lists.buying).toEqual([]);
  });

  it("ignores unpaid async completions and marks failures", async () => {
    const db = await tempDb();
    for (const id of ["b", "s"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await insertOrder(db, {
      id: "order-2", buyerId: "b", sellerId: "s", listingId: null, rfqId: "r", quoteId: "q", title: "T",
      baseCents: 100, cardFeeCents: 34, amountCents: 134, feeCents: 35, stripeAccountId: "acct_x",
    });
    await handleStripeEvent(db, evt("e1", "checkout.session.completed", { id: "cs_2", payment_status: "unpaid", metadata: { order_id: "order-2" } }));
    expect((await getOrderById(db, "order-2"))?.status).toBe("pending");
    await handleStripeEvent(db, evt("e2", "checkout.session.async_payment_failed", { id: "cs_2", metadata: { order_id: "order-2" } }));
    expect((await getOrderById(db, "order-2"))?.status).toBe("failed");
  });
});

function evt(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

async function tempDb(): Promise<Client> {
  const file = path.join(os.tmpdir(), `skrappily-pay-${crypto.randomUUID()}.db`);
  files.push(file);
  const db = createDbClient(`file:${file}`);
  await migrate(db);
  return db;
}
