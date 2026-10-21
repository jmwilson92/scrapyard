"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";

/**
 * Phones get a "Filters" button that opens the filter form as a full-screen
 * sheet. From the md breakpoint up the form renders inline as before.
 */
export function FiltersDrawer({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="filters-panel"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 md:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {activeCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      <div
        id="filters-panel"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Filters" : undefined}
        className={cn(
          "md:static md:block md:overflow-visible md:bg-transparent md:p-0",
          open
            ? "fixed inset-0 z-[60] block overflow-y-auto bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            : "hidden",
        )}
      >
        <div className="mb-3 flex items-center justify-between md:hidden">
          <p className="text-lg font-bold">Filters</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <X className="size-6" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
