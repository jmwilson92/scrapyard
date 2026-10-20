import {
  FORMS,
  LENGTH_BUCKETS,
  METAL_TYPES,
  MILES_OPTIONS,
  THICKNESS_BUCKETS,
} from "@/lib/constants";
import type { SearchQuery } from "@/lib/search";
import { Button } from "@/components/ui/button";

const controlClass =
  "h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus-visible:border-neutral-900";

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
  return (
    <form action={action} method="get" className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.material ? <input type="hidden" name="material" value={query.material} /> : null}
      {view ? <input type="hidden" name="view" value={view} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
          Grade contains
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
          Free lots
          <select name="free" defaultValue={query.includeFree ? "1" : "0"} className={controlClass}>
            <option value="1">Include free</option>
            <option value="0">Hide free</option>
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="delivery"
            value="1"
            defaultChecked={query.deliveryOnly}
            className="size-4 accent-primary"
          />
          Delivery available
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="certs"
            value="1"
            defaultChecked={query.certsOnly}
            className="size-4 accent-primary"
          />
          Material certs available
        </label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-2 xl:col-span-2">
          <Button type="submit" className="h-10 flex-1 rounded-full px-4 text-sm font-semibold">
            Apply filters
          </Button>
          <a
            href={action}
            className="inline-flex h-10 items-center justify-center rounded-full border border-neutral-300 px-4 text-sm font-semibold hover:bg-neutral-50"
          >
            Clear
          </a>
        </div>
      </div>
      <p className="text-xs leading-5 text-neutral-500">
        Thickness uses the listed thickness, or the diameter when thickness is blank. Length uses the listed length. Delivery fee is informational — DropYard does not take payment.
      </p>
    </form>
  );
}
