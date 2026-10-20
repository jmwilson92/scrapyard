import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "List a drop" };

export default function NewListingPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">List a drop</h1>
        <p className="mt-2 text-base leading-7 text-neutral-500">
          Price the whole lot. Choose buyer pickup or say you can deliver. DropYard doesn&apos;t take payment.
        </p>
        <div className="mt-6 rounded-2xl border border-neutral-200 p-4 sm:p-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
            <NewListingForm />
          </Suspense>
        </div>
      </div>
    </Shell>
  );
}

async function NewListingForm() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/listings/new");
  return <ListingForm defaultZip={user.zip} />;
}
