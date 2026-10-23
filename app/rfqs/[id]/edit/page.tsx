import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { RfqForm } from "@/components/rfq-forms";
import { Shell } from "@/components/shell";
import { isSafeId } from "@/lib/paths";
import { isoDay } from "@/lib/rfq";
import { revLabel } from "@/lib/rfq-history";
import { getRfqById, getRfqFile, listRfqFiles } from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Edit RFQ" };

export default function EditRfqPage({ params }: { params: Params }) {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
          <EditBody params={params} />
        </Suspense>
      </div>
    </Shell>
  );
}

async function EditBody({ params }: { params: Params }) {
  const [{ id }, loaded] = await Promise.all([params, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/rfqs/${id}/edit`);
  const rfq = await getRfqById(loaded.db, id);
  if (!rfq || rfq.ownerId !== user.id) notFound();
  if (rfq.status !== "open") redirect(`/rfqs/${id}`);
  const files = (await listRfqFiles(loaded.db, id)).filter((f) => !f.quoteId && !f.removedAt);
  const values: Record<string, string> = {
    title: rfq.title,
    category: rfq.category,
    subtype: rfq.subtype,
    quantity: String(rfq.quantity),
    unit: rfq.unit,
    specs: rfq.specs,
    neededBy: rfq.neededBy ?? "",
    expiresOn: rfq.expiresOn,
    deliveryZip: rfq.deliveryZip,
    deliveryLocation: rfq.deliveryLocation,
    budget: rfq.budgetCents != null ? (rfq.budgetCents / 100).toFixed(2) : "",
    ndaMode: rfq.ndaMode,
  };
  const ndaFile = rfq.ndaFileId ? await getRfqFile(loaded.db, rfq.ndaFileId) : null;
  return (
    <>
      <p className="text-sm">
        <Link href={`/rfqs/${id}`} className="font-semibold text-primary">Back to RFQ</Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit RFQ</h1>
      <p className="mt-2 text-base leading-7 text-neutral-500">
        Saving creates {revLabel(rfq.revision + 1)}. Every change is logged in the RFQ&apos;s History, earlier
        drawings stay downloadable, and businesses that already quoted get an inbox message to re-check.
      </p>
      <div className="mt-6 rounded-2xl border border-neutral-200 p-4 sm:p-6">
        <RfqForm
          defaultZip={user.zip}
          today={isoDay()}
          edit={{ rfqId: id, values, files: files.map((f) => ({ id: f.id, name: f.name, revLabel: revLabel(f.revision) })), ndaFileName: ndaFile?.name ?? null }}
        />
      </div>
    </>
  );
}
