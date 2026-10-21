import Link from "next/link";
import { Suspense } from "react";
import { CategoryChips } from "@/components/category-chips";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { BoardFallback, Shell } from "@/components/shell";
import { listListings } from "@/lib/repo";
import { parseSearchQuery, searchListings } from "@/lib/search";
import { loadRequestDb } from "@/lib/server-db";
import { lookupZip } from "@/lib/zip";

export default function HomePage() {
  const query = parseSearchQuery({ zip: "92101", miles: "50" });
  return (
    <Shell>
      <CategoryChips query={query} />
      <div className="mt-4 mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business-to-business material network</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-500">
            Shops, fabricators, contractors, manufacturers, and suppliers buy, sell, and source metal, lumber, construction materials, plastics, glass, and wire from each other. Post surplus, or post a wanted request when your supplier runs short. Business accounts only. Example cards around San Diego are sample inventory, not live stock.
          </p>
        </div>
        <Link href="/browse?zip=92101&miles=50" className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary md:min-h-0">
          See all
        </Link>
      </div>
      <Suspense fallback={<BoardFallback />}>
        <Featured />
      </Suspense>
    </Shell>
  );
}

async function Featured() {
  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const listings = await listListings(loaded.db);
  const query = parseSearchQuery({ zip: "92101", miles: "50" });
  const found = searchListings(listings, query, (zip) => lookupZip(zip));
  const results = found.ok ? found.results.slice(0, 8) : [];
  if (results.length === 0) {
    return (
      <p className="rounded-2xl border border-neutral-200 p-5 text-sm">
        The board is empty. Be the first business to post material.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {results.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          distanceMiles={listing.distanceMiles}
          fromZip="92101"
        />
      ))}
    </div>
  );
}
