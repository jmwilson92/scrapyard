import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { LiveRefresh } from "@/components/live-refresh";
import { OrderTracker } from "@/components/order-tracker";
import { OrderUpdateForm } from "@/components/order-update-form";
import { stageLabel } from "@/lib/order-stages";
import { OrderStatusBadge, PriceBreakdown } from "@/components/payments";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getOrderById, listOrderUpdates } from "@/lib/orders-repo";
import { isSafeId } from "@/lib/paths";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Order" };

export default function OrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <OrderBody params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}

async function OrderBody({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, query, loaded] = await Promise.all([params, searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${id}`);
  const order = await getOrderById(loaded.db, id);
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id)) notFound();
  const seller = order.sellerId === user.id;
  const updates = await listOrderUpdates(loaded.db, order.id);
  const paid = ["paid", "shipped", "completed"].includes(order.status);
  const justPaid = query.checkout === "success";

  return (
    <article className="mx-auto grid max-w-2xl gap-5">
      <p className="text-sm">
        <Link href="/orders" className="font-semibold text-primary">Orders</Link>
      </p>
      <LiveRefresh seconds={30} />
      <header className="grid gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          Payment: <OrderStatusBadge status={order.status} />
          <span>· Stage: <strong className="text-neutral-900">{stageLabel(order.stage)}</strong></span>
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{order.title}</h1>
        <p className="text-sm text-neutral-600">
          {seller ? `Buyer: ${order.buyerName}` : `Supplier: ${order.sellerName}`}
          {order.rfqId ? (
            <>
              {" · "}
              <Link href={`/rfqs/${order.rfqId}`} className="font-semibold text-primary">View RFQ</Link>
            </>
          ) : null}
        </p>
      </header>
      {justPaid && order.status === "pending" ? (
        <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Thanks! We&apos;re confirming your payment with Stripe. Refresh in a moment.
        </p>
      ) : null}
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-2 font-bold">{seller ? "Payout" : "Payment"}</h2>
        {seller ? (
          <dl className="grid gap-1 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-neutral-600">Quote price</dt><dd>{formatMoney(order.baseCents)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-neutral-600">Skrappily fee</dt><dd>−{formatMoney(order.baseCents - (order.amountCents - order.feeCents))}</dd></div>
            <div className="mt-1 flex justify-between gap-3 border-t border-neutral-200 pt-2 font-bold"><dt>You receive</dt><dd>{formatMoney(order.amountCents - order.feeCents)}</dd></div>
          </dl>
        ) : (
          <PriceBreakdown fees={{ baseCents: order.baseCents, cardFeeCents: order.cardFeeCents, totalCents: order.amountCents }} />
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Progress</h2>
        <OrderTracker stage={order.stage} frozen={!paid} />
        {!paid ? (
          <p className="text-sm text-neutral-600">
            {order.status === "refunded" ? "This order was refunded, so progress is paused." : "Progress starts once payment clears."}
          </p>
        ) : null}
      </section>
      {seller && paid && order.stage !== "delivered" ? (
        <section className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
          <h2 className="text-lg font-bold">Post a progress update</h2>
          <p className="text-sm text-neutral-600">The buyer sees it here right away and gets an inbox message.</p>
          <OrderUpdateForm orderId={order.id} stage={order.stage} />
        </section>
      ) : null}
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Timeline</h2>
        <ol className="grid gap-0 border-l-2 border-neutral-200 pl-4">
          {updates.map((update) => (
            <li key={update.id} className="relative pb-4">
              <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-primary" aria-hidden />
              <p className="text-sm font-semibold">{stageLabel(update.stage)}</p>
              <p className="text-xs text-neutral-500"><time dateTime={new Date(update.createdAt).toISOString()}>{formatWhen(update.createdAt)}</time></p>
              {update.note ? <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{update.note}</p> : null}
              {update.fileId ? (
                update.fileType?.startsWith("image/") ? (
                  <a href={`/rfqs/files/${update.fileId}`} className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold hover:border-primary">
                    Photo: {update.fileName}
                  </a>
                ) : (
                  <a href={`/rfqs/files/${update.fileId}`} className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold hover:border-primary">
                    {update.fileName}
                  </a>
                )
              ) : null}
            </li>
          ))}
          {order.paidAt ? (
            <li className="relative pb-4">
              <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-primary" aria-hidden />
              <p className="text-sm font-semibold">Order placed / Paid</p>
              <p className="text-xs text-neutral-500">{formatWhen(order.paidAt)}</p>
            </li>
          ) : null}
          <li className="relative">
            <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-neutral-300" aria-hidden />
            <p className="text-sm font-semibold">Checkout started</p>
            <p className="text-xs text-neutral-500">{formatWhen(order.createdAt)}</p>
          </li>
        </ol>
      </section>
      {order.rfqId ? (
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={`/inbox/rfq/${order.rfqId}/${seller ? order.buyerId : order.sellerId}`} />}
          className="h-11 w-full bg-card px-4 sm:w-auto"
        >
          Message this business
        </Button>
      ) : null}
    </article>
  );
}

function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(new Date(ms));
}
