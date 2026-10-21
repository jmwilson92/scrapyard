import Link from "next/link";
import { ListingPhoto } from "@/components/listing-photo";
import { VerifiedSellerBadge } from "@/components/verified-seller";
import { categoryLabel, subtypeLabel } from "@/lib/constants";
import { formatDelivery, formatDistance, formatListingPrice } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { lookupZip } from "@/lib/zip";

export function ListingCard({
  listing,
  distanceMiles,
  fromZip,
}: {
  listing: Listing;
  distanceMiles: number | null;
  fromZip?: string;
}) {
  const href = fromZip
    ? `/listings/${listing.id}?from=${fromZip}`
    : `/listings/${listing.id}`;
  const distance = formatDistance(distanceMiles);
  const place = lookupZip(listing.zip);
  const where = place ? `${place.city}, ${place.state}` : listing.zip;
  const delivers = listing.deliveryMode === "delivery";

  return (
    <Link href={href} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <div className="relative">
        <ListingPhoto src={listing.photoUrl} alt="" className="rounded-2xl" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {listing.listingType === "wanted" ? (
            <span className="rounded-full bg-copper px-2 py-0.5 text-xs font-semibold text-white">
              Wanted
            </span>
          ) : null}
          {listing.isExample ? (
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-neutral-800">
              Example
            </span>
          ) : null}
          {listing.status === "sold" ? (
            <span className="rounded-full bg-neutral-900/90 px-2 py-0.5 text-xs font-semibold text-white">
              Sold
            </span>
          ) : null}
          {listing.category === "metal" && listing.certsAvailable ? (
            <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
              Certs
            </span>
          ) : null}
        </div>
        <span
          className={
            delivers
              ? "absolute bottom-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white"
              : "absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-neutral-800"
          }
        >
          {delivers ? "Delivers" : "Pickup only"}
        </span>
      </div>
      <div className="px-0.5 pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-bold tracking-tight">{formatListingPrice(listing)}</p>
          {distance ? <p className="text-sm text-neutral-500">{distance}</p> : null}
        </div>
        <h2 className="mt-0.5 line-clamp-2 text-sm leading-5 text-neutral-800 group-hover:underline">
          {listing.title}
        </h2>
        <p className="mt-0.5 line-clamp-1 text-xs font-medium text-neutral-600">
          {listing.category === "metal"
            ? subtypeLabel("metal", listing.metalType)
            : `${categoryLabel(listing.category)} · ${subtypeLabel(listing.category, listing.subtype)}`}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {where}
          {listing.priceCents != null && listing.listingType !== "wanted" ? " · lot" : ""}
        </p>
        {listing.sellerVerified ? (
          <p className="mt-1">
            <VerifiedSellerBadge />
          </p>
        ) : null}
        <p className="sr-only">{formatDelivery(listing)}</p>
      </div>
    </Link>
  );
}
