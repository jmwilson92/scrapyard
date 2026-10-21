"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

/**
 * On phones the header links collapse behind a menu button. From the md
 * breakpoint up the links render inline exactly as before.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="ml-auto inline-flex size-11 items-center justify-center rounded-full text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>
      <nav
        id="site-menu"
        aria-label="Main"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("a")) setOpen(false);
        }}
        className={cn(
          "text-sm font-semibold md:order-none md:ml-auto md:flex md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-x-3 md:gap-y-2 md:border-0 md:pt-0 md:text-sm",
          open
            ? "order-4 flex w-full flex-col gap-1 border-t border-neutral-200 pt-2 text-base"
            : "hidden",
        )}
      >
        {children}
      </nav>
    </>
  );
}
