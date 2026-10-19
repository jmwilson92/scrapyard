import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteListingAction, setListingStatusAction } from "@/app/actions/listings";
import { reportListingAction } from "@/app/actions/reports";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingPhoto } from "@/components/listing-photo";
import { MessageForm } from "@/components/message-form";
import { Shell } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS, formLabel, materialLabel } from "@/lib/constants";
import {
  formatDimensions,
  formatDistance,
  formatMoney,
  formatQuantity,
  formatWeight,
} from "@/lib/format";
import { isSafeId } from "@/lib/paths";
import { getListingById } from "@/lib/repo";
import { haversineMiles } from "@/lib/geo";
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
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-muted" />}>
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
  const [{ id }, query, loaded] = await Promise.all([
    params,
    searchParams,
    loadRequestDb(),
  ]);
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
  const distance =
    origin && pickup ? formatDistance(haversineMiles(origin, pickup)) : null;
  const report = first(query.report);
  const owner = user?.id === listing.sellerId;
  const weight = formatWeight(listing.weightLbs);

  return (
    <article className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <ListingPhoto src={listing.photoUrl} alt={listing.title} className="rounded-xl" />
      </div>
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap gap-2">
          {listing.isExample ? <Badge variant="secondary">Example data</Badge> : null}
          {listing.status === "sold" ? <Badge variant="destructive">Sold</Badge> : null}
          <Badge variant="outline">
            {materialLabel(listing.material)} · {formLabel(listing.form)}
          </Badge>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.14em] text-copper uppercase">
            {listing.alloy}
          </p>
          <h1 className="mt-1 font-display text-4xl leading-none tracking-wide sm:text-5xl">
            {listing.title}
          </h1>
        </div>
        {listing.isExample ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm leading-6">
            This shop and listing were seeded so you can try DropYard. They are
            not real inventory.
          </p>
        ) : null}
        {listing.status === "sold" ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            The seller marked this lot sold. It stays off the browse board.
          </p>
        ) : null}
        <p
          className={
            listing.priceCents == null
              ? "font-display text-5xl tracking-wide text-primary"
              : "font-display text-5xl tracking-wide text-copper"
          }
        >
          {formatMoney(listing.priceCents)}
          {listing.priceCents != null ? (
            <span className="ml-2 font-sans text-sm font-medium text-muted-foreground">
              for the lot
            </span>
          ) : null}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Fact label="Size" value={formatDimensions(listing) || "Not listed"} />
          <Fact label="Quantity" value={formatQuantity(listing.quantity)} />
          <Fact label="Weight" value={weight ?? "Not listed"} />
          <Fact
            label="Pickup"
            value={
              pickup
                ? `${pickup.city}, ${pickup.state} ${listing.zip}`
                : listing.zip
            }
          />
        </dl>
        {distance ? (
          <p className="text-sm text-muted-foreground">
            About {distance} from {from}.
          </p>
        ) : null}
        <p className="text-sm leading-6">
          Sold by <span className="font-semibold">{listing.shopName}</span>
        </p>
        {listing.notes ? (
          <p className="rounded-xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">
            {listing.notes}
          </p>
        ) : null}

        {owner ? (
          <OwnerPanel id={listing.id} status={listing.status} />
        ) : user ? (
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <MessageForm listingId={listing.id} />
          </div>
        ) : (
          <Button
            nativeButton={false}
            render={
              <Link href={`/login?next=/listings/${listing.id}`} />
            }
            className="h-11 px-4 text-base"
          >
            Sign in to message the seller
          </Button>
        )}

        {!owner ? (
          <details className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <summary className="cursor-pointer text-sm font-semibold">
              Report this listing
            </summary>
            <ReportNotice code={report} />
            <form action={reportListingAction} className="mt-3 grid gap-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <label className="grid gap-1.5 text-sm font-medium">
                Reason
                <select
                  name="reason"
                  required
                  className="h-11 rounded-lg border border-input bg-card px-3"
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
                  className="min-h-20 rounded-lg border border-input bg-card px-3 py-2 text-base"
                />
              </label>
              <Button type="submit" variant="outline" className="h-11 bg-card px-4">
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
    <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm font-semibold">This is your listing</p>
      <form action={setListingStatusAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={nextStatus} />
        <Button type="submit" className="h-11 px-4 text-base">
          {status === "active" ? "Mark sold" : "Mark available"}
        </Button>
      </form>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-destructive">
          Delete listing
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          This removes the listing, its photo, and the messages on it.
        </p>
        <form action={deleteListingAction} className="mt-3">
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="destructive" className="h-11 px-4">
            Delete permanently
          </Button>
        </form>
      </details>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-2">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function ReportNotice({ code }: { code: string }) {
  if (code === "sent") {
    return (
      <p role="status" className="mt-3 text-sm text-primary">
        Report received. Thanks for flagging it.
      </p>
    );
  }
  if (code === "duplicate") {
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        You already reported this listing.
      </p>
    );
  }
  if (code === "invalid") {
    return (
      <p role="alert" className="mt-3 text-sm text-destructive">
        Choose a reason before sending the report.
      </p>
    );
  }
  if (code === "own") {
    return (
      <p role="alert" className="mt-3 text-sm text-destructive">
        You can&apos;t report your own listing.
      </p>
    );
  }
  return null;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
