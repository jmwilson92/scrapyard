import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ListingPhoto } from "@/components/listing-photo";
import { formLabel, materialLabel } from "@/lib/constants";
import {
  formatDimensions,
  formatDistance,
  formatMoney,
  formatQuantity,
  formatWeight,
} from "@/lib/format";
import type { Listing } from "@/lib/types";

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
  const weight = formatWeight(listing.weightLbs);
  const dimensions = formatDimensions(listing);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-colors hover:ring-copper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="relative">
        <ListingPhoto src={listing.photoUrl} alt="" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {listing.isExample ? <Badge variant="secondary">Example</Badge> : null}
          {listing.status === "sold" ? (
            <Badge variant="destructive">Sold</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {materialLabel(listing.material)} · {formLabel(listing.form)}
        </p>
        <h2 className="font-display text-2xl leading-none tracking-wide group-hover:text-copper">
          {listing.alloy}
        </h2>
        <p className="text-sm leading-6">{listing.title}</p>
        <p className="text-sm text-muted-foreground">
          {dimensions || "Dimensions not listed"}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatQuantity(listing.quantity)}
          {weight ? ` · ${weight}` : ""} · {listing.shopName}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {listing.zip}
            {distance ? ` · ${distance}` : ""}
          </p>
          <p
            className={
              listing.priceCents == null
                ? "font-display text-3xl tracking-wide text-primary"
                : "font-display text-3xl tracking-wide text-copper"
            }
          >
            {formatMoney(listing.priceCents)}
            {listing.priceCents != null ? (
              <span className="ml-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">
                lot
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </Link>
  );
}
