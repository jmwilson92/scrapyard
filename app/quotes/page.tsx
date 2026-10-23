import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { withdrawQuoteAction } from "@/app/actions/rfqs";
import { DatabaseSetup } from "@/components/database-setup";
import { OrderStatusBadge } from "@/components/payments";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { stageLabel } from "@/lib/order-stages";
import {
  isSupplierQuoteStatus,
  SUPPLIER_QUOTE_STATUSES,
  supplierQuoteLabel,
  supplierQuoteStatus,
  type SupplierQuoteStatus,
} from "@/lib/quote-status";
import { isoDay, quoteTotalCents } from "@/lib/rfq";
import { revLabel } from "@/lib/rfq-history";
import { listQuotesByQuoter } from "@/lib/rfq-repo";
import type { OrderStatus } from "@/lib/orders-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "My quotes" };

type SearchParams = Promise<{ status?: string }>;

export default function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <div className="mx-auto grid max-w-3xl gap-5">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">My quotes</h1>
          <p className="mt-2 text-base leading-7 text-neutral-500">Every quote your business has sent, and where it stands.</p>
        </header>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <QuotesBody searchParams={searchParams} />
        </Suspense>
      </div>
    </Shell>
  );
}

const STYLE: Record<SupplierQuoteStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-primary text-white",
  declined: "bg-neutral-200 text-neutral-700",
  withdrawn: "bg-neutral-200 text-neutral-700",
  expired: "bg-neutral-100 text-neutral-600",
  "rfq-closed": "bg-neutral-100 text-neutral-600",
};

async function QuotesBody({ searchParams }: { searchParams: SearchParams }) {
  const [{ status }, loaded] = await Promise.all([searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/quotes");
  const today = isoDay();
  const all = (await listQuotesByQuoter(loaded.db, user.id)).map((quote) => ({
    quote,
    status: supplierQuoteStatus(quote, { status: quote.rfqStatus, expiresOn: quote.rfqExpiresOn }, today),
  }));
  const filter = status && isSupplierQuoteStatus(status) ? status : null;
  const shown = filter ? all.filter((row) => row.status === filter) : all;
  const counts = new Map<string, number>();
  for (const row of all) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

  return (
    <>
      <nav aria-label="Filter by status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip href="/quotes" active={!filter} label={`All (${all.length})`} />
        {SUPPLIER_QUOTE_STATUSES.map(({ value }) => (
          <Chip
            key={value}
            href={`/quotes?status=${value}`}
            active={filter === value}
            label={`${supplierQuoteLabel(value)} (${counts.get(value) ?? 0})`}
          />
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm">
          {all.length === 0 ? (
            <>
              No quotes yet. <Link href="/rfqs" className="font-semibold text-primary">Browse open RFQs</Link>.
            </>
          ) : (
            "No quotes with this status."
          )}
        </p>
      ) : (
        <ul className="grid gap-3">
          {shown.map(({ quote, status: s }) => (
            <li key={quote.id} className="grid gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/rfqs/${quote.rfqId}`} className="min-w-0 font-semibold break-words hover:text-primary">
                  {quote.rfqTitle}
                </Link>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[s]}`}>{supplierQuoteLabel(s)}</span>
              </div>
              <p className="text-sm text-neutral-600">
                {quote.buyerName} · <strong className="text-neutral-900">{formatMoney(quoteTotalCents(quote))}</strong> · Sent{" "}
                {new Date(quote.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" })}
              </p>
              {quote.rfqRevision < quote.currentRevision ? (
                <p className="text-xs font-semibold text-amber-800">
                  RFQ updated since your quote ({revLabel(quote.rfqRevision)} → {revLabel(quote.currentRevision)})
                </p>
              ) : null}
              {quote.orderId && quote.orderStatus ? (
                <Link href={`/orders/${quote.orderId}`} className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm hover:border-primary">
                  Order: <OrderStatusBadge status={quote.orderStatus as OrderStatus} />
                  {quote.orderStage ? <span>· {stageLabel(quote.orderStage)}</span> : null}
                </Link>
              ) : null}
              {s === "pending" ? (
                <form action={withdrawQuoteAction}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <Button type="submit" variant="outline" className="h-11 w-full bg-card px-4 sm:w-auto">Withdraw</Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ring-1 ${active ? "bg-primary text-white ring-primary" : "bg-white text-neutral-700 ring-neutral-200 hover:ring-primary"}`}
    >
      {label}
    </Link>
  );
}
