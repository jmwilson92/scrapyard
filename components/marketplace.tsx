import Link from "next/link";
import { CategoryChips } from "@/components/category-chips";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { SearchForm } from "@/components/search-form";
import { ShopMapView } from "@/components/shop-map-view";
import { listListings } from "@/lib/repo";
import { parseSearchQuery, searchListings, toSearchParams, type SearchQuery } from "@/lib/search";
import { buildShopPins } from "@/lib/shops";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import type { Listing } from "@/lib/types";
import { lookupZip } from "@/lib/zip";
import { cn } from "cn";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function Marketplace({
  searchParams,
  forcedView,
}: {
  searchParams: SearchParams;
  forcedView?: "list" | "map";
}) {
  const [params, loaded] = await Promise.all([searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();

  const query = parseSearchQuery(params);
  if (params.zip === undefined && user?.zip) {
    query.originZip = user.zip;
    query.maxDistanceMiles = 50;
  }

  const requested = first(params.view);
  const view = forcedView ?? (requested === "map" ? "map" : "list");
  const action = forcedView === "map" ? "/map" : "/browse";
  const listings = await listListings(loaded.db);
  const found = searchListings(listings, query, (zip) => lookupZip(zip));

  const listParams = toSearchParams(query);
  const mapParams = toSearchParams(query, { view: forcedView === "map" ? null : "map" });
  const listHref = hrefFor("/browse", listParams);
  const mapHref = forcedView === "map" ? hrefFor("/map", listParams) : hrefFor("/browse", mapParams);

  return (
    <div className="grid gap-4">
      <h1 className="sr-only">{view === "map" ? "Map of shops" : "Browse listings"}</h1>
      <CategoryChips
        query={query}
        pathname={action}
        view={view === "map" && forcedView !== "map" ? "map" : undefined}
      />
      <SearchForm
        query={query}
        defaultZip={user?.zip}
        action={action}
        view={view === "map" && forcedView !== "map" ? "map" : undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResultsSummary query={query} count={found.ok ? found.results.length : 0} failed={!found.ok} />
        <div className="inline-flex rounded-full border border-neutral-300 p-0.5 text-sm font-semibold">
          <Link
            href={listHref}
            aria-current={view === "list" ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1",
              view === "list" ? "bg-neutral-900 text-white" : "text-neutral-700",
            )}
          >
            List
          </Link>
          <Link
            href={mapHref}
            aria-current={view === "map" ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1",
              view === "map" ? "bg-neutral-900 text-white" : "text-neutral-700",
            )}
          >
            Map
          </Link>
        </div>
      </div>
      {!found.ok ? (
        <p role="alert" className="rounded-2xl border border-neutral-200 p-4 text-sm">
          No centroid for ZIP {query.originZip}. Try another, or clear the ZIP to see the whole board.
        </p>
      ) : view === "map" ? (
        <MapResults listings={found.results} />
      ) : (
        <ListResults listings={found.results} fromZip={query.originZip} />
      )}
    </div>
  );
}

function ListResults({
  listings,
  fromZip,
}: {
  listings: Array<Listing & { distanceMiles: number | null }>;
  fromZip?: string;
}) {
  if (listings.length === 0) {
    return (
      <p className="rounded-2xl border border-neutral-200 p-5 text-sm leading-6 text-neutral-600">
        No listings match. Widen the distance, clear a filter, or include free lots.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          distanceMiles={listing.distanceMiles}
          fromZip={fromZip}
        />
      ))}
    </div>
  );
}

function MapResults({
  listings,
}: {
  listings: Array<Listing & { distanceMiles: number | null }>;
}) {
  const pins = buildShopPins(listings, (zip) => lookupZip(zip));
  return (
    <div className="grid gap-4">
      {pins.length === 0 ? (
        <p className="text-sm text-neutral-600">No shops match these filters.</p>
      ) : null}
      <ShopMapView pins={pins} />
      {pins.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pins.map((pin) => (
            <li key={pin.sellerId} className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm">
              <Link href={`/shops/${pin.sellerId}`} className="font-semibold hover:underline">
                {pin.shopName}
              </Link>
              <p className="text-neutral-500">
                {pin.count} active {pin.count === 1 ? "listing" : "listings"}
                {pin.city ? ` · ${pin.city}, ${pin.state}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ResultsSummary({
  query,
  count,
  failed,
}: {
  query: SearchQuery;
  count: number;
  failed: boolean;
}) {
  if (failed) return <p className="text-sm text-neutral-500">Check the ZIP code.</p>;
  const place = query.originZip ? lookupZip(query.originZip) : null;
  const where = place ? `${place.city}, ${place.state}` : query.originZip;
  return (
    <p className="text-sm text-neutral-500">
      {count === 0 ? "No listings" : `${count} ${count === 1 ? "listing" : "listings"}`}
      {where
        ? query.maxDistanceMiles
          ? ` within ${query.maxDistanceMiles} miles of ${where}`
          : ` near ${where}`
        : ""}
      . Example cards are sample inventory.
    </p>
  );
}

function hrefFor(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
