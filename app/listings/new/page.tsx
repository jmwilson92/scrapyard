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
        <h1 className="font-display text-5xl tracking-wide">List a drop</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Price the whole lot. Buyers pick up at your ZIP. DropYard doesn&apos;t
          take payment.
        </p>
        <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
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
