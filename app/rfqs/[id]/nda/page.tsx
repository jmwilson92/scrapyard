import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { NdaSignForm } from "@/components/rfq-forms";
import { Shell } from "@/components/shell";
import { NDA_DISCLAIMER, NDA_MODE_LABELS } from "@/lib/nda";
import { businessNameFor, listSignaturesBySigner, mustSignNda, renderTemplateNow } from "@/lib/nda-repo";
import { isSafeId } from "@/lib/paths";
import { getRfqById, getRfqFile } from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;

export const metadata = { title: "RFQ NDA" };

export default function RfqNdaPage({ params }: { params: Params }) {
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />}>
          <NdaBody params={params} />
        </Suspense>
      </div>
    </Shell>
  );
}

async function NdaBody({ params }: { params: Params }) {
  const [{ id }, loaded] = await Promise.all([params, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();
  const db = loaded.db;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/rfqs/${id}/nda`);
  const rfq = await getRfqById(db, id);
  if (!rfq) notFound();
  if (rfq.ndaMode === "none") redirect(`/rfqs/${id}`);
  const owner = user.id === rfq.ownerId;
  const business = await businessNameFor(db, user.id);
  const quoterName = owner ? "[Quoting business]" : business.name;
  const ndaFile = rfq.ndaMode === "custom" && rfq.ndaFileId ? await getRfqFile(db, rfq.ndaFileId) : null;
  const locked = await mustSignNda(db, rfq, user.id);
  const mine = owner ? [] : await listSignaturesBySigner(db, id, user.id);
  const current = mine.find((s) => s.ndaRevision === rfq.ndaRevision);

  return (
    <div className="grid gap-5">
      <p className="text-sm">
        <Link href={`/rfqs/${id}`} className="font-semibold text-primary">Back to RFQ</Link>
      </p>
      <header className="grid gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">NDA · {rfq.title}</h1>
        <p className="text-sm text-neutral-600">
          {NDA_MODE_LABELS[rfq.ndaMode]} from {rfq.companyName}. You must sign it before you can open this RFQ&apos;s files or quote.
        </p>
      </header>

      {rfq.ndaMode === "template" ? (
        <>
          <pre className="max-h-[60vh] overflow-auto rounded-2xl border border-neutral-200 bg-white p-4 font-sans text-sm leading-6 whitespace-pre-wrap">
            {renderTemplateNow(rfq, quoterName)}
          </pre>
          <p className="text-xs text-neutral-500">{NDA_DISCLAIMER}</p>
        </>
      ) : ndaFile ? (
        <section className="grid gap-2">
          <a href={`/rfqs/files/${ndaFile.id}`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold hover:border-primary">
            Open the buyer&apos;s NDA ({ndaFile.name})
          </a>
          <iframe src={`/rfqs/files/${ndaFile.id}`} title="Buyer NDA" className="hidden h-[70vh] w-full rounded-2xl border border-neutral-200 sm:block" />
          <p className="text-xs text-neutral-500">Read the whole document before signing. Skrappily isn&apos;t a party to the buyer&apos;s NDA.</p>
        </section>
      ) : (
        <p className="text-sm text-neutral-600">The buyer&apos;s NDA file is missing. Message the buyer.</p>
      )}

      {owner ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm">This is what quoters see. Their business name is filled in when they sign.</p>
      ) : !user.profileComplete ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm">
          <Link href="/account?complete=1" className="font-semibold text-primary">Finish your company profile</Link> before signing.
        </p>
      ) : locked ? (
        <section className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
          <h2 className="text-lg font-bold">{mine.length > 0 ? "Re-sign the updated NDA" : "Sign"}</h2>
          <NdaSignForm rfqId={rfq.id} ndaRevision={rfq.ndaRevision} businessName={business.name} />
        </section>
      ) : current ? (
        <p className="rounded-2xl border border-neutral-200 p-4 text-sm">
          You signed this NDA.{" "}
          <Link href={`/rfqs/${id}/nda/record/${current.id}`} className="font-semibold text-primary">View your signed copy</Link>
        </p>
      ) : null}
    </div>
  );
}
