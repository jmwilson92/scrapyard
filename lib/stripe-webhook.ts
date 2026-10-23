import type { Client } from "@libsql/client";
import type Stripe from "stripe";
import {
  claimStripeEvent,
  markOrderFailed,
  markOrderPaid,
  markOrderRefundedByPaymentIntent,
  releaseStripeEvent,
  setChargesEnabledByAccount,
} from "@/lib/orders-repo";

/**
 * Applies one verified Stripe event. Idempotent: an event id is processed at
 * most once; if processing throws, the claim is released so Stripe's retry runs.
 * Returns false when the event was a duplicate.
 */
export async function handleStripeEvent(db: Client, event: Stripe.Event): Promise<boolean> {
  if (!(await claimStripeEvent(db, event.id, event.type))) return false;
  try {
    await apply(db, event);
    return true;
  } catch (error) {
    await releaseStripeEvent(db, event.id);
    throw error;
  }
}

async function apply(db: Client, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "paid") return; // async methods settle later
      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      if (!orderId) return;
      await markOrderPaid(db, orderId, session.id, idOf(session.payment_intent));
      return;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.order_id ?? session.client_reference_id;
      if (orderId) await markOrderFailed(db, orderId);
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = idOf(charge.payment_intent);
      if (pi && charge.refunded) await markOrderRefundedByPaymentIntent(db, pi);
      return;
    }
    case "account.updated": {
      const account = event.data.object;
      await setChargesEnabledByAccount(db, account.id, Boolean(account.charges_enabled));
      return;
    }
    default:
      return;
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}
