import {
  CATEGORIES,
  FORMS,
  LENGTH_BUCKETS,
  METAL_TYPES,
  MILES_OPTIONS,
  THICKNESS_BUCKETS,
  subtypesFor,
} from "@/lib/constants";
import { FiltersDrawer } from "@/components/filters-drawer";
import type { SearchQuery } from "@/lib/search";
import { Button } from "@/components/ui/button";

const controlClass =
  "h-11 w-full rounded-xl md:h-10 border border-neutral-300 bg-white px-3 text-sm outline-none focus-visible:border-neutral-900";

export function SearchForm({
  query,
  defaultZip,
  action = "/browse",
  view,
}: {
  query: SearchQuery;
  defaultZip?: string;
  action?: string;
  view?: string;
}) {
  const showMetal = !query.category || query.category === "metal";
  const subtypes = query.category && query.category !== "metal" ? subtypesFor(query.category) : [];
  const activeCount = [
    query.category,
    query.subtype,
    query.metalType,
    query.form,
    query.thickness,
    query.length,
    query.alloy,
    query.maxPriceCents != null ? "max" : undefined,
    query.includeFree ? undefined : "free",
    query.deliveryOnly ? "delivery" : undefined,
    query.certsOnly ? "certs" : undefined,
    query.listingType,
  ].filter(Boolean).length;

  return (
    <FiltersDrawer activeCount={activeCount}>
    <form action={action} method="get" className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.material ? <input type="hidden" name="material" value={query.material} /> : null}
      {view ? <input type="hidden" name="view" value={view} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
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
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Distance
          <select
            name="miles"
            defaultValue={query.maxDistanceMiles == null ? "any" : String(query.maxDistanceMiles)}
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
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Category
          <select name="category" defaultValue={query.category ?? ""} className={controlClass}>
            <option value="">All materials</option>
            {CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {showMetal ? (
          <label className="grid gap-1 text-xs font-semibold text-neutral-600">
            Metal type
            <select name="metal" defaultValue={query.metalType ?? ""} className={controlClass}>
              <option value="">Any metal</option>
              {METAL_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="grid gap-1 text-xs font-semibold text-neutral-600">
            Type
            <select name="type" defaultValue={query.subtype ?? ""} className={controlClass}>
              <option value="">Any type</option>
              {subtypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
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
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Thickness
          <select name="thickness" defaultValue={query.thickness ?? ""} className={controlClass}>
            <option value="">Any thickness</option>
            {THICKNESS_BUCKETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Length
          <select name="length" defaultValue={query.length ?? ""} className={controlClass}>
            <option value="">Any length</option>
            {LENGTH_BUCKETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Grade or spec contains
          <input
            name="alloy"
            defaultValue={query.alloy ?? ""}
            placeholder="T6, 304, A36"
            className={controlClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Max price
          <input
            name="max"
            inputMode="decimal"
            defaultValue={query.maxPriceCents == null ? "" : String(query.maxPriceCents / 100)}
            placeholder="Any"
            className={controlClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Post type
          <select name="kind" defaultValue={query.listingType ?? ""} className={controlClass}>
            <option value="">Selling and wanted</option>
            <option value="offer">Selling only</option>
            <option value="wanted">Wanted (RFQs) only</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Free lots
          <select name="free" defaultValue={query.includeFree ? "1" : "0"} className={controlClass}>
            <option value="1">Include free</option>
            <option value="0">Hide free</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold md:min-h-0 md:items-end md:pb-2">
          <input
            type="checkbox"
            name="delivery"
            value="1"
            defaultChecked={query.deliveryOnly}
            className="size-4 accent-primary"
          />
          Delivery available
        </label>
        {showMetal ? (
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold md:min-h-0 md:items-end md:pb-2">
          <input
            type="checkbox"
            name="certs"
            value="1"
            defaultChecked={query.certsOnly}
            className="size-4 accent-primary"
          />
          Material certs available
        </label>
        ) : null}
        <div className="flex items-end gap-2 sm:col-span-2 md:col-span-2 xl:col-span-2">
          <Button type="submit" className="h-11 flex-1 rounded-full md:h-10 px-4 text-sm font-semibold">
            Apply filters
          </Button>
          <a
            href={action}
            className="inline-flex h-11 items-center md:h-10 justify-center rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-50"
          >
            Clear
          </a>
        </div>
      </div>
      <p className="text-xs leading-5 text-neutral-500">
        Thickness uses the listed thickness, or the diameter when thickness is blank. Length uses the listed length. Delivery fee is informational — Skrappily does not take payment.
      </p>
    </form>
    </FiltersDrawer>
  );
}
