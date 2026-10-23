"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isSafeId } from "@/lib/paths";
import {
  advanceOrder,
  getOrderById,
  getUserCompanyPayments,
  hasOpenOrder,
  insertOrder,
  setChargesEnabledByAccount,
  setCompanyStripeAccount,
  setOrderCheckoutSession,
} from "@/lib/orders-repo";
import { quoteTotalCents } from "@/lib/rfq";
import { getRfqById, listQuotesForRfq } from "@/lib/rfq-repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { feesFor, getStripe } from "@/lib/stripe";

async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3847";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Seller "Get paid": create (once) a Connect account and send them to onboarding. */
export async function connectStripeAction(): Promise<void> {
  const stripe = getStripe();
  if (!stripe) redirect("/account?payments=off");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (!user.profileComplete) redirect("/account?complete=1");
  const db = await getRequestDb();
  const payments = await getUserCompanyPayments(db, user.id);
  if (!payments.companyId) redirect("/account?complete=1");

  let accountId = payments.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      email: user.email,
      business_type: "company",
      business_profile: { name: user.shopName },
      controller: {
        fees: { payer: "application" },
        losses: { payments: "application" },
        stripe_dashboard: { type: "express" },
      },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { company_id: payments.companyId },
    });
    accountId = account.id;
    await setCompanyStripeAccount(db, payments.companyId, accountId);
  }
  const base = await siteUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/account?payments=retry`,
    return_url: `${base}/account?payments=returned`,
  });
  redirect(link.url);
}

export async function refreshStripeStatusAction(): Promise<void> {
  const stripe = getStripe();
  if (!stripe) redirect("/account?payments=off");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const db = await getRequestDb();
  const payments = await getUserCompanyPayments(db, user.id);
  if (payments.stripeAccountId) {
    const account = await stripe.accounts.retrieve(payments.stripeAccountId);
    await setChargesEnabledByAccount(db, account.id, Boolean(account.charges_enabled));
  }
  revalidatePath("/account");
  redirect("/account?payments=refreshed");
}

export async function stripeDashboardAction(): Promise<void> {
  const stripe = getStripe();
  if (!stripe) redirect("/account?payments=off");
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const db = await getRequestDb();
  const payments = await getUserCompanyPayments(db, user.id);
  if (!payments.stripeAccountId) redirect("/account");
  const link = await stripe.accounts.createLoginLink(payments.stripeAccountId);
  redirect(link.url);
}

/** RFQ owner pays an accepted quote via a destination-charge Checkout Session. */
export async function payQuoteAction(formData: FormData): Promise<void> {
  const rfqId = String(formData.get("rfqId") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!isSafeId(rfqId) || !isSafeId(quoteId)) notFound();
  const stripe = getStripe();
  if (!stripe) redirect(`/rfqs/${rfqId}?pay=off`);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/rfqs/${rfqId}`);
  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq || rfq.ownerId !== user.id) notFound();
  const quote = (await listQuotesForRfq(db, rfqId)).find((q) => q.id === quoteId);
  if (!quote || quote.status !== "accepted") redirect(`/rfqs/${rfqId}?pay=invalid`);
  if (await hasOpenOrder(db, { quoteId })) redirect(`/rfqs/${rfqId}?pay=already`);
  const seller = await getUserCompanyPayments(db, quote.quoterId);
  if (!seller.stripeAccountId || !seller.chargesEnabled) redirect(`/rfqs/${rfqId}?pay=seller`);

  const fees = feesFor(quoteTotalCents(quote));
  const orderId = crypto.randomUUID();
  await insertOrder(db, {
    id: orderId,
    buyerId: user.id,
    sellerId: quote.quoterId,
    listingId: null,
    rfqId,
    quoteId,
    title: rfq.title,
    baseCents: fees.baseCents,
    cardFeeCents: fees.cardFeeCents,
    amountCents: fees.totalCents,
    feeCents: fees.applicationFeeCents,
    stripeAccountId: seller.stripeAccountId,
  });

  const lineItems: { price_data: { currency: string; unit_amount: number; product_data: { name: string } }; quantity: number }[] = [
    {
      price_data: { currency: "usd", unit_amount: fees.baseCents, product_data: { name: `Quote: ${rfq.title}`.slice(0, 250) } },
      quantity: 1,
    },
  ];
  if (fees.cardFeeCents > 0) {
    lineItems.push({
      price_data: { currency: "usd", unit_amount: fees.cardFeeCents, product_data: { name: "Card processing fee" } },
      quantity: 1,
    });
  }
  const base = await siteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    client_reference_id: orderId,
    customer_email: user.email,
    metadata: { order_id: orderId, rfq_id: rfqId, quote_id: quoteId },
    payment_intent_data: {
      application_fee_amount: fees.applicationFeeCents,
      transfer_data: { destination: seller.stripeAccountId },
      metadata: { order_id: orderId },
    },
    success_url: `${base}/orders/${orderId}?checkout=success`,
    cancel_url: `${base}/rfqs/${rfqId}?pay=cancelled`,
  });
  await setOrderCheckoutSession(db, orderId, session.id);
  if (!session.url) redirect(`/orders/${orderId}`);
  redirect(session.url);
}

export async function advanceOrderAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!isSafeId(orderId) || (next !== "shipped" && next !== "completed")) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${orderId}`);
  const db = await getRequestDb();
  const order = await getOrderById(db, orderId);
  if (!order || order.sellerId !== user.id) notFound();
  await advanceOrder(db, orderId, user.id, next);
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}
