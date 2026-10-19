import Link from "next/link";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { BoardFallback, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { listListings } from "@/lib/repo";
import { parseSearchQuery, searchListings } from "@/lib/search";
import { loadRequestDb } from "@/lib/server-db";
import { lookupZip } from "@/lib/zip";

export default function HomePage() {
  return (
    <Shell>
      <section className="grid items-center gap-8 py-4 lg:grid-cols-[1.3fr_0.7fr] lg:py-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-copper uppercase">
            Remnant metal for machine shops
          </p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] tracking-wide sm:text-7xl">
            Don&apos;t scrap the drop. Sell it to the shop down the road.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-foreground/80">
            DropYard is a free board where shops list leftover bar, plate, tube,
            and sheet. Nearby shops buy it for pickup instead of waiting on a
            mill minimum or tossing good metal in the scrap bin.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link href="/browse?zip=92101&miles=50" />}
              className="h-11 px-4 text-base"
            >
              Browse San Diego drops
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/listings/new" />}
              variant="outline"
              className="h-11 bg-card px-4 text-base"
            >
              List a remnant
            </Button>
          </div>
        </div>
        <aside className="rounded-xl bg-primary p-5 text-primary-foreground shadow-sm">
          <p className="text-xs tracking-[0.18em] text-copper uppercase">Shop tag</p>
          <p className="mt-3 font-display text-4xl leading-none tracking-wide">
            6061-T6
          </p>
          <p className="mt-2 text-lg">Round · 1.5&quot; dia × 24&quot; L</p>
          <p className="mt-6 text-sm text-primary-foreground/75">
            6 pcs · pickup 92111
          </p>
          <p className="mt-2 font-display text-5xl tracking-wide text-copper">$36</p>
          <p className="text-sm text-primary-foreground/75">lot price, you haul</p>
        </aside>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: "01",
            title: "List the drop",
            body: "Alloy, size, a photo, your pickup ZIP. Price it cheap, or give it away.",
          },
          {
            step: "02",
            title: "Shops nearby search",
            body: "Filter by material, grade, form, price, and miles from a ZIP. No freight broker.",
          },
          {
            step: "03",
            title: "Message and pick up",
            body: "The note stays in the app. You meet at the shop and settle there.",
          },
        ].map((item) => (
          <article key={item.step} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <p className="font-display text-4xl text-copper">{item.step}</p>
            <h2 className="mt-2 font-display text-2xl tracking-wide">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-4xl tracking-wide">On the board</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Example listings around San Diego, so you can try search before
              you post your own.
            </p>
          </div>
          <Link href="/browse?zip=92101&miles=50" className="text-sm font-semibold text-copper">
            See all
          </Link>
        </div>
        <Suspense fallback={<BoardFallback />}>
          <Featured />
        </Suspense>
      </section>

      <section className="mt-12 grid gap-6 rounded-xl bg-card p-5 ring-1 ring-foreground/10 sm:grid-cols-2 sm:p-8">
        <div>
          <h2 className="font-display text-4xl tracking-wide">Why a shop bothers</h2>
          <p className="mt-3 leading-7 text-foreground/80">
            A 24-inch drop of 6061 still machines. Scrap price is a fraction of
            what the next job would pay to skip a lead time. DropYard doesn&apos;t
            take a cut and doesn&apos;t run payments.
          </p>
        </div>
        <ul className="grid gap-3 text-sm leading-6">
          <li className="rounded-lg bg-secondary px-3 py-3">
            Job shops, prototype shops, and maintenance cribs with a cutoff bin.
          </li>
          <li className="rounded-lg bg-secondary px-3 py-3">
            Buyers who need one size today, not a 12-foot mill bar next week.
          </li>
          <li className="rounded-lg bg-secondary px-3 py-3">
            Cards marked Example are sample inventory, not live metal.
          </li>
        </ul>
      </section>
    </Shell>
  );
}

async function Featured() {
  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const listings = await listListings(loaded.db);
  const query = parseSearchQuery({ zip: "92101", miles: "50" });
  const found = searchListings(listings, query, (zip) => lookupZip(zip));
  const results = found.ok ? found.results.slice(0, 4) : [];
  if (results.length === 0) {
    return (
      <p className="rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
        The board is empty. Be the first shop to list a drop.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
