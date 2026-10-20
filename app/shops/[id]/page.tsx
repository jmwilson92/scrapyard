import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { Shell } from "@/components/shell";
import { VerifiedSellerBadge } from "@/components/verified-seller";
import { haversineMiles } from "@/lib/geo";
import { isSafeId } from "@/lib/paths";
import { findPublicUserById, listListingsBySeller } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { lookupZip } from "@/lib/zip";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Shop" };

export default function ShopPage({ params }: { params: Params }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />}>
        <ShopProfile params={params} />
      </Suspense>
    </Shell>
  );
}

async function ShopProfile({ params }: { params: Params }) {
  const [{ id }, loaded] = await Promise.all([params, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  if (!isSafeId(id)) notFound();

  const [shop, listings, viewer] = await Promise.all([
    findPublicUserById(loaded.db, id),
    listListingsBySeller(loaded.db, id),
    getCurrentUser(),
  ]);
  if (!shop) notFound();

  const active = listings.filter((listing) => listing.status === "active");
  const place = lookupZip(shop.zip);
  const origin = viewer ? lookupZip(viewer.zip) : null;

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/map" className="font-semibold text-primary">
            Map
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{shop.shopName}</h1>
          {shop.verifiedSeller ? <VerifiedSellerBadge /> : null}
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {place ? `${place.city}, ${place.state} ${shop.zip}` : shop.zip}
          {" · "}
          {active.length} active {active.length === 1 ? "listing" : "listings"}
        </p>
        {shop.isExample ? (
          <p className="mt-3 max-w-2xl rounded-2xl bg-neutral-100 px-3 py-2 text-sm leading-6">
            This is a seeded example shop. The listings are sample inventory, not live metal.
          </p>
        ) : null}
      </div>
      {active.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 p-5 text-sm text-neutral-600">
          No active listings from this shop.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {active.map((listing) => {
            const pickup = lookupZip(listing.zip);
            const distance = origin && pickup ? haversineMiles(origin, pickup) : null;
            return (
              <ListingCard
                key={listing.id}
                listing={listing}
                distanceMiles={distance}
                fromZip={viewer?.zip}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
