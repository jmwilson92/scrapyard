import Link from "next/link";
import { businessTypeLabel } from "@/lib/business";
import { categoryLabel, subtypeLabel } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { displayRfqStatus, unitLabel } from "@/lib/rfq";
import type { Rfq } from "@/lib/rfq-repo";
import { lookupZip } from "@/lib/zip";

export function RfqStatusBadge({ rfq }: { rfq: Pick<Rfq, "status" | "expiresOn"> }) {
  const status = displayRfqStatus(rfq);
  const style =
    status === "open"
      ? "bg-primary text-white"
      : status === "awarded"
        ? "bg-copper text-white"
        : "bg-neutral-200 text-neutral-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${style}`}>{status}</span>
  );
}

export function formatQty(quantity: number, unit: string): string {
  return `${quantity.toLocaleString("en-US")} ${unitLabel(unit)}`;
}

export function RfqCard({ rfq }: { rfq: Rfq }) {
  const place = lookupZip(rfq.deliveryZip);
  return (
    <Link
      href={`/rfqs/${rfq.id}`}
      className="block rounded-2xl border border-neutral-200 bg-white p-4 hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <RfqStatusBadge rfq={rfq} />
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-800">
          {categoryLabel(rfq.category)} · {subtypeLabel(rfq.category, rfq.subtype)}
        </span>
        {rfq.isExample ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">Example</span>
        ) : null}
      </div>
      <h2 className="mt-2 line-clamp-2 text-base leading-6 font-semibold">{rfq.title}</h2>
      <p className="mt-1 text-sm text-neutral-600">
        {formatQty(rfq.quantity, rfq.unit)}
        {rfq.budgetCents != null ? ` · Budget ${formatMoney(rfq.budgetCents)}` : " · Taking quotes"}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {rfq.companyName}
        {rfq.businessType ? ` · ${businessTypeLabel(rfq.businessType)}` : ""}
        {place ? ` · Deliver to ${place.city}, ${place.state}` : ""}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {rfq.neededBy ? `Needed by ${rfq.neededBy} · ` : ""}Quotes due {rfq.expiresOn} · {rfq.quoteCount}{" "}
        {rfq.quoteCount === 1 ? "quote" : "quotes"}
      </p>
    </Link>
  );
}
