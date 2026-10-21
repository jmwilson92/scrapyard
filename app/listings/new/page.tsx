import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListingForm } from "@/components/listing-form";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Post material" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NewListingPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Post material to the network</h1>
        <p className="mt-2 text-base leading-7 text-neutral-500">
          Sell surplus, scrap, or remnant stock to other businesses, or post a wanted request so suppliers come to you. Skrappily doesn&apos;t take payment.
        </p>
        <div className="mt-6 rounded-2xl border border-neutral-200 p-4 sm:p-6">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
            <NewListingForm searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </Shell>
  );
}

async function NewListingForm({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/listings/new");
  if (!user.profileComplete) redirect("/account?complete=1");
  const type = params.type === "wanted" ? "wanted" : "offer";
  return <ListingForm defaultZip={user.zip} defaultType={type} />;
}
