"use client";

import { MapPin, Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

const KEPT = ["material", "metal", "form", "thickness", "length", "max", "free", "delivery", "certs", "alloy", "miles", "view"];

export function TopSearch({ defaultZip = "" }: { defaultZip?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const action = pathname === "/map" ? "/map" : "/browse";
  const zip = params.get("zip") ?? defaultZip;

  return (
    <form action={action} method="get" className="flex h-12 items-center rounded-full border-2 border-neutral-900 bg-white pr-1" role="search">
      <label className="sr-only" htmlFor="q">
        Search listings
      </label>
      <Search className="ml-3 size-5 shrink-0 text-neutral-500" aria-hidden />
      <input
        id="q"
        name="q"
        defaultValue={params.get("q") ?? ""}
        placeholder="Search Skrappily"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-neutral-400"
      />
      <span className="h-6 w-px shrink-0 bg-neutral-300" aria-hidden />
      <label className="sr-only" htmlFor="search-zip">
        ZIP code
      </label>
      <MapPin className="ml-3 size-4 shrink-0 text-neutral-700" aria-hidden />
      <input
        id="search-zip"
        name="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        defaultValue={zip}
        placeholder="ZIP"
        className="h-full w-20 bg-transparent px-2 text-sm outline-none placeholder:text-neutral-400 sm:w-24"
      />
      {KEPT.map((key) => {
        const value = params.get(key);
        if (!value) return null;
        return <input key={key} type="hidden" name={key} value={value} />;
      })}
      <button
        type="submit"
        className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  );
}
