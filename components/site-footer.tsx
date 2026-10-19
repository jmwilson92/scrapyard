import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          DropYard is free. Shops settle up at pickup. No payments run through
          the board.
        </p>
        <p>
          <Link href="/browse" className="underline-offset-2 hover:underline">
            Browse remnants
          </Link>
          {" · "}
          ZIP centroids ©{" "}
          <a
            href="https://www.geonames.org/"
            className="underline-offset-2 hover:underline"
          >
            GeoNames
          </a>
          , CC BY 4.0.
        </p>
      </div>
    </footer>
  );
}
