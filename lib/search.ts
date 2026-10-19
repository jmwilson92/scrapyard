import { isForm, isMaterial, MILES_OPTIONS } from "@/lib/constants";
import { haversineMiles, type LatLng } from "@/lib/geo";
import { normalizeZip } from "@/lib/zip";

export type SearchableListing = {
  id: string;
  material: string;
  alloy: string;
  form: string;
  priceCents: number | null;
  zip: string;
  status: string;
  createdAt: number;
};

export type SearchHit<T extends SearchableListing> = T & {
  distanceMiles: number | null;
};

export type SearchQuery = {
  material?: string;
  alloy?: string;
  form?: string;
  maxPriceCents?: number | null;
  includeFree: boolean;
  originZip?: string;
  maxDistanceMiles: number | null;
  includeSold: boolean;
};

export type SearchResult<T extends SearchableListing> =
  | { ok: true; results: SearchHit<T>[] }
  | { ok: false; error: "unknown_zip" };

type QueryInput = Record<string, string | string[] | undefined>;

export function parseSearchQuery(input: QueryInput): SearchQuery {
  const material = first(input.material).trim().toLowerCase();
  const form = first(input.form).trim().toLowerCase();
  const alloy = first(input.alloy).trim().slice(0, 40);
  const zip = normalizeZip(first(input.zip));
  const milesRaw = first(input.miles).trim().toLowerCase();
  const maxRaw = first(input.max).trim();
  const free = first(input.free).trim();

  let maxPriceCents: number | null = null;
  if (maxRaw) {
    const dollars = Number(maxRaw);
    if (Number.isFinite(dollars) && dollars >= 0 && dollars <= 100000) {
      maxPriceCents = Math.round(dollars * 100);
    }
  }

  let maxDistanceMiles: number | null = 50;
  if (!zip) {
    maxDistanceMiles = null;
  } else if (milesRaw === "any") {
    maxDistanceMiles = null;
  } else if (milesRaw) {
    const miles = Number(milesRaw);
    maxDistanceMiles =
      Number.isFinite(miles) && miles > 0 ? miles : defaultMiles();
  }

  return {
    material: isMaterial(material) ? material : undefined,
    alloy: alloy || undefined,
    form: isForm(form) ? form : undefined,
    maxPriceCents,
    includeFree: free !== "0",
    originZip: zip || undefined,
    maxDistanceMiles,
    includeSold: false,
  };
}

export function searchListings<T extends SearchableListing>(
  listings: readonly T[],
  query: SearchQuery,
  lookup: (zip: string) => LatLng | null,
): SearchResult<T> {
  let origin: LatLng | null = null;
  if (query.originZip) {
    origin = lookup(normalizeZip(query.originZip));
    if (!origin) return { ok: false, error: "unknown_zip" };
  }

  const alloy = query.alloy?.trim().toLowerCase() ?? "";
  const results: SearchHit<T>[] = [];

  for (const listing of listings) {
    if (!query.includeSold && listing.status !== "active") continue;
    if (query.material && listing.material !== query.material) continue;
    if (query.form && listing.form !== query.form) continue;
    if (alloy && !listing.alloy.toLowerCase().includes(alloy)) continue;

    const free = listing.priceCents == null;
    if (free && !query.includeFree) continue;
    if (
      query.maxPriceCents != null &&
      !free &&
      listing.priceCents != null &&
      listing.priceCents > query.maxPriceCents
    ) {
      continue;
    }

    let distanceMiles: number | null = null;
    if (origin) {
      const point = lookup(listing.zip);
      if (!point) continue;
      distanceMiles = haversineMiles(origin, point);
      if (
        query.maxDistanceMiles != null &&
        distanceMiles > query.maxDistanceMiles
      ) {
        continue;
      }
    }

    results.push({ ...listing, distanceMiles });
  }

  results.sort((a, b) => {
    if (
      a.distanceMiles != null &&
      b.distanceMiles != null &&
      a.distanceMiles !== b.distanceMiles
    ) {
      return a.distanceMiles - b.distanceMiles;
    }
    return b.createdAt - a.createdAt;
  });

  return { ok: true, results };
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function defaultMiles(): number {
  return MILES_OPTIONS.includes(50) ? 50 : 50;
}
