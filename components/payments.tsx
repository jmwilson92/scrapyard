import Link from "next/link";
import { payQuoteAction } from "@/app/actions/payments";
import { Button } from "@/components/ui/button";
import type { FeeBreakdown } from "@/lib/fees";
import { formatMoney } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders-repo";

export function PriceBreakdown({ fees }: { fees: Pick<FeeBreakdown, "baseCents" | "cardFeeCents" | "totalCents"> }) {
  return (
    <dl className="grid gap-1 text-sm">
      <Row label="Quote price" value={formatMoney(fees.baseCents)} />
      {fees.cardFeeCents > 0 ? <Row label="Card processing fee" value={formatMoney(fees.cardFeeCents)} /> : null}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-2 font-bold">
        <dt>Total</dt>
        <dd>{formatMoney(fees.totalCents)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function PayQuotePanel({
  rfqId,
  quoteId,
  fees,
  sellerReady,
  existingOrder,
}: {
  rfqId: string;
  quoteId: string;
  fees: FeeBreakdown;
  sellerReady: boolean;
  existingOrder: { id: string; status: OrderStatus } | null;
}) {
  if (existingOrder && existingOrder.status !== "pending" && existingOrder.status !== "failed") {
    return (
      <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm">
        {orderStatusLabel(existingOrder.status)} ·{" "}
        <Link href={`/orders/${existingOrder.id}`} className="font-semibold text-primary">View order</Link>
      </p>
    );
  }
  return (
    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:max-w-sm">
      <PriceBreakdown fees={fees} />
      {sellerReady ? (
        <form action={payQuoteAction}>
          <input type="hidden" name="rfqId" value={rfqId} />
          <input type="hidden" name="quoteId" value={quoteId} />
          <Button type="submit" className="h-11 w-full px-4 text-base">
            Pay for this quote · {formatMoney(fees.totalCents)}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-neutral-600">
          This supplier hasn&apos;t set up payouts yet. Message them, or settle payment directly.
        </p>
      )}
      <p className="text-xs text-neutral-500">Secure checkout by Stripe. Card details never touch Skrappily.</p>
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const style =
    status === "paid" || status === "shipped"
      ? "bg-primary text-white"
      : status === "completed"
        ? "bg-neutral-900 text-white"
        : status === "refunded" || status === "failed"
          ? "bg-red-50 text-red-700"
          : "bg-amber-100 text-amber-900";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{orderStatusLabel(status)}</span>;
}
