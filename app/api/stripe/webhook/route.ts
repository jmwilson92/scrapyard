import type Stripe from "stripe";
import { getDatabase } from "@/lib/db";
import { getStripe, webhookSecrets } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/stripe-webhook";

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe();
  const secrets = webhookSecrets();
  if (!stripe || secrets.length === 0) {
    return new Response("Stripe is not configured.", { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature.", { status: 400 });
  const payload = await request.text(); // raw body, required for verification

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {
      // try the next endpoint secret (platform vs connected accounts)
    }
  }
  if (!event) return new Response("Invalid signature.", { status: 400 });

  try {
    const db = await getDatabase();
    const fresh = await handleStripeEvent(db, event);
    return Response.json({ received: true, duplicate: !fresh });
  } catch (error) {
    console.error("Stripe webhook failed", event.type, event.id, error);
    return new Response("Webhook handler failed.", { status: 500 });
  }
}
