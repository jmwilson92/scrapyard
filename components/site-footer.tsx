import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-neutral-200">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Skrappily is free. Shops settle off the site. No payments run here.</p>
        <p>
          <Link href="/map" className="hover:underline">
            Map
          </Link>
          {" · "}
          Map tiles ©{" "}
          <a href="https://www.openstreetmap.org/copyright" className="hover:underline">
            OpenStreetMap
          </a>
          {" · "}
          ZIP centroids ©{" "}
          <a href="https://www.geonames.org/" className="hover:underline">
            GeoNames
          </a>
          , CC BY 4.0.
        </p>
      </div>
    </footer>
  );
}
