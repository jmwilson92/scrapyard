import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { Shell } from "@/components/shell";
import { VerifiedSellerBadge } from "@/components/verified-seller";
import { haversineMiles } from "@/lib/geo";
import { isSafeId } from "@/lib/paths";
import { businessTypeLabel } from "@/lib/business";
import { findPublicUserById, getCompanyById, listListingsBySeller } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { lookupZip } from "@/lib/zip";

type Params = Promise<{ id: string }>;

export const metadata = { title: "Company profile" };

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
  const company = shop.companyId ? await getCompanyById(loaded.db, shop.companyId) : null;
  const wanted = listings.filter(
    (listing) => listing.status === "active" && listing.listingType === "wanted",
  );

  const active = listings.filter(
    (listing) => listing.status === "active" && listing.listingType !== "wanted",
  );
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
          {company?.businessType ? `${businessTypeLabel(company.businessType)} · ` : ""}
          {company?.city && company.state
            ? `${company.city}, ${company.state} ${company.zip}`
            : place
              ? `${place.city}, ${place.state} ${shop.zip}`
              : shop.zip}
          {" · "}
          {active.length} active {active.length === 1 ? "listing" : "listings"}
          {wanted.length > 0 ? ` · ${wanted.length} wanted` : ""}
        </p>
        {company ? (
          <dl className="mt-3 grid max-w-2xl grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {company.serviceRadiusMiles ? (
              <div>
                <dt className="text-neutral-500">Service area</dt>
                <dd className="font-medium">{company.serviceRadiusMiles} miles</dd>
              </div>
            ) : null}
            {company.contactName ? (
              <div>
                <dt className="text-neutral-500">Contact</dt>
                <dd className="font-medium">{company.contactName}</dd>
              </div>
            ) : null}
            {viewer?.profileComplete && company.contactPhone ? (
              <div>
                <dt className="text-neutral-500">Phone</dt>
                <dd className="font-medium">
                  <a href={`tel:${company.contactPhone}`} className="text-primary">
                    {company.contactPhone}
                  </a>
                </dd>
              </div>
            ) : null}
            {company.website ? (
              <div>
                <dt className="text-neutral-500">Website</dt>
                <dd className="font-medium">
                  <a href={company.website} rel="noopener noreferrer nofollow" target="_blank" className="text-primary">
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            ) : null}
            {company.ein ? (
              <div>
                <dt className="text-neutral-500">EIN</dt>
                <dd className="font-medium">On file</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {shop.isExample ? (
          <p className="mt-3 max-w-2xl rounded-2xl bg-neutral-100 px-3 py-2 text-sm leading-6">
            This is a seeded example company. Its listings are sample inventory, not live stock.
          </p>
        ) : null}
      </div>
      {active.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 p-5 text-sm text-neutral-600">
          No active listings from this company.
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
      {wanted.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xl font-bold">Wanted by this company</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {wanted.map((listing) => (
              <ListingCard key={listing.id} listing={listing} distanceMiles={null} fromZip={viewer?.zip} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
