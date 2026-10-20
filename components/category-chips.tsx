import Link from "next/link";
import { MATERIALS } from "@/lib/constants";
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
    { label: "All", material: null },
    ...MATERIALS.map((item) => ({ label: item.label, material: item.value })),
  ];

  return (
    <nav aria-label="Categories" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chips.map((chip) => {
        const active = chip.material == null ? !query.material : query.material === chip.material;
        const params = toSearchParams(query, {
          material: chip.material,
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
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold",
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
