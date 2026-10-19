import Link from "next/link";
import { Suspense } from "react";
import { deleteListingAction, setListingStatusAction } from "@/app/actions/listings";
import { ShopForm } from "@/components/auth-forms";
import { DatabaseSetup } from "@/components/database-setup";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { listListingsBySeller } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Your shop" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AccountPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <AccountBody searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}

async function AccountBody({ searchParams }: { searchParams: SearchParams }) {
  const [params, loaded] = await Promise.all([searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const listings = await listListingsBySeller(loaded.db, user.id);
  const deleted = first(params.deleted) === "1";

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-display text-5xl tracking-wide">{user.shopName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
        {user.isExample ? (
          <p className="mt-3 max-w-2xl rounded-lg bg-secondary px-3 py-2 text-sm leading-6">
            You&apos;re signed in as a seeded example shop. Listings you change
            or delete are sample data, not a real customer&apos;s metal.
          </p>
        ) : null}
        {deleted ? (
          <p role="status" className="mt-3 text-sm text-primary">
            Listing deleted.
          </p>
        ) : null}
      </div>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <h2 className="font-display text-3xl tracking-wide">Shop details</h2>
        <div className="mt-4">
          <ShopForm shopName={user.shopName} zip={user.zip} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl tracking-wide">Your listings</h2>
          <Button nativeButton={false} render={<Link href="/listings/new" />} className="h-11 px-4">
            List a drop
          </Button>
        </div>
        {listings.length === 0 ? (
          <p className="rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
            Nothing listed yet. A photo, a grade, and a ZIP is enough to start.
          </p>
        ) : (
          <ul className="grid gap-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <Link href={`/listings/${listing.id}`} className="font-semibold hover:text-copper">
                    {listing.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {listing.alloy} · {listing.zip} · {formatMoney(listing.priceCents)} ·{" "}
                    {listing.status === "sold" ? "Sold" : "Available"}
                    {listing.isExample ? " · Example" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={setListingStatusAction}>
                    <input type="hidden" name="id" value={listing.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={listing.status === "active" ? "sold" : "active"}
                    />
                    <Button type="submit" variant="outline" className="h-11 bg-card px-3">
                      {listing.status === "active" ? "Mark sold" : "Mark available"}
                    </Button>
                  </form>
                  <form action={deleteListingAction}>
                    <input type="hidden" name="id" value={listing.id} />
                    <Button type="submit" variant="destructive" className="h-11 px-3">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
