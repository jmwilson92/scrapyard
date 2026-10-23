import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { PrintButton } from "@/components/print-button";
import { Shell } from "@/components/shell";
import { NDA_DISCLAIMER, NDA_MODE_LABELS } from "@/lib/nda";
import { getNdaSignature } from "@/lib/nda-repo";
import { isSafeId } from "@/lib/paths";
import { getRfqById, getRfqFile } from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string; sigId: string }>;

export const metadata = { title: "Signed NDA" };

export default function SignedNdaPage({ params }: { params: Params }) {
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />}>
          <RecordBody params={params} />
        </Suspense>
      </div>
    </Shell>
  );
}

async function RecordBody({ params }: { params: Params }) {
  const [{ id, sigId }, loaded] = await Promise.all([params, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id) || !isSafeId(sigId)) notFound();
  const db = loaded.db;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/rfqs/${id}/nda/record/${sigId}`);
  const [rfq, sig] = await Promise.all([getRfqById(db, id), getNdaSignature(db, sigId)]);
  // Only the RFQ owner and the signer can see a signed record.
  if (!rfq || !sig || sig.rfqId !== id || (user.id !== rfq.ownerId && user.id !== sig.signerId)) notFound();
  const file = sig.ndaFileId ? await getRfqFile(db, sig.ndaFileId) : null;
  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "America/Los_Angeles",
  }).format(new Date(sig.signedAt));

  return (
    <div className="grid gap-5 print:gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/rfqs/${id}`} className="text-sm font-semibold text-primary">Back to RFQ</Link>
        <PrintButton />
      </div>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Signed NDA record</h1>
        <p className="text-sm text-neutral-600">
          {NDA_MODE_LABELS[sig.ndaMode]} · RFQ &ldquo;{rfq.title}&rdquo; ({rfq.id}) · NDA version {sig.ndaRevision}
        </p>
      </header>
      {sig.ndaMode === "template" ? (
        <pre className="rounded-2xl border border-neutral-200 bg-white p-4 font-sans text-sm leading-6 whitespace-pre-wrap print:border-0 print:p-0">
          {sig.ndaText}
        </pre>
      ) : (
        <p className="text-sm">
          Agreement: buyer-provided NDA{" "}
          {file ? (
            <a href={`/rfqs/files/${file.id}`} className="font-semibold text-primary">{file.name}</a>
          ) : (
            "(file no longer available)"
          )}
          , incorporated by reference.
        </p>
      )}
      <section className="grid gap-1 rounded-2xl border-2 border-neutral-800 p-4 text-sm leading-6">
        <h2 className="font-bold">Electronic signature</h2>
        <p>Signed on behalf of: <strong>{sig.businessName}</strong></p>
        <p>Signed by: <strong>{sig.signerName}</strong>, {sig.signerTitle}</p>
        <p>Date and time: {when}</p>
        <p>Agreed to with: &ldquo;I agree to this NDA on behalf of {sig.businessName}&rdquo; checkbox and typed name</p>
        <p>Counterparty (buyer): {rfq.companyName}</p>
        <p className="break-all text-neutral-600">IP address: {sig.ip || "not recorded"}</p>
        <p className="break-all text-neutral-600">Device: {sig.userAgent || "not recorded"}</p>
        <p className="break-all text-neutral-600">Document fingerprint (SHA-256): {sig.ndaHash}</p>
        <p className="text-neutral-600">Record ID: {sig.id}</p>
      </section>
      <p className="text-xs text-neutral-500">{NDA_DISCLAIMER}</p>
    </div>
  );
}
