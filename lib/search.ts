import {
  canonicalForm,
  categoryLabel,
  isCategory,
  isSubtypeFor,
  subtypeLabel,
  formLabel,
  isMaterial,
  isMetalType,
  lengthBucket,
  matchesBucket,
  materialLabel,
  metalTypeLabel,
  MILES_OPTIONS,
  thicknessBucket,
} from "@/lib/constants";
import { haversineMiles, type LatLng } from "@/lib/geo";
import { normalizeZip } from "@/lib/zip";

export type SearchableListing = {
  id: string;
  category?: string;
  subtype?: string;
  material: string;
  metalType?: string;
  alloy: string;
  form: string;
  title?: string;
  shopName?: string;
  notes?: string;
  priceCents: number | null;
  zip: string;
  status: string;
  createdAt: number;
  thicknessIn?: number | null;
  lengthIn?: number | null;
  diameterIn?: number | null;
  widthIn?: number | null;
  deliveryMode?: string;
  certsAvailable?: boolean;
};

export type SearchHit<T extends SearchableListing> = T & {
  distanceMiles: number | null;
};

export type SearchQuery = {
  q?: string;
  category?: string;
  subtype?: string;
  material?: string;
  metalType?: string;
  alloy?: string;
  form?: string;
  thickness?: string;
  length?: string;
  maxPriceCents?: number | null;
  includeFree: boolean;
  originZip?: string;
  maxDistanceMiles: number | null;
  includeSold: boolean;
  deliveryOnly: boolean;
  certsOnly: boolean;
};

export type SearchResult<T extends SearchableListing> =
  | { ok: true; results: SearchHit<T>[] }
  | { ok: false; error: "unknown_zip" };

type QueryInput = Record<string, string | string[] | undefined>;

export function parseSearchQuery(input: QueryInput): SearchQuery {
  const q = first(input.q).trim().slice(0, 80);
  const material = first(input.material).trim().toLowerCase();
  const categoryRaw = first(input.category).trim().toLowerCase();
  const category = isCategory(categoryRaw) ? categoryRaw : undefined;
  const subtypeRaw = first(input.type).trim().toLowerCase();
  const metal = first(input.metal).trim().toLowerCase();
  const form = canonicalForm(first(input.form).trim().toLowerCase());
  const alloy = first(input.alloy).trim().slice(0, 40);
  const thickness = first(input.thickness).trim();
  const length = first(input.length).trim();
  const zip = normalizeZip(first(input.zip));
  const milesRaw = first(input.miles).trim().toLowerCase();
  const maxRaw = first(input.max).trim();
  const free = first(input.free).trim();
  const delivery = first(input.delivery).trim();
  const certs = first(input.certs).trim();

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
    q: q || undefined,
    category,
    subtype:
      category && category !== "metal" && isSubtypeFor(category, subtypeRaw)
        ? subtypeRaw
        : undefined,
    material: isMaterial(material) ? material : undefined,
    metalType: isMetalType(metal) ? metal : undefined,
    alloy: alloy || undefined,
    form: form ?? undefined,
    thickness: thicknessBucket(thickness) ? thickness : undefined,
    length: lengthBucket(length) ? length : undefined,
    maxPriceCents,
    includeFree: free !== "0",
    originZip: zip || undefined,
    maxDistanceMiles,
    includeSold: false,
    deliveryOnly: delivery === "1",
    certsOnly: certs === "1",
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
  const keywords = (query.q ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const thickness = query.thickness ? thicknessBucket(query.thickness) : null;
  const length = query.length ? lengthBucket(query.length) : null;
  const results: SearchHit<T>[] = [];

  for (const listing of listings) {
    if (!query.includeSold && listing.status !== "active") continue;
    const listingCategory = listing.category ?? "metal";
    if (query.category && listingCategory !== query.category) continue;
    if (query.subtype && listing.subtype !== query.subtype) continue;
    if (query.material && listing.material !== query.material) continue;
    if (
      query.metalType &&
      (listingCategory !== "metal" || listing.metalType !== query.metalType)
    ) {
      continue;
    }
    if (query.form && canonicalForm(listing.form) !== query.form) continue;
    if (alloy && !listing.alloy.toLowerCase().includes(alloy)) continue;
    if (keywords.length > 0 && !matchesKeywords(listing, keywords)) continue;
    if (thickness && !matchesBucket(sectionSize(listing), thickness)) continue;
    if (length && !matchesBucket(listing.lengthIn ?? null, length)) continue;
    if (query.deliveryOnly && listing.deliveryMode !== "delivery") continue;
    if (query.certsOnly && !listing.certsAvailable) continue;

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

export function toSearchParams(
  query: SearchQuery,
  patch: {
    category?: string | null;
    subtype?: string | null;
    material?: string | null;
    metalType?: string | null;
    form?: string | null;
    view?: string | null;
  } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const material = patch.material === null ? undefined : (patch.material ?? query.material);
  const metalType =
    patch.metalType === null ? undefined : (patch.metalType ?? query.metalType);
  const category =
    patch.category === null ? undefined : (patch.category ?? query.category);
  const subtype =
    patch.subtype === null ? undefined : (patch.subtype ?? query.subtype);
  const form = patch.form === null ? undefined : (patch.form ?? query.form);

  if (query.q) params.set("q", query.q);
  if (query.originZip) params.set("zip", query.originZip);
  if (query.originZip) {
    params.set(
      "miles",
      query.maxDistanceMiles == null ? "any" : String(query.maxDistanceMiles),
    );
  }
  if (category) params.set("category", category);
  if (subtype) params.set("type", subtype);
  if (material) params.set("material", material);
  if (metalType) params.set("metal", metalType);
  if (form) params.set("form", form);
  if (query.alloy) params.set("alloy", query.alloy);
  if (query.thickness) params.set("thickness", query.thickness);
  if (query.length) params.set("length", query.length);
  if (query.maxPriceCents != null) {
    params.set("max", String(query.maxPriceCents / 100));
  }
  if (!query.includeFree) params.set("free", "0");
  if (query.deliveryOnly) params.set("delivery", "1");
  if (query.certsOnly) params.set("certs", "1");
  if (patch.view) params.set("view", patch.view);
  return params;
}

function matchesKeywords(listing: SearchableListing, keywords: string[]): boolean {
  const hay = [
    listing.title,
    listing.alloy,
    listing.notes,
    listing.shopName,
    categoryLabel(listing.category ?? "metal"),
    listing.subtype ? subtypeLabel(listing.category ?? "metal", listing.subtype) : "",
    listing.material,
    materialLabel(listing.material),
    listing.metalType,
    listing.metalType ? metalTypeLabel(listing.metalType) : "",
    formLabel(listing.form),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return keywords.every((keyword) => hay.includes(keyword));
}

function sectionSize(listing: SearchableListing): number | null {
  if (listing.thicknessIn != null && listing.thicknessIn > 0) return listing.thicknessIn;
  if (listing.diameterIn != null && listing.diameterIn > 0) return listing.diameterIn;
  return null;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function defaultMiles(): number {
  return MILES_OPTIONS.includes(50) ? 50 : 50;
}
