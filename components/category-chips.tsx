import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { toSearchParams, type SearchQuery } from "@/lib/search";
import { cn } from "cn";

export function CategoryChips({
  query,
  pathname = "/browse",
  view,
}: {
  query: SearchQuery;
  pathname?: string;
  view?: string;
}) {
  const chips = [
    { label: "All", category: null },
    ...CATEGORIES.map((item) => ({ label: item.label, category: item.value })),
  ];

  return (
    <nav aria-label="Categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((chip) => {
        const active =
          chip.category == null ? !query.category : query.category === chip.category;
        const params = toSearchParams(query, {
          category: chip.category,
          subtype: null,
          material: null,
          metalType: null,
          view: view ?? null,
        });
        const qs = params.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;
        return (
          <Link
            key={chip.label}
            href={href}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 py-1.5 md:min-h-0 text-sm font-semibold",
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
            )}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}
