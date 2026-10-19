import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { SearchForm } from "@/components/search-form";
import { BoardFallback, Shell } from "@/components/shell";
import { listListings } from "@/lib/repo";
import {
  parseSearchQuery,
  searchListings,
  type SearchQuery,
  type SearchResult,
} from "@/lib/search";
import type { Listing } from "@/lib/types";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { lookupZip } from "@/lib/zip";

export const metadata = { title: "Browse remnants" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <h1 className="font-display text-5xl tracking-wide">Remnants</h1>
      <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
        Filter by metal, shape, price, and distance from a ZIP code. Distance
        uses bundled US ZIP centroids, not a paid map service.
      </p>
      <div className="mt-6">
        <Suspense fallback={<BoardFallback />}>
          <BrowseBoard searchParams={searchParams} />
        </Suspense>
      </div>
    </Shell>
  );
}

async function BrowseBoard({ searchParams }: { searchParams: SearchParams }) {
  const [params, loaded] = await Promise.all([searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();

  const query = parseSearchQuery(params);
  if (params.zip === undefined && user?.zip) {
    query.originZip = user.zip;
    query.maxDistanceMiles = 50;
  }

  const listings = await listListings(loaded.db);
  const found = searchListings(listings, query, (zip) => lookupZip(zip));

  return (
    <div className="grid gap-5">
      <SearchForm query={found.ok ? query : query} defaultZip={user?.zip} />
      <Results query={query} found={found} />
    </div>
  );
}

function Results({
  query,
  found,
}: {
  query: SearchQuery;
  found: SearchResult<Listing>;
}) {
  if (!found.ok) {
    return (
      <p role="alert" className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        No centroid for ZIP {query.originZip}. Try another, or clear the ZIP to
        see the whole board.
      </p>
    );
  }

  const place = query.originZip ? lookupZip(query.originZip) : null;
  const where = place
    ? `${place.city}, ${place.state} ${query.originZip}`
    : query.originZip;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {found.results.length === 0
          ? "No remnants match."
          : `${found.results.length} ${found.results.length === 1 ? "remnant" : "remnants"}`}
        {where
          ? query.maxDistanceMiles
            ? ` within ${query.maxDistanceMiles} miles of ${where}`
            : ` sorted from ${where}`
          : ""}
        . Cards marked Example are sample inventory, not live metal.
      </p>
      {found.results.length === 0 ? (
        <p className="rounded-xl bg-card p-5 text-sm leading-6 ring-1 ring-foreground/10">
          Widen the radius, clear the alloy, or raise the max price. Free drops
          are included unless you hide them.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {found.results.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              distanceMiles={listing.distanceMiles}
              fromZip={query.originZip}
            />
          ))}
        </div>
      )}
    </div>
  );
}
