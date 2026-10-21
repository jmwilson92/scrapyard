import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteListingAction, setListingStatusAction } from "@/app/actions/listings";
import { reportListingAction } from "@/app/actions/reports";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingPhoto } from "@/components/listing-photo";
import { MessageForm } from "@/components/message-form";
import { Shell } from "@/components/shell";
import { VerifiedSellerBadge } from "@/components/verified-seller";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS, categoryLabel, formLabel, subtypeLabel } from "@/lib/constants";
import {
  formatDelivery,
  formatDimensions,
  formatDistance,
  formatMoney,
  formatQuantity,
  formatWeight,
} from "@/lib/format";
import { haversineMiles } from "@/lib/geo";
import { isSafeId } from "@/lib/paths";
import { getListingById } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { lookupZip } from "@/lib/zip";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ListingPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-neutral-100" />}>
        <ListingDetail params={params} searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}

async function ListingDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, query, loaded] = await Promise.all([params, searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();

  const [listing, user] = await Promise.all([
    getListingById(loaded.db, id),
    getCurrentUser(),
  ]);
  if (!listing) notFound();

  const from = first(query.from);
  const origin = from ? lookupZip(from) : null;
  const pickup = lookupZip(listing.zip);
  const distance = origin && pickup ? formatDistance(haversineMiles(origin, pickup)) : null;
  const report = first(query.report);
  const owner = user?.id === listing.sellerId;
  const weight = formatWeight(listing.weightLbs);
  const delivers = listing.deliveryMode === "delivery";

  return (
    <article className="grid gap-6 lg:grid-cols-2">
      <ListingPhoto src={listing.photoUrl} alt={listing.title} className="rounded-2xl" />
      <div className="grid content-start gap-4">
        <p className="text-sm text-neutral-500">
          <Link href="/browse" className="font-semibold text-primary">
            Browse
          </Link>
        </p>
        <p className="text-3xl font-bold tracking-tight">{formatMoney(listing.priceCents)}</p>
        <h1 className="text-xl font-semibold leading-7">{listing.title}</h1>
        <p className="text-sm text-neutral-500">
          {pickup ? `${pickup.city}, ${pickup.state} ${listing.zip}` : listing.zip}
          {distance ? ` · ${distance}` : ""}
        </p>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span
            className={
              delivers
                ? "rounded-full bg-primary px-2.5 py-1 text-white"
                : "rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-800"
            }
          >
            {delivers ? "Seller can deliver" : "Buyer pickup only"}
          </span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-800">
            {categoryLabel(listing.category)}
          </span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-800">
            {listing.category === "metal"
              ? subtypeLabel("metal", listing.metalType)
              : subtypeLabel(listing.category, listing.subtype)}
          </span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-800">
            {formLabel(listing.form)}
          </span>
          {listing.isExample ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-800">Example</span>
          ) : null}
          {listing.status === "sold" ? (
            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white">Sold</span>
          ) : null}
          {listing.category === "metal" && listing.certsAvailable ? (
            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-white">Certs</span>
          ) : null}
        </div>
        {listing.isExample ? (
          <p className="rounded-2xl bg-neutral-100 px-3 py-2 text-sm leading-6">
            This shop and listing were seeded so you can try Skrappily. They are not real inventory.
          </p>
        ) : null}
        {listing.status === "sold" ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
            The seller marked this lot sold.
          </p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Fact label="Size" value={formatDimensions(listing) || "Not listed"} />
          <Fact label="Quantity" value={formatQuantity(listing.quantity)} />
          <Fact label="Weight" value={weight ?? "Not listed"} />
          <Fact
            label={listing.category === "metal" ? "Grade" : "Spec"}
            value={listing.alloy || "Not listed"}
          />
          <Fact label="Getting it" value={formatDelivery(listing)} />
          {listing.category === "metal" ? (
            <Fact
              label="Certs"
              value={
                listing.certsAvailable
                  ? listing.certsNote || "Mill test report or certificate of conformance available"
                  : "Not offered"
              }
            />
          ) : null}
        </dl>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Sold by{" "}
            <Link href={`/shops/${listing.sellerId}`} className="font-semibold text-primary hover:underline">
              {listing.shopName}
            </Link>
          </span>
          {listing.sellerVerified ? <VerifiedSellerBadge /> : null}
        </p>
        {listing.notes ? (
          <p className="text-sm leading-6 whitespace-pre-wrap text-neutral-800">{listing.notes}</p>
        ) : null}
        <section className="rounded-2xl bg-neutral-50 px-3 py-3 text-sm leading-6 text-neutral-700">
          <h2 className="font-semibold text-neutral-900">Payment and pickup</h2>
          <p className="mt-1">
            Buyer and seller settle payment directly. Skrappily does not take payment, hold funds, or charge to post or browse.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Meet at the shop during posted hours.</li>
            <li>Check the alloy, size, and quantity before you pay.</li>
            <li>If certs are offered, ask to see the mill test report or certificate of conformance before you leave.</li>
            <li>A delivery fee on the listing is the seller&apos;s note, not a charge through Skrappily.</li>
          </ul>
        </section>

        {owner ? (
          <OwnerPanel id={listing.id} status={listing.status} />
        ) : user ? (
          <div className="rounded-2xl border border-neutral-200 p-4">
            <MessageForm listingId={listing.id} />
          </div>
        ) : (
          <Button
            nativeButton={false}
            render={<Link href={`/login?next=/listings/${listing.id}`} />}
            className="h-11 rounded-full px-4 text-base"
          >
            Sign in to message the seller
          </Button>
        )}

        {!owner ? (
          <details className="rounded-2xl border border-neutral-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Report this listing</summary>
            <ReportNotice code={report} />
            <form action={reportListingAction} className="mt-3 grid gap-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <label className="grid gap-1.5 text-sm font-medium">
                Reason
                <select
                  name="reason"
                  required
                  className="h-11 rounded-xl border border-neutral-300 bg-white px-3"
                  defaultValue="inaccurate"
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Note
                <textarea
                  name="note"
                  maxLength={500}
                  className="min-h-20 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base"
                />
              </label>
              <Button type="submit" variant="outline" className="h-11 rounded-full bg-white px-4">
                Send report
              </Button>
            </form>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function OwnerPanel({ id, status }: { id: string; status: "active" | "sold" }) {
  const nextStatus = status === "active" ? "sold" : "active";
  return (
    <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
      <p className="text-sm font-semibold">This is your listing</p>
      <form action={setListingStatusAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={nextStatus} />
        <Button type="submit" className="h-11 rounded-full px-4 text-base">
          {status === "active" ? "Mark sold" : "Mark available"}
        </Button>
      </form>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-red-700">Delete listing</summary>
        <p className="mt-2 text-sm text-neutral-500">
          This removes the listing, its photo, and the messages on it.
        </p>
        <form action={deleteListingAction} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" className="h-11 rounded-full px-4">
            Delete permanently
          </Button>
        </form>
      </details>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ReportNotice({ code }: { code: string }) {
  if (code === "sent") {
    return <p role="status" className="mt-3 text-sm text-primary">Report received. Thanks for flagging it.</p>;
  }
  if (code === "duplicate") {
    return <p role="status" className="mt-3 text-sm text-neutral-500">You already reported this listing.</p>;
  }
  if (code === "invalid") {
    return <p role="alert" className="mt-3 text-sm text-red-700">Choose a reason before sending the report.</p>;
  }
  if (code === "own") {
    return <p role="alert" className="mt-3 text-sm text-red-700">You can&apos;t report your own listing.</p>;
  }
  return null;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
