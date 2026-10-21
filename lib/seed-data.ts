import type { BusinessType } from "@/lib/business";
import type { Category, DeliveryMode, Material, MetalType, StockForm } from "@/lib/constants";

export const DEMO_PASSWORD = "skrappily-demo";

export type SeedShop = {
  id: string;
  email: string;
  shopName: string;
  zip: string;
  verifiedSeller: boolean;
};

export type SeedListing = {
  id: string;
  sellerId: string;
  title: string;
  category: Category;
  subtype: string;
  material: Material;
  metalType: MetalType;
  alloy: string;
  form: StockForm;
  lengthIn: number | null;
  widthIn: number | null;
  thicknessIn: number | null;
  diameterIn: number | null;
  quantity: number;
  weightLbs: number | null;
  priceCents: number | null;
  zip: string;
  notes: string;
  deliveryMode: DeliveryMode;
  deliveryRadiusMiles: number | null;
  deliveryFeeCents: number | null;
  certsAvailable: boolean;
  certsNote: string;
};

const pickup = {
  deliveryMode: "pickup" as const,
  deliveryRadiusMiles: null,
  deliveryFeeCents: null,
};

function deliver(
  radius: number | null,
  feeCents: number | null,
): Pick<SeedListing, "deliveryMode" | "deliveryRadiusMiles" | "deliveryFeeCents"> {
  return {
    deliveryMode: "delivery",
    deliveryRadiusMiles: radius,
    deliveryFeeCents: feeCents,
  };
}

const VERIFIED_SHOPS = new Set([
  "shop-kearny",
  "shop-harbor",
  "shop-oceanside",
  "shop-carlsbad",
]);

const SHOP_ROWS: Omit<SeedShop, "verifiedSeller">[] = [
  {
    id: "shop-kearny",
    email: "kearny@demo.skrappily.example",
    shopName: "Kearny Mesa Tool & Die",
    zip: "92111",
  },
  {
    id: "shop-mira",
    email: "mira@demo.skrappily.example",
    shopName: "Mira Mesa Aero Cuts",
    zip: "92126",
  },
  {
    id: "shop-harbor",
    email: "harbor@demo.skrappily.example",
    shopName: "Harbor Stainless",
    zip: "91910",
  },
  {
    id: "shop-marine",
    email: "marine@demo.skrappily.example",
    shopName: "National City Marine Fab",
    zip: "91950",
  },
  {
    id: "shop-elcajon",
    email: "elcajon@demo.skrappily.example",
    shopName: "El Cajon Job Shop",
    zip: "92020",
  },
  {
    id: "shop-santee",
    email: "santee@demo.skrappily.example",
    shopName: "Santee Weldments",
    zip: "92071",
  },
  {
    id: "shop-oceanside",
    email: "oceanside@demo.skrappily.example",
    shopName: "North County Titanium",
    zip: "92054",
  },
  {
    id: "shop-carlsbad",
    email: "carlsbad@demo.skrappily.example",
    shopName: "Carlsbad Screw Machine",
    zip: "92008",
  },
  {
    id: "shop-escondido",
    email: "escondido@demo.skrappily.example",
    shopName: "Escondido Metals",
    zip: "92025",
  },
  {
    id: "shop-sorrento",
    email: "sorrento@demo.skrappily.example",
    shopName: "Sorrento Plastics",
    zip: "92121",
  },
  {
    id: "shop-lemon",
    email: "lemon@demo.skrappily.example",
    shopName: "Lemon Grove Chassis",
    zip: "91945",
  },
  {
    id: "shop-vista",
    email: "vista@demo.skrappily.example",
    shopName: "Vista Sheet Metal",
    zip: "92083",
  },
  {
    id: "shop-barrio",
    email: "barrio@demo.skrappily.example",
    shopName: "Barrio Logan Drops",
    zip: "92113",
  },
  {
    id: "shop-oldtown",
    email: "oldtown@demo.skrappily.example",
    shopName: "Old Town Precision",
    zip: "92110",
  },
];

export const SEED_SHOPS: SeedShop[] = SHOP_ROWS.map((shop) => ({
  ...shop,
  verifiedSeller: VERIFIED_SHOPS.has(shop.id),
}));

const CERT_NOTES: Record<string, string> = {
  "ex-02": "Mill test report from the original plate. The heat number is on the paperwork.",
  "ex-04": "Certificate of conformance from the service center.",
  "ex-05": "Mill test report copies are in the office.",
  "ex-08": "Distributor material cert for the 6Al-4V sticks.",
  "ex-12": "Cert of conformance for the normalized 4130.",
  "ex-17": "Certificate of conformance for the 932 bearing bronze.",
};

type SeedRow = Omit<SeedListing, "certsAvailable" | "certsNote" | "category" | "subtype"> &
  Partial<Pick<SeedListing, "category" | "subtype">>;

const LISTING_ROWS: SeedRow[] = [
  {
    id: "ex-01",
    sellerId: "shop-kearny",
    title: "6061-T6 round drops, 1.5 inch",
    material: "aluminum",
    metalType: "al-6061",
    alloy: "6061-T6",
    form: "bar-round",
    diameterIn: 1.5,
    lengthIn: 24,
    widthIn: null,
    thicknessIn: null,
    quantity: 6,
    weightLbs: 25,
    priceCents: 3600,
    zip: "92111",
    notes:
      "Saw drops off a 12-foot bar from the Haas. Ends are rough, the OD is mill finish, no anodize. Cash or Zelle at the counter, weekdays 7 to 3.",
    ...pickup,
  },
  {
    id: "ex-02",
    sellerId: "shop-mira",
    title: "7075-T651 block, 2 x 3 x 4",
    material: "aluminum",
    metalType: "al-7075",
    alloy: "7075-T651",
    form: "bar-round",
    lengthIn: 4,
    widthIn: 3,
    thicknessIn: 2,
    diameterIn: null,
    quantity: 1,
    weightLbs: 2.4,
    priceCents: 4800,
    zip: "92126",
    notes:
      "One sawed block from a fixture plate. Mill surface, a few vise marks. No certs travel with the drop. Can drop it off nearby.",
    ...deliver(30, 2500),
  },
  {
    id: "ex-03",
    sellerId: "shop-mira",
    title: "6061-T6 plate blanks, half inch",
    material: "aluminum",
    metalType: "al-6061",
    alloy: "6061-T6",
    form: "plate-sheet",
    lengthIn: 12,
    widthIn: 6,
    thicknessIn: 0.5,
    diameterIn: null,
    quantity: 4,
    weightLbs: 14,
    priceCents: 4000,
    zip: "92126",
    notes:
      "Four nested blanks left from a chassis job. Edges are sawed, faces are mill. Lot price for all four. Delivery is free inside the radius.",
    ...deliver(20, 0),
  },
  {
    id: "ex-04",
    sellerId: "shop-harbor",
    title: "304 sheet, 16 gauge, 2 x 3 feet",
    material: "stainless",
    metalType: "ss-304",
    alloy: "304",
    form: "plate-sheet",
    lengthIn: 36,
    widthIn: 24,
    thicknessIn: 0.06,
    diameterIn: null,
    quantity: 2,
    weightLbs: 30,
    priceCents: 4800,
    zip: "91910",
    notes:
      "Two sheets, 2B finish, still flat. PVC was pulled. Light handling scratches only. Chula Vista shop, call from the gate.",
    ...pickup,
  },
  {
    id: "ex-05",
    sellerId: "shop-marine",
    title: "316 tube, 1.5 OD x 0.065 wall",
    material: "stainless",
    metalType: "ss-316",
    alloy: "316",
    form: "tube-pipe",
    diameterIn: 1.5,
    thicknessIn: 0.065,
    lengthIn: 48,
    widthIn: null,
    quantity: 3,
    weightLbs: 12,
    priceCents: 7000,
    zip: "91950",
    notes:
      "Welded 316 tube, 4-foot sticks, ends square. Bought for a rail job that got redesigned. No fittings included.",
    ...deliver(40, 5000),
  },
  {
    id: "ex-06",
    sellerId: "shop-elcajon",
    title: "1018 cold rolled round, 2 inch",
    material: "steel",
    metalType: "mild-steel",
    alloy: "1018",
    form: "bar-round",
    diameterIn: 2,
    lengthIn: 18,
    widthIn: null,
    thicknessIn: null,
    quantity: 5,
    weightLbs: 80,
    priceCents: 2800,
    zip: "92020",
    notes:
      "Cold rolled 1018, five 18-inch drops. Light oil, no rust pits. Bring a truck, the lot is about 80 pounds.",
    ...pickup,
  },
  {
    id: "ex-07",
    sellerId: "shop-santee",
    title: "A36 plate, 3/8 x 12 x 24",
    material: "steel",
    metalType: "mild-steel",
    alloy: "A36",
    form: "plate-sheet",
    thicknessIn: 0.375,
    widthIn: 12,
    lengthIn: 24,
    diameterIn: null,
    quantity: 2,
    weightLbs: 61,
    priceCents: 3000,
    zip: "92071",
    notes:
      "Hot rolled A36, two plates. Mill scale still on, edges burned and ground. Fine for fixtures, not for a show surface.",
    ...deliver(15, 2000),
  },
  {
    id: "ex-08",
    sellerId: "shop-oceanside",
    title: "Ti-6Al-4V round, 3/4 inch",
    material: "titanium",
    metalType: "titanium",
    alloy: "Ti-6Al-4V",
    form: "bar-round",
    diameterIn: 0.75,
    lengthIn: 12,
    widthIn: null,
    thicknessIn: null,
    quantity: 2,
    weightLbs: 1.7,
    priceCents: 14000,
    zip: "92054",
    notes:
      "Two 12-inch sticks of 6Al-4V. Centerless ground, ends sawed. Remnant price, still well under mill. Oceanside pickup only.",
    ...pickup,
  },
  {
    id: "ex-09",
    sellerId: "shop-carlsbad",
    title: "360 brass round, 1 inch",
    material: "brass",
    metalType: "brass",
    alloy: "360",
    form: "bar-round",
    diameterIn: 1,
    lengthIn: 14,
    widthIn: null,
    thicknessIn: null,
    quantity: 8,
    weightLbs: 27,
    priceCents: 4200,
    zip: "92008",
    notes:
      "Free-machining 360 brass from a screw machine run. 14-inch remnants, bright finish, no threads cut. Fee quoted when you message.",
    ...deliver(25, null),
  },
  {
    id: "ex-10",
    sellerId: "shop-escondido",
    title: "110 copper round, 3/4 inch",
    material: "copper",
    metalType: "copper",
    alloy: "110",
    form: "bar-round",
    diameterIn: 0.75,
    lengthIn: 12,
    widthIn: null,
    thicknessIn: null,
    quantity: 4,
    weightLbs: 7,
    priceCents: 3600,
    zip: "92025",
    notes:
      "ETP copper 110, four 12-inch pieces. Soft, clean, no fittings brazed on. Escondido shop, afternoons are easiest.",
    ...pickup,
  },
  {
    id: "ex-11",
    sellerId: "shop-sorrento",
    title: "Acetal round, 2 inch, free",
    material: "plastic",
    metalType: "plastic",
    alloy: "Acetal",
    form: "bar-round",
    diameterIn: 2,
    lengthIn: 10,
    widthIn: null,
    thicknessIn: null,
    quantity: 3,
    weightLbs: 5,
    priceCents: null,
    zip: "92121",
    notes:
      "Natural acetal (Delrin-type), three 10-inch drops. Free if you haul them. Black scraps are already gone.",
    ...pickup,
  },
  {
    id: "ex-12",
    sellerId: "shop-lemon",
    title: "4130 tube, 1 inch OD x 0.095 wall",
    material: "steel",
    metalType: "steel-other",
    alloy: "4130",
    form: "tube-pipe",
    diameterIn: 1,
    thicknessIn: 0.095,
    lengthIn: 36,
    widthIn: null,
    quantity: 6,
    weightLbs: 17,
    priceCents: 4500,
    zip: "91945",
    notes:
      "Normalized 4130, six 3-foot sticks. Straight, no bends, no weld. Left over from a cage that got shortened.",
    ...deliver(35, 4000),
  },
  {
    id: "ex-13",
    sellerId: "shop-vista",
    title: "5052-H32 sheet, 0.125 x 18 x 24",
    material: "aluminum",
    metalType: "al-5052",
    alloy: "5052-H32",
    form: "plate-sheet",
    thicknessIn: 0.125,
    widthIn: 18,
    lengthIn: 24,
    diameterIn: null,
    quantity: 3,
    weightLbs: 8,
    priceCents: 2200,
    zip: "92083",
    notes:
      "5052-H32 sheet, three pieces. A few layout scratches, no corrosion. Good for formed panels.",
    ...pickup,
  },
  {
    id: "ex-14",
    sellerId: "shop-barrio",
    title: "6061-T6 bar ends, mixed short drops",
    material: "aluminum",
    metalType: "al-6061",
    alloy: "6061-T6",
    form: "scrap-mixed",
    lengthIn: 6,
    widthIn: 1,
    thicknessIn: 1,
    diameterIn: null,
    quantity: 20,
    weightLbs: 12,
    priceCents: null,
    zip: "92113",
    notes:
      "Short ends from 1-inch square bar. Lengths run 4 to 8 inches, listed as 6. Free, take the whole bucket. Example shop, not live metal.",
    ...pickup,
  },
  {
    id: "ex-15",
    sellerId: "shop-oldtown",
    title: "Invar 36 round, 5/8 inch",
    material: "other",
    metalType: "other",
    alloy: "Invar 36",
    form: "bar-round",
    diameterIn: 0.625,
    lengthIn: 8,
    widthIn: null,
    thicknessIn: null,
    quantity: 2,
    weightLbs: 1.4,
    priceCents: 5500,
    zip: "92110",
    notes:
      "Two 8-inch remnants of Invar 36 from a fixture. Ground OD, sawed ends. Unusual, so the price is still a remnant price.",
    ...deliver(10, 1500),
  },
  {
    id: "ex-16",
    sellerId: "shop-elcajon",
    title: "A36 angle, 2 x 2 x 1/4, 6 foot",
    material: "steel",
    metalType: "mild-steel",
    alloy: "A36",
    form: "angle-channel",
    thicknessIn: 0.25,
    widthIn: 2,
    lengthIn: 72,
    diameterIn: null,
    quantity: 4,
    weightLbs: 48,
    priceCents: 6400,
    zip: "92020",
    notes:
      "Four 6-foot sticks of 2 x 2 x 1/4 angle. Hot rolled, light scale, ends sawed. Can deliver on the east county route.",
    ...deliver(50, 3000),
  },
  {
    id: "ex-17",
    sellerId: "shop-marine",
    title: "932 bearing bronze round, 1.25 inch",
    material: "bronze",
    metalType: "bronze",
    alloy: "932",
    form: "bar-round",
    diameterIn: 1.25,
    lengthIn: 8,
    widthIn: null,
    thicknessIn: null,
    quantity: 2,
    weightLbs: 6,
    priceCents: 7800,
    zip: "91950",
    notes:
      "Two 8-inch drops of 932 bearing bronze. Sawed ends, no bushings bored yet. Pickup at the National City shop.",
    ...pickup,
  },
];

/** Non-metal sample lots, added after launch. Also back-filled into seeded databases. */
const NON_METAL_ROWS: SeedRow[] = [
  {
    id: "ex-18",
    sellerId: "shop-barrio",
    category: "wood",
    subtype: "dimensional-lumber",
    title: "Doug fir 2x6 offcuts, 3 to 6 ft",
    material: "other",
    metalType: "other",
    alloy: "Doug fir #2",
    form: "lot-bundle",
    lengthIn: 72,
    widthIn: 5.5,
    thicknessIn: 1.5,
    diameterIn: null,
    quantity: 30,
    weightLbs: null,
    priceCents: 4000,
    zip: "92113",
    notes:
      "About thirty 2x6 offcuts from a framing job. Dry, no nails. Good for blocking or shop jigs.",
    ...pickup,
  },
  {
    id: "ex-19",
    sellerId: "shop-santee",
    category: "construction",
    subtype: "drywall",
    title: "1/2 inch drywall, 4x8 sheets, 12 left",
    material: "other",
    metalType: "other",
    alloy: "Regular 1/2 in",
    form: "plate-sheet",
    lengthIn: 96,
    widthIn: 48,
    thicknessIn: 0.5,
    diameterIn: null,
    quantity: 12,
    weightLbs: null,
    priceCents: 6000,
    zip: "92071",
    notes: "Twelve full sheets left over from a remodel. Stored inside, corners clean.",
    ...deliver(15, 2500),
  },
  {
    id: "ex-20",
    sellerId: "shop-escondido",
    category: "construction",
    subtype: "tile",
    title: "Porcelain floor tile, 12x24, about 80 sq ft",
    material: "other",
    metalType: "other",
    alloy: "Matte gray porcelain",
    form: "lot-bundle",
    lengthIn: 24,
    widthIn: 12,
    thicknessIn: 0.375,
    diameterIn: null,
    quantity: 40,
    weightLbs: 200,
    priceCents: 9000,
    zip: "92025",
    notes: "Ten unopened boxes of matte gray porcelain. Same dye lot.",
    ...pickup,
  },
  {
    id: "ex-21",
    sellerId: "shop-sorrento",
    category: "plastics",
    subtype: "acrylic",
    title: "Clear acrylic sheet drops, 1/4 inch",
    material: "other",
    metalType: "other",
    alloy: "Cast acrylic",
    form: "plate-sheet",
    lengthIn: 24,
    widthIn: 18,
    thicknessIn: 0.25,
    diameterIn: null,
    quantity: 6,
    weightLbs: null,
    priceCents: 3000,
    zip: "92121",
    notes: "Six cast acrylic drops with film still on both sides.",
    ...pickup,
  },
  {
    id: "ex-22",
    sellerId: "shop-lemon",
    category: "electrical",
    subtype: "building-wire",
    title: "12/2 Romex, partial 250 ft roll",
    material: "other",
    metalType: "other",
    alloy: "12/2 NM-B",
    form: "lot-bundle",
    lengthIn: null,
    widthIn: null,
    thicknessIn: null,
    diameterIn: null,
    quantity: 1,
    weightLbs: null,
    priceCents: 5500,
    zip: "91945",
    notes: "About 140 feet left on a 250 ft roll of 12/2 with ground.",
    ...pickup,
  },
  {
    id: "ex-23",
    sellerId: "shop-vista",
    category: "glass",
    subtype: "windows-mirrors",
    title: "Vinyl dual-pane windows, 3 units",
    material: "other",
    metalType: "other",
    alloy: "Dual pane, low-E",
    form: "pieces-units",
    lengthIn: 48,
    widthIn: 36,
    thicknessIn: null,
    diameterIn: null,
    quantity: 3,
    weightLbs: null,
    priceCents: null,
    zip: "92083",
    notes: "Three wrong-size windows from a job. Free to whoever picks them up.",
    ...pickup,
  },
];

function finish(listing: SeedRow): SeedListing {
  const category = listing.category ?? "metal";
  return {
    ...listing,
    category,
    subtype: listing.subtype ?? (category === "metal" ? listing.metalType : "other"),
    certsAvailable: category === "metal" && Boolean(CERT_NOTES[listing.id]),
    certsNote: category === "metal" ? (CERT_NOTES[listing.id] ?? "") : "",
  };
}

export const NON_METAL_SEED_LISTINGS: SeedListing[] = NON_METAL_ROWS.map(finish);

export const SEED_LISTINGS: SeedListing[] = [
  ...LISTING_ROWS.map(finish),
  ...NON_METAL_SEED_LISTINGS,
];

/** Business profile details for the seeded example companies. */
export const EXAMPLE_BUSINESS_TYPES: Record<string, BusinessType> = {
  "shop-kearny": "machine-shop",
  "shop-mira": "machine-shop",
  "shop-harbor": "distributor",
  "shop-marine": "fabricator",
  "shop-elcajon": "machine-shop",
  "shop-santee": "fabricator",
  "shop-oceanside": "distributor",
  "shop-carlsbad": "manufacturer",
  "shop-escondido": "recycler",
  "shop-sorrento": "manufacturer",
  "shop-lemon": "fabricator",
  "shop-vista": "fabricator",
  "shop-barrio": "recycler",
  "shop-oldtown": "machine-shop",
};

export function exampleCompanyId(userId: string): string {
  return `co-${userId}`;
}
