import type { Material, StockForm } from "@/lib/constants";

export const DEMO_PASSWORD = "dropyard-demo";

export type SeedShop = {
  id: string;
  email: string;
  shopName: string;
  zip: string;
};

export type SeedListing = {
  id: string;
  sellerId: string;
  title: string;
  material: Material;
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
};

export const SEED_SHOPS: SeedShop[] = [
  {
    id: "shop-kearny",
    email: "kearny@demo.dropyard.example",
    shopName: "Kearny Mesa Tool & Die",
    zip: "92111",
  },
  {
    id: "shop-mira",
    email: "mira@demo.dropyard.example",
    shopName: "Mira Mesa Aero Cuts",
    zip: "92126",
  },
  {
    id: "shop-harbor",
    email: "harbor@demo.dropyard.example",
    shopName: "Harbor Stainless",
    zip: "91910",
  },
  {
    id: "shop-marine",
    email: "marine@demo.dropyard.example",
    shopName: "National City Marine Fab",
    zip: "91950",
  },
  {
    id: "shop-elcajon",
    email: "elcajon@demo.dropyard.example",
    shopName: "El Cajon Job Shop",
    zip: "92020",
  },
  {
    id: "shop-santee",
    email: "santee@demo.dropyard.example",
    shopName: "Santee Weldments",
    zip: "92071",
  },
  {
    id: "shop-oceanside",
    email: "oceanside@demo.dropyard.example",
    shopName: "North County Titanium",
    zip: "92054",
  },
  {
    id: "shop-carlsbad",
    email: "carlsbad@demo.dropyard.example",
    shopName: "Carlsbad Screw Machine",
    zip: "92008",
  },
  {
    id: "shop-escondido",
    email: "escondido@demo.dropyard.example",
    shopName: "Escondido Metals",
    zip: "92025",
  },
  {
    id: "shop-sorrento",
    email: "sorrento@demo.dropyard.example",
    shopName: "Sorrento Plastics",
    zip: "92121",
  },
  {
    id: "shop-lemon",
    email: "lemon@demo.dropyard.example",
    shopName: "Lemon Grove Chassis",
    zip: "91945",
  },
  {
    id: "shop-vista",
    email: "vista@demo.dropyard.example",
    shopName: "Vista Sheet Metal",
    zip: "92083",
  },
  {
    id: "shop-barrio",
    email: "barrio@demo.dropyard.example",
    shopName: "Barrio Logan Drops",
    zip: "92113",
  },
  {
    id: "shop-oldtown",
    email: "oldtown@demo.dropyard.example",
    shopName: "Old Town Precision",
    zip: "92110",
  },
];

export const SEED_LISTINGS: SeedListing[] = [
  {
    id: "ex-01",
    sellerId: "shop-kearny",
    title: "6061-T6 round drops, 1.5 inch",
    material: "aluminum",
    alloy: "6061-T6",
    form: "round",
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
  },
  {
    id: "ex-02",
    sellerId: "shop-mira",
    title: "7075-T651 block, 2 x 3 x 4",
    material: "aluminum",
    alloy: "7075-T651",
    form: "block",
    lengthIn: 4,
    widthIn: 3,
    thicknessIn: 2,
    diameterIn: null,
    quantity: 1,
    weightLbs: 2.4,
    priceCents: 4800,
    zip: "92126",
    notes:
      "One sawed block from a fixture plate. Mill surface, a few vise marks. No certs travel with the drop. Pickup at the Mira Mesa loading dock.",
  },
  {
    id: "ex-03",
    sellerId: "shop-mira",
    title: "6061-T6 plate blanks, half inch",
    material: "aluminum",
    alloy: "6061-T6",
    form: "plate",
    lengthIn: 12,
    widthIn: 6,
    thicknessIn: 0.5,
    diameterIn: null,
    quantity: 4,
    weightLbs: 14,
    priceCents: 4000,
    zip: "92126",
    notes:
      "Four nested blanks left from a chassis job. Edges are sawed, faces are mill. Lot price for all four.",
  },
  {
    id: "ex-04",
    sellerId: "shop-harbor",
    title: "304 sheet, 16 gauge, 2 x 3 feet",
    material: "stainless",
    alloy: "304",
    form: "sheet",
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
  },
  {
    id: "ex-05",
    sellerId: "shop-marine",
    title: "316 tube, 1.5 OD x 0.065 wall",
    material: "stainless",
    alloy: "316",
    form: "tube",
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
  },
  {
    id: "ex-06",
    sellerId: "shop-elcajon",
    title: "1018 cold rolled round, 2 inch",
    material: "steel",
    alloy: "1018",
    form: "round",
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
  },
  {
    id: "ex-07",
    sellerId: "shop-santee",
    title: "A36 plate, 3/8 x 12 x 24",
    material: "steel",
    alloy: "A36",
    form: "plate",
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
  },
  {
    id: "ex-08",
    sellerId: "shop-oceanside",
    title: "Ti-6Al-4V round, 3/4 inch",
    material: "titanium",
    alloy: "Ti-6Al-4V",
    form: "round",
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
  },
  {
    id: "ex-09",
    sellerId: "shop-carlsbad",
    title: "360 brass round, 1 inch",
    material: "brass",
    alloy: "360",
    form: "round",
    diameterIn: 1,
    lengthIn: 14,
    widthIn: null,
    thicknessIn: null,
    quantity: 8,
    weightLbs: 27,
    priceCents: 4200,
    zip: "92008",
    notes:
      "Free-machining 360 brass from a screw machine run. 14-inch remnants, bright finish, no threads cut.",
  },
  {
    id: "ex-10",
    sellerId: "shop-escondido",
    title: "110 copper round, 3/4 inch",
    material: "copper",
    alloy: "110",
    form: "round",
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
  },
  {
    id: "ex-11",
    sellerId: "shop-sorrento",
    title: "Acetal round, 2 inch, free",
    material: "plastic",
    alloy: "Acetal",
    form: "round",
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
  },
  {
    id: "ex-12",
    sellerId: "shop-lemon",
    title: "4130 tube, 1 inch OD x 0.095 wall",
    material: "steel",
    alloy: "4130",
    form: "tube",
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
  },
  {
    id: "ex-13",
    sellerId: "shop-vista",
    title: "2024-T3 sheet, 0.125 x 18 x 24",
    material: "aluminum",
    alloy: "2024-T3",
    form: "sheet",
    thicknessIn: 0.125,
    widthIn: 18,
    lengthIn: 24,
    diameterIn: null,
    quantity: 3,
    weightLbs: 16,
    priceCents: 2200,
    zip: "92083",
    notes:
      "Bare 2024-T3, three sheets. A few layout scratches, no corrosion. Clad was not on this lot.",
  },
  {
    id: "ex-14",
    sellerId: "shop-barrio",
    title: "6061-T6 bar ends, about 1 inch square",
    material: "aluminum",
    alloy: "6061-T6",
    form: "bar",
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
  },
  {
    id: "ex-15",
    sellerId: "shop-oldtown",
    title: "Invar 36 round, 5/8 inch",
    material: "other",
    alloy: "Invar 36",
    form: "round",
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
  },
];
