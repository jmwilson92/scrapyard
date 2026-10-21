import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { closeRfqAction, decideQuoteAction } from "@/app/actions/rfqs";
import { DatabaseSetup } from "@/components/database-setup";
import { formatQty, RfqStatusBadge } from "@/components/rfq-card";
import { QuoteForm } from "@/components/rfq-forms";
import { AttachmentWarning } from "@/components/rfq-forms";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/attachments";
import { businessTypeLabel } from "@/lib/business";
import { categoryLabel, subtypeLabel } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { isSafeId } from "@/lib/paths";
import { acceptsQuotes, quoteTotalCents, unitLabel } from "@/lib/rfq";
import {
  canViewFile,
  findQuoteByQuoter,
  getRfqById,
  listQuotesForRfq,
  listRfqFiles,
  type Quote,
  type RfqFile,
} from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { lookupZip } from "@/lib/zip";

type Params = Promise<{ id: string }>;

export const metadata = { title: "RFQ" };

export default function RfqPage({ params }: { params: Params }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />}>
        <RfqDetail params={params} />
      </Suspense>
    </Shell>
  );
}

async function RfqDetail({ params }: { params: Params }) {
  const [{ id }, loaded] = await Promise.all([params, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();
  const db = loaded.db;
  const [rfq, user] = await Promise.all([getRfqById(db, id), getCurrentUser()]);
  if (!rfq) notFound();

  const owner = user?.id === rfq.ownerId;
  const files = user ? await listRfqFiles(db, id) : [];
  const visibleFiles = user ? files.filter((file) => canViewFile(file, user.id, rfq.ownerId)) : [];
  const rfqFiles = visibleFiles.filter((file) => !file.quoteId);
  const quotes = owner ? await listQuotesForRfq(db, id) : [];
  const myQuote = user && !owner ? await findQuoteByQuoter(db, id, user.id) : null;
  const open = acceptsQuotes(rfq);
  const place = lookupZip(rfq.deliveryZip);

  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <p className="text-sm">
        <Link href="/rfqs" className="font-semibold text-primary">RFQs</Link>
      </p>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <RfqStatusBadge rfq={rfq} />
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
            {categoryLabel(rfq.category)} · {subtypeLabel(rfq.category, rfq.subtype)}
          </span>
          {rfq.isExample ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">Example</span> : null}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{rfq.title}</h1>
        <p className="text-sm text-neutral-600">
          Requested by{" "}
          <Link href={`/shops/${rfq.ownerId}`} className="font-semibold text-primary hover:underline">
            {rfq.companyName}
          </Link>
          {rfq.businessType ? ` · ${businessTypeLabel(rfq.businessType)}` : ""}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Fact label="Quantity" value={formatQty(rfq.quantity, rfq.unit)} />
        <Fact label="Budget" value={rfq.budgetCents != null ? formatMoney(rfq.budgetCents) : "Taking quotes"} />
        <Fact label="Needed by" value={rfq.neededBy ?? "Flexible"} />
        <Fact label="Quotes due" value={rfq.expiresOn} />
        <Fact label="Deliver to" value={place ? `${place.city}, ${place.state} ${rfq.deliveryZip}` : rfq.deliveryZip} />
        {rfq.deliveryLocation ? <Fact label="Delivery notes" value={rfq.deliveryLocation} /> : null}
      </dl>

      <section>
        <h2 className="text-lg font-bold">Specs</h2>
        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-neutral-800">{rfq.specs}</p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-lg font-bold">Attachments</h2>
        <AttachmentWarning audience="rfq" />
        {!user ? (
          <p className="text-sm text-neutral-600">
            <Link href={`/login?next=/rfqs/${rfq.id}`} className="font-semibold text-primary">Sign in</Link> with a
            business account to see attachments.
          </p>
        ) : rfqFiles.length === 0 ? (
          <p className="text-sm text-neutral-600">No files attached.</p>
        ) : (
          <FileList files={rfqFiles} />
        )}
      </section>

      {owner ? (
        <OwnerQuotes rfqId={rfq.id} unit={rfq.unit} quotes={quotes} files={visibleFiles} canDecide={open} />
      ) : null}
      {owner && rfq.status === "open" ? (
        <form action={closeRfqAction}>
          <input type="hidden" name="rfqId" value={rfq.id} />
          <Button type="submit" variant="outline" className="h-11 bg-card px-4">Close RFQ without awarding</Button>
        </form>
      ) : null}

      {!owner && !user ? (
        <Button nativeButton={false} render={<Link href={`/login?next=/rfqs/${rfq.id}`} />} className="h-11 rounded-full px-4 text-base">
          Sign in to quote or message this business
        </Button>
      ) : null}
      {!owner && user && !user.profileComplete ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm leading-6">
          Quoting and messaging are for complete business profiles.{" "}
          <Link href="/account?complete=1" className="font-semibold text-primary">Finish your company profile</Link>.
        </p>
      ) : null}
      {!owner && user?.profileComplete ? (
        <>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href={`/inbox/rfq/${rfq.id}/${rfq.ownerId}`} />}
            className="h-11 w-full bg-card px-4 sm:w-auto"
          >
            Message this business
          </Button>
          {myQuote ? (
            <section className="grid gap-2 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-lg font-bold">Your quote</h2>
              <QuoteSummary quote={myQuote} unit={rfq.unit} />
              <FileList files={visibleFiles.filter((file) => file.quoteId === myQuote.id)} />
            </section>
          ) : open ? (
            <section className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-lg font-bold">Submit a quote</h2>
              <QuoteForm rfqId={rfq.id} defaultQuantity={rfq.quantity} unit={unitLabel(rfq.unit)} />
            </section>
          ) : (
            <p className="text-sm text-neutral-600">This RFQ isn&apos;t taking quotes anymore.</p>
          )}
        </>
      ) : null}
    </article>
  );
}

function OwnerQuotes({ rfqId, unit, quotes, files, canDecide }: {
  rfqId: string;
  unit: string;
  quotes: Quote[];
  files: RfqFile[];
  canDecide: boolean;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold">Quotes ({quotes.length})</h2>
      {quotes.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm">No quotes yet.</p>
      ) : (
        <ul className="grid gap-3">
          {quotes.map((quote) => (
            <li key={quote.id} className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/shops/${quote.quoterId}`} className="font-semibold hover:text-primary">
                  {quote.companyName}
                  {quote.businessType ? (
                    <span className="font-normal text-neutral-500"> · {businessTypeLabel(quote.businessType)}</span>
                  ) : null}
                </Link>
                <QuoteStatus status={quote.status} />
              </div>
              <QuoteSummary quote={quote} unit={unit} />
              <FileList files={files.filter((file) => file.quoteId === quote.id)} />
              <div className="flex flex-wrap gap-2">
                {canDecide && quote.status === "submitted" ? (
                  <>
                    <DecisionButton rfqId={rfqId} quoteId={quote.id} decision="accepted" label="Accept quote" />
                    <DecisionButton rfqId={rfqId} quoteId={quote.id} decision="declined" label="Decline" />
                  </>
                ) : null}
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/inbox/rfq/${rfqId}/${quote.quoterId}`} />}
                  className="h-11 bg-card px-3"
                >
                  Message this business
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DecisionButton({ rfqId, quoteId, decision, label }: {
  rfqId: string;
  quoteId: string;
  decision: "accepted" | "declined";
  label: string;
}) {
  return (
    <form action={decideQuoteAction}>
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant={decision === "accepted" ? "default" : "outline"} className="h-11 px-3">
        {label}
      </Button>
    </form>
  );
}

function QuoteSummary({ quote, unit }: { quote: Quote; unit: string }) {
  const total = quoteTotalCents(quote);
  return (
    <div className="grid gap-2 text-sm">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact
          label="Price"
          value={
            quote.priceBasis === "per-unit"
              ? `${formatMoney(quote.priceCents)} / ${unitLabel(unit)} (${formatMoney(total)} total)`
              : `${formatMoney(total)} total`
          }
        />
        <Fact label="Quantity" value={formatQty(quote.quantity, unit)} />
        <Fact label="Lead time" value={`${quote.leadTimeDays} ${quote.leadTimeDays === 1 ? "day" : "days"}`} />
        <Fact label="Valid until" value={quote.validUntil} />
      </dl>
      {quote.notes ? <p className="leading-6 whitespace-pre-wrap text-neutral-800">{quote.notes}</p> : null}
      <p>
        Status: <QuoteStatus status={quote.status} />
      </p>
    </div>
  );
}

function QuoteStatus({ status }: { status: string }) {
  const style =
    status === "accepted" ? "bg-primary text-white" : status === "declined" ? "bg-neutral-200 text-neutral-700" : "bg-amber-100 text-amber-900";
  const label = status === "submitted" ? "Pending" : status === "accepted" ? "Accepted" : "Declined";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function FileList({ files }: { files: RfqFile[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="grid gap-1.5">
      {files.map((file) => (
        <li key={file.id}>
          <a
            href={`/rfqs/files/${file.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold hover:border-primary md:min-h-9"
          >
            {file.name}
            <span className="font-normal text-neutral-500">{formatBytes(file.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}
