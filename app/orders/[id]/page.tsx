import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { advanceOrderAction } from "@/app/actions/payments";
import { DatabaseSetup } from "@/components/database-setup";
import { OrderStatusBadge, PriceBreakdown } from "@/components/payments";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getOrderById } from "@/lib/orders-repo";
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
  const justPaid = query.checkout === "success";

  return (
    <article className="mx-auto grid max-w-2xl gap-5">
      <p className="text-sm">
        <Link href="/orders" className="font-semibold text-primary">Orders</Link>
      </p>
      <header className="grid gap-2">
        <OrderStatusBadge status={order.status} />
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
      {seller && (order.status === "paid" || order.status === "shipped") ? (
        <div className="flex flex-wrap gap-2">
          {order.status === "paid" ? (
            <form action={advanceOrderAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="next" value="shipped" />
              <Button type="submit" className="h-11 px-4">Mark shipped</Button>
            </form>
          ) : null}
          <form action={advanceOrderAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="next" value="completed" />
            <Button type="submit" variant="outline" className="h-11 bg-card px-4">Mark completed</Button>
          </form>
        </div>
      ) : null}
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
