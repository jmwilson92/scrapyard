import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { closeRfqAction, decideQuoteAction } from "@/app/actions/rfqs";
import { DatabaseSetup } from "@/components/database-setup";
import { formatQty, RfqStatusBadge } from "@/components/rfq-card";
import { QuoteForm } from "@/components/rfq-forms";
import { AttachmentWarning } from "@/components/rfq-forms";
import { PayQuotePanel } from "@/components/payments";
import { Shell } from "@/components/shell";
import type { FeeBreakdown } from "@/lib/fees";
import { getUserCompanyPayments, type OrderStatus } from "@/lib/orders-repo";
import { feesFor, paymentsEnabled } from "@/lib/stripe";
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
  listRfqChanges,
  listRfqFiles,
  type Quote,
  type RfqChange,
  type RfqFile,
} from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { fieldLabel, revLabel } from "@/lib/rfq-history";
import { withdrawQuoteAction } from "@/app/actions/rfqs";
import { lookupZip } from "@/lib/zip";
import { NDA_MODE_LABELS } from "@/lib/nda";
import { listNdaSignatures, listSignaturesBySigner, mustSignNda, type NdaSignature } from "@/lib/nda-repo";

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
  const rfqFiles = visibleFiles.filter((file) => !file.quoteId && !file.removedAt);
  // NDA gate (also enforced in the file route and quote action).
  const ndaLocked = user ? await mustSignNda(db, rfq, user.id) : rfq.ndaMode !== "none";
  const signatures = owner && rfq.ndaMode !== "none" ? await listNdaSignatures(db, id) : [];
  const mySignatures = user && !owner ? await listSignaturesBySigner(db, id, user.id) : [];
  const changes = await listRfqChanges(db, id);
  const quotes = owner ? await listQuotesForRfq(db, id) : [];
  const myQuote = user && !owner ? await findQuoteByQuoter(db, id, user.id) : null;
  const open = acceptsQuotes(rfq);
  const place = lookupZip(rfq.deliveryZip);
  const accepted = owner ? quotes.find((quote) => quote.status === "accepted") : undefined;
  let payment: PaymentInfo | null = null;
  if (accepted && paymentsEnabled()) {
    const [seller, orderRow] = await Promise.all([
      getUserCompanyPayments(db, accepted.quoterId),
      db.execute({
        sql: "SELECT id, status FROM orders WHERE quote_id = ? ORDER BY created_at DESC LIMIT 1",
        args: [accepted.id],
      }),
    ]);
    const row = orderRow.rows[0];
    payment = {
      quoteId: accepted.id,
      fees: feesFor(quoteTotalCents(accepted)),
      sellerReady: Boolean(seller.stripeAccountId && seller.chargesEnabled),
      existingOrder: row ? { id: String(row.id), status: String(row.status) as OrderStatus } : null,
    };
  }

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
          {rfq.revision > 1 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
              Updated · {revLabel(rfq.revision)}
            </span>
          ) : null}
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
        {owner && rfq.status === "open" ? (
          <Button nativeButton={false} variant="outline" render={<Link href={`/rfqs/${rfq.id}/edit`} />} className="h-11 w-full bg-card px-4 sm:w-fit">
            Edit RFQ
          </Button>
        ) : null}
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

      {rfq.ndaMode !== "none" ? (
        <NdaPanel rfqId={rfq.id} mode={rfq.ndaMode} locked={ndaLocked} signedIn={Boolean(user)} owner={owner}
          resign={ndaLocked && mySignatures.length > 0} mine={mySignatures.find((s) => s.ndaRevision === rfq.ndaRevision) ?? null} />
      ) : null}

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
        ) : ndaLocked ? (
          <LockedFileList files={rfqFiles} rfqId={rfq.id} />
        ) : (
          <FileList files={rfqFiles} showRev />
        )}
      </section>

      {changes.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-bold">History</h2>
          <ol className="grid border-l-2 border-neutral-200 pl-4">
            {groupByRevision(changes).map((group) => (
              <li key={group.revision} className="relative pb-4">
                <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-amber-500" aria-hidden />
                <p className="text-sm font-semibold">
                  {revLabel(group.revision)} · {group.by}
                </p>
                <p className="text-xs text-neutral-500">{formatWhen(group.at)}</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {group.items.map((change) => {
                    const oldFile = change.field !== "fileAdded" && !ndaLocked ? findFileByName(visibleFiles, change.oldValue) : undefined;
                    return (
                      <li key={change.id} className="leading-6 break-words">
                        <span className="font-medium">{fieldLabel(change.field)}:</span>{" "}
                        {change.oldValue ? (
                          oldFile && user ? (
                            <a href={`/rfqs/files/${oldFile.id}`} className="text-neutral-500 line-through hover:text-primary">{change.oldValue}</a>
                          ) : (
                            <span className="text-neutral-500 line-through">{change.oldValue}</span>
                          )
                        ) : null}
                        {change.oldValue && change.newValue ? " → " : ""}
                        {change.newValue ? <span>{change.newValue}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            <li className="relative">
              <span className="absolute top-1.5 -left-[23px] size-3 rounded-full bg-neutral-300" aria-hidden />
              <p className="text-sm font-semibold">Rev A · Posted</p>
            </li>
          </ol>
        </section>
      ) : null}

      {owner && rfq.ndaMode !== "none" ? <SignerList rfqId={rfq.id} signatures={signatures} currentRevision={rfq.ndaRevision} /> : null}
      {owner ? (
        <OwnerQuotes rfqId={rfq.id} unit={rfq.unit} quotes={quotes} files={visibleFiles} canDecide={open} payment={payment} currentRevision={rfq.revision} />
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
              {myQuote.rfqRevision < rfq.revision ? (
                <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  You quoted on {revLabel(myQuote.rfqRevision)}. The RFQ is now {revLabel(rfq.revision)}; check the History
                  above and message the buyer if your price or lead time changes.
                </p>
              ) : null}
              <QuoteSummary quote={myQuote} unit={rfq.unit} />
              <FileList files={visibleFiles.filter((file) => file.quoteId === myQuote.id && !file.orderUpdateId)} />
              {myQuote.status === "submitted" ? (
                <form action={withdrawQuoteAction}>
                  <input type="hidden" name="quoteId" value={myQuote.id} />
                  <input type="hidden" name="back" value="rfq" />
                  <input type="hidden" name="rfqId" value={rfq.id} />
                  <Button type="submit" variant="outline" className="h-11 w-full bg-card px-4 sm:w-auto">Withdraw quote</Button>
                </form>
              ) : null}
            </section>
          ) : open && ndaLocked ? (
            <section className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
              <h2 className="text-lg font-bold">Submit a quote</h2>
              <p className="text-sm text-neutral-600">Sign the NDA to see the drawings and send a quote.</p>
              <Button nativeButton={false} render={<Link href={`/rfqs/${rfq.id}/nda`} />} className="h-11 w-full px-4 sm:w-fit">
                Review and sign NDA
              </Button>
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

type PaymentInfo = {
  quoteId: string;
  fees: FeeBreakdown;
  sellerReady: boolean;
  existingOrder: { id: string; status: OrderStatus } | null;
};

function OwnerQuotes({ rfqId, unit, quotes, files, canDecide, payment, currentRevision }: {
  rfqId: string;
  currentRevision: number;
  unit: string;
  quotes: Quote[];
  files: RfqFile[];
  canDecide: boolean;
  payment: PaymentInfo | null;
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
              {quote.rfqRevision < currentRevision ? (
                <p className="text-xs font-semibold text-amber-800">
                  Quoted on {revLabel(quote.rfqRevision)}; RFQ changed since
                </p>
              ) : null}
              <QuoteSummary quote={quote} unit={unit} />
              <FileList files={files.filter((file) => file.quoteId === quote.id && !file.orderUpdateId)} />
              {payment && payment.quoteId === quote.id ? (
                <PayQuotePanel
                  rfqId={rfqId}
                  quoteId={quote.id}
                  fees={payment.fees}
                  sellerReady={payment.sellerReady}
                  existingOrder={payment.existingOrder}
                />
              ) : null}
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
  const label =
    status === "submitted" ? "Pending" : status === "accepted" ? "Accepted" : status === "withdrawn" ? "Withdrawn" : "Declined";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>;
}

function FileList({ files, showRev = false }: { files: RfqFile[]; showRev?: boolean }) {
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
            {showRev ? <span className="rounded-full bg-neutral-100 px-1.5 text-xs">{revLabel(file.revision)}</span> : null}
            <span className="font-normal text-neutral-500">{formatBytes(file.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function NdaPanel({ rfqId, mode, locked, signedIn, owner, resign, mine }: {
  rfqId: string;
  mode: "template" | "custom" | "none";
  locked: boolean;
  signedIn: boolean;
  owner: boolean;
  resign: boolean;
  mine: NdaSignature | null;
}) {
  return (
    <section className={`grid gap-2 rounded-2xl border p-4 text-sm leading-6 ${locked ? "border-amber-300 bg-amber-50" : "border-neutral-200"}`}>
      <h2 className="text-lg font-bold">NDA required · {NDA_MODE_LABELS[mode]}</h2>
      {owner ? (
        <p>Other businesses must sign this NDA before they can open your files or quote. <Link href={`/rfqs/${rfqId}/nda`} className="font-semibold text-primary">View NDA</Link></p>
      ) : !signedIn ? (
        <p>Sign in with a business account, then sign the buyer&apos;s NDA to unlock the files.</p>
      ) : locked ? (
        <>
          <p>{resign ? "The buyer changed the NDA since you signed. Re-sign the new version to keep access to the files." : "Sign the buyer's NDA to unlock the drawings and quote."}</p>
          <Button nativeButton={false} render={<Link href={`/rfqs/${rfqId}/nda`} />} className="h-11 w-full px-4 sm:w-fit">
            {resign ? "Review and re-sign NDA" : "Review and sign NDA"}
          </Button>
        </>
      ) : mine ? (
        <p>
          Signed by {mine.signerName} on {formatWhen(mine.signedAt)}.{" "}
          <Link href={`/rfqs/${rfqId}/nda/record/${mine.id}`} className="font-semibold text-primary">View signed copy</Link>
        </p>
      ) : null}
    </section>
  );
}

function SignerList({ rfqId, signatures, currentRevision }: { rfqId: string; signatures: NdaSignature[]; currentRevision: number }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-bold">NDA signatures</h2>
      {signatures.length === 0 ? (
        <p className="text-sm text-neutral-600">No one has signed yet.</p>
      ) : (
        <ul className="grid gap-2">
          {signatures.map((sig) => (
            <li key={sig.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm">
              <span>
                <span className="font-semibold">{sig.businessName}</span> · {sig.signerName}, {sig.signerTitle}
                <span className="block text-neutral-500">
                  {formatWhen(sig.signedAt)}
                  {sig.ndaRevision !== currentRevision ? " · signed an earlier NDA, needs to re-sign" : ""}
                </span>
              </span>
              <Link href={`/rfqs/${rfqId}/nda/record/${sig.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary md:min-h-9">
                Signed record
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LockedFileList({ files, rfqId }: { files: RfqFile[]; rfqId: string }) {
  if (files.length === 0) return <p className="text-sm text-neutral-600">No files attached.</p>;
  return (
    <ul className="grid gap-1.5">
      {files.map((file) => (
        <li key={file.id}>
          <Link href={`/rfqs/${rfqId}/nda`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 text-sm font-semibold text-neutral-500 md:min-h-9">
            <span aria-hidden>🔒</span>
            {file.name}
            <span className="font-normal">Locked until you sign the NDA</span>
          </Link>
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

function groupByRevision(changes: RfqChange[]) {
  const groups: { revision: number; by: string; at: number; items: RfqChange[] }[] = [];
  for (const change of changes) {
    const last = groups[groups.length - 1];
    if (last && last.revision === change.revision) last.items.push(change);
    else groups.push({ revision: change.revision, by: change.changedByName, at: change.createdAt, items: [change] });
  }
  return groups;
}

function findFileByName(files: RfqFile[], name: string | null): RfqFile | undefined {
  if (!name) return undefined;
  return files.find((file) => !file.quoteId && file.removedAt && file.name === name);
}

function formatWhen(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(new Date(ms));
}
