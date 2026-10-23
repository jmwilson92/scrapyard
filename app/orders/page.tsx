import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { OrderStatusBadge } from "@/components/payments";
import { Shell } from "@/components/shell";
import { formatMoney } from "@/lib/format";
import { listOrdersForUser, type Order } from "@/lib/orders-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Shell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <OrdersBody />
      </Suspense>
    </Shell>
  );
}

async function OrdersBody() {
  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/orders");
  const { buying, selling } = await listOrdersForUser(loaded.db, user.id);
  const visible = (orders: Order[]) => orders.filter((o) => o.status !== "pending" || Date.now() - o.createdAt < 86_400_000);
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
      <OrderList title="Buying" empty="No purchases yet. Pay for an accepted RFQ quote to see it here." orders={visible(buying)} other="seller" />
      <OrderList title="Selling" empty="No sales yet. When a buyer pays one of your quotes it shows up here." orders={visible(selling)} other="buyer" />
    </div>
  );
}

function OrderList({ title, empty, orders, other }: { title: string; empty: string; orders: Order[]; other: "buyer" | "seller" }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {orders.length === 0 ? (
        <p className="rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-primary"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{order.title}</span>
                  <span className="text-sm text-neutral-500">
                    {other === "seller" ? order.sellerName : order.buyerName} ·{" "}
                    {formatMoney(other === "seller" ? order.amountCents : order.amountCents - order.feeCents)}
                  </span>
                </span>
                <OrderStatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
