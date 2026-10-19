import { FORMS, MATERIALS, MILES_OPTIONS } from "@/lib/constants";
import type { SearchQuery } from "@/lib/search";
import { Button } from "@/components/ui/button";

const controlClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function SearchForm({
  query,
  defaultZip,
}: {
  query: SearchQuery;
  defaultZip?: string;
}) {
  return (
    <form action="/browse" method="get" className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium">
          ZIP code
          <input
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={query.originZip || defaultZip || ""}
            placeholder="92101"
            className={controlClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Within
          <select
            name="miles"
            defaultValue={
              query.maxDistanceMiles == null ? "any" : String(query.maxDistanceMiles)
            }
            className={controlClass}
          >
            {MILES_OPTIONS.map((miles) => (
              <option key={miles} value={miles}>
                {miles} miles
              </option>
            ))}
            <option value="any">Any distance</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Material
          <select name="material" defaultValue={query.material ?? ""} className={controlClass}>
            <option value="">Any material</option>
            {MATERIALS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Form
          <select name="form" defaultValue={query.form ?? ""} className={controlClass}>
            <option value="">Any form</option>
            {FORMS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Alloy contains
          <input
            name="alloy"
            defaultValue={query.alloy ?? ""}
            placeholder="6061, 304, A36"
            className={controlClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Max lot price
          <input
            name="max"
            inputMode="decimal"
            defaultValue={
              query.maxPriceCents == null ? "" : String(query.maxPriceCents / 100)
            }
            placeholder="Any"
            className={controlClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Free drops
          <select
            name="free"
            defaultValue={query.includeFree ? "1" : "0"}
            className={controlClass}
          >
            <option value="1">Include free</option>
            <option value="0">Hide free</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-11 flex-1 px-4 text-base">
            Search
          </Button>
          <a
            href="/browse"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
          >
            Clear
          </a>
        </div>
      </div>
    </form>
  );
}
