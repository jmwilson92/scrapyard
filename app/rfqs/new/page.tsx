import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RfqForm } from "@/components/rfq-forms";
import { Shell } from "@/components/shell";
import { isoDay } from "@/lib/rfq";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Post an RFQ" };

export default function NewRfqPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Post a request for quote</h1>
        <p className="mt-2 text-base leading-7 text-neutral-500">
          Describe the material you need. Suppliers on the network send quotes you can compare, accept, or decline.
        </p>
        <div className="mt-6 rounded-2xl border border-neutral-200 p-4 sm:p-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
            <Gate />
          </Suspense>
        </div>
      </div>
    </Shell>
  );
}

async function Gate() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rfqs/new");
  if (!user.profileComplete) redirect("/account?complete=1");
  return <RfqForm defaultZip={user.zip} today={isoDay()} />;
}
