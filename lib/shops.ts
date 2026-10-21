import { categoryLabel } from "@/lib/constants";

export type ShopPin = {
  sellerId: string;
  shopName: string;
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  count: number;
  /** Category labels this shop has active listings in. */
  categories: string[];
};

type PinListing = {
  sellerId: string;
  shopName: string;
  zip: string;
  shopZip?: string;
  status: string;
  category?: string;
};

type PinPoint = {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
};

const SPREAD_DEGREES = 0.012;

export function buildShopPins(
  listings: readonly PinListing[],
  lookup: (zip: string) => PinPoint | null,
): ShopPin[] {
  const grouped = new Map<
    string,
    { shopName: string; zip: string; count: number; categories: Set<string> }
  >();

  for (const listing of listings) {
    if (listing.status !== "active") continue;
    const zip = listing.shopZip || listing.zip;
    const current = grouped.get(listing.sellerId);
    const category = categoryLabel(listing.category ?? "metal");
    if (current) {
      current.count += 1;
      current.categories.add(category);
      continue;
    }
    grouped.set(listing.sellerId, {
      shopName: listing.shopName,
      zip,
      count: 1,
      categories: new Set([category]),
    });
  }

  const located: ShopPin[] = [];
  for (const [sellerId, shop] of grouped) {
    const point = lookup(shop.zip);
    if (!point) continue;
    located.push({
      sellerId,
      shopName: shop.shopName,
      zip: shop.zip,
      city: point.city ?? "",
      state: point.state ?? "",
      lat: point.lat,
      lng: point.lng,
      count: shop.count,
      categories: [...shop.categories],
    });
  }

  return spreadPins(located);
}

function spreadPins(pins: ShopPin[]): ShopPin[] {
  const groups = new Map<string, ShopPin[]>();
  for (const pin of pins) {
    const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
    const list = groups.get(key);
    if (list) list.push(pin);
    else groups.set(key, [pin]);
  }

  const spread: ShopPin[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      spread.push(group[0]);
      continue;
    }
    group.forEach((pin, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      spread.push({
        ...pin,
        lat: pin.lat + SPREAD_DEGREES * Math.cos(angle),
        lng: pin.lng + SPREAD_DEGREES * Math.sin(angle),
      });
    });
  }
  return spread;
}
