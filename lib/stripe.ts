import "server-only";
import Stripe from "stripe";
import { computeFees, feeConfigFromEnv, type FeeBreakdown } from "@/lib/fees";

let client: Stripe | null | undefined;

/** Stripe client, or null when STRIPE_SECRET_KEY is not set (pay buttons hidden). */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}

export function paymentsEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function feesFor(baseCents: number): FeeBreakdown {
  return computeFees(baseCents, feeConfigFromEnv(process.env));
}

/** Signing secrets: platform endpoint and connected-accounts endpoint. */
export function webhookSecrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (value): value is string => Boolean(value),
  );
}
