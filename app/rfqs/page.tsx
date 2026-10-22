import Link from "next/link";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { ListingCard } from "@/components/listing-card";
import { RfqCard } from "@/components/rfq-card";
import { BoardFallback, Shell } from "@/components/shell";
import { CATEGORIES, isCategory } from "@/lib/constants";
import { listListings } from "@/lib/repo";
import { displayRfqStatus } from "@/lib/rfq";
import { listRfqs } from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";

export const metadata = { title: "Requests for quote" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RfqsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requests for quote</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-500">
            Businesses post the material they need, with specs and drawings. Suppliers send quotes with price,
            quantity, and lead time.
          </p>
        </div>
        <Link
          href="/rfqs/new"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Post an RFQ
        </Link>
      </div>
      <Suspense fallback={<BoardFallback />}>
        <RfqBoard searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}

async function RfqBoard({ searchParams }: { searchParams: SearchParams }) {
  const [params, loaded] = await Promise.all([searchParams, loadRequestDb()]);
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const status = first(params.status) === "all" ? "all" : "open";
  const categoryRaw = first(params.category);
  const category = isCategory(categoryRaw) ? categoryRaw : "";
  const [rfqs, listings] = await Promise.all([listRfqs(loaded.db), listListings(loaded.db)]);
  const shown = rfqs.filter(
    (rfq) =>
      (status === "all" || displayRfqStatus(rfq) === "open") && (!category || rfq.category === category),
  );
  const wanted = listings
    .filter((listing) => listing.listingType === "wanted" && listing.status === "active")
    .slice(0, 4);

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={
        active
          ? "inline-flex min-h-11 items-center rounded-full bg-neutral-900 px-3 text-sm font-semibold text-white md:min-h-9"
          : "inline-flex min-h-11 items-center rounded-full border border-neutral-300 px-3 text-sm font-semibold md:min-h-9"
      }
    >
      {label}
    </Link>
  );
  const qs = (next: { status?: string; category?: string }) => {
    const p = new URLSearchParams();
    const s = next.status ?? status;
    const c = next.category ?? category;
    if (s === "all") p.set("status", "all");
    if (c) p.set("category", c);
    const str = p.toString();
    return str ? `/rfqs?${str}` : "/rfqs";
  };

  return (
    <div className="grid gap-6">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {chip(qs({ status: "open" }), "Open", status === "open")}
        {chip(qs({ status: "all" }), "All", status === "all")}
        <span className="mx-1 border-l border-neutral-200" />
        {chip(qs({ category: "" }), "Any material", !category)}
        {CATEGORIES.map((item) => chip(qs({ category: item.value }), item.label, category === item.value))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 p-5 text-sm">
          No RFQs match. <Link href="/rfqs/new" className="font-semibold text-primary">Post the first one</Link>.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} />
          ))}
        </div>
      )}
      {wanted.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Quick wanted posts</h2>
              <p className="text-sm text-neutral-500">Simple requests without a formal quote process.</p>
            </div>
            <Link href="/browse?kind=wanted" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
              See all wanted
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {wanted.map((listing) => (
              <ListingCard key={listing.id} listing={listing} distanceMiles={null} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
