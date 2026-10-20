import { describe, expect, it } from "vitest";
import { SEED_LISTINGS } from "@/lib/seed-data";
import { parseSearchQuery, searchListings, type SearchableListing } from "@/lib/search";
import { buildShopPins } from "@/lib/shops";

const points: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  "92101": { lat: 32.7157, lng: -117.1611, city: "San Diego", state: "CA" },
  "92111": { lat: 32.797, lng: -117.17, city: "San Diego", state: "CA" },
  "91910": { lat: 32.64, lng: -117.08, city: "Chula Vista", state: "CA" },
  "92054": { lat: 33.2, lng: -117.38, city: "Oceanside", state: "CA" },
};

function listing(
  overrides: Partial<SearchableListing> & Pick<SearchableListing, "id">,
): SearchableListing {
  return {
    material: "aluminum",
    metalType: "al-6061",
    alloy: "6061-T6",
    form: "bar-round",
    title: "6061 round drops",
    shopName: "Kearny Mesa Tool & Die",
    notes: "Saw cut.",
    priceCents: 3600,
    zip: "92111",
    status: "active",
    createdAt: 1,
    thicknessIn: null,
    lengthIn: 24,
    diameterIn: null,
    widthIn: null,
    deliveryMode: "pickup",
    certsAvailable: false,
    ...overrides,
  };
}

const rows = [
  listing({ id: "al-6061", thicknessIn: null, diameterIn: 1.5, lengthIn: 24 }),
  listing({
    id: "al-7075",
    metalType: "al-7075",
    alloy: "7075-T651",
    material: "aluminum",
    title: "7075 block",
    thicknessIn: 2,
    diameterIn: null,
    lengthIn: 4,
    priceCents: 4800,
    createdAt: 2,
  }),
  listing({
    id: "al-5052",
    metalType: "al-5052",
    alloy: "5052-H32",
    material: "aluminum",
    form: "plate-sheet",
    title: "5052 sheet",
    thicknessIn: 0.125,
    diameterIn: null,
    lengthIn: 24,
    priceCents: 2200,
    deliveryMode: "delivery",
    certsAvailable: true,
    createdAt: 3,
  }),
  listing({
    id: "mild",
    metalType: "mild-steel",
    material: "steel",
    alloy: "A36",
    form: "angle-channel",
    title: "A36 angle",
    thicknessIn: 0.25,
    diameterIn: null,
    lengthIn: 72,
    priceCents: 6400,
    deliveryMode: "delivery",
    zip: "91910",
    createdAt: 4,
  }),
  listing({
    id: "ss-304",
    metalType: "ss-304",
    material: "stainless",
    alloy: "304",
    form: "sheet",
    title: "304 sheet",
    thicknessIn: 0.06,
    diameterIn: null,
    lengthIn: 36,
    priceCents: 4800,
    createdAt: 5,
  }),
  listing({
    id: "ss-316",
    metalType: "ss-316",
    material: "stainless",
    alloy: "316",
    form: "tube",
    title: "316 tube",
    thicknessIn: 0.065,
    diameterIn: 1.5,
    lengthIn: 48,
    priceCents: 7000,
    deliveryMode: "delivery",
    createdAt: 6,
  }),
  listing({
    id: "copper",
    metalType: "copper",
    material: "copper",
    alloy: "110",
    title: "110 copper round",
    diameterIn: 0.75,
    lengthIn: 12,
    priceCents: 3600,
    createdAt: 7,
  }),
  listing({
    id: "brass",
    metalType: "brass",
    material: "brass",
    alloy: "360",
    title: "360 brass",
    diameterIn: 1,
    priceCents: 4200,
    createdAt: 8,
  }),
  listing({
    id: "bronze",
    metalType: "bronze",
    material: "bronze",
    alloy: "932",
    title: "932 bronze",
    diameterIn: 1.25,
    priceCents: 7800,
    createdAt: 9,
  }),
  listing({
    id: "titanium",
    metalType: "titanium",
    material: "titanium",
    alloy: "Ti-6Al-4V",
    title: "titanium round",
    diameterIn: 0.75,
    priceCents: 14000,
    zip: "92054",
    createdAt: 10,
  }),
  listing({
    id: "scrap",
    form: "scrap-mixed",
    title: "mixed 6061 ends",
    priceCents: null,
    thicknessIn: 1,
    lengthIn: 6,
    createdAt: 11,
  }),
  listing({
    id: "sold-delivery",
    status: "sold",
    deliveryMode: "delivery",
    metalType: "copper",
    material: "copper",
    createdAt: 12,
  }),
];

function ids(params: Record<string, string>) {
  const found = searchListings(rows, parseSearchQuery(params), (zip) => points[zip] ?? null);
  expect(found.ok).toBe(true);
  if (!found.ok) return [];
  return found.results.map((row) => row.id);
}

describe("listing filters", () => {
  it("filters metal type, including alloy families and other metals", () => {
    expect(ids({ metal: "al-6061" }).sort()).toEqual(["al-6061", "scrap"]);
    expect(ids({ metal: "al-7075" })).toEqual(["al-7075"]);
    expect(ids({ metal: "al-5052" })).toEqual(["al-5052"]);
    expect(ids({ metal: "mild-steel" })).toEqual(["mild"]);
    expect(ids({ metal: "ss-304" })).toEqual(["ss-304"]);
    expect(ids({ metal: "ss-316" })).toEqual(["ss-316"]);
    expect(ids({ metal: "copper" })).toEqual(["copper"]);
    expect(ids({ metal: "brass" })).toEqual(["brass"]);
    expect(ids({ metal: "bronze" })).toEqual(["bronze"]);
    expect(ids({ metal: "titanium" })).toEqual(["titanium"]);
    expect(ids({ material: "aluminum" }).sort()).toEqual([
      "al-5052",
      "al-6061",
      "al-7075",
      "scrap",
    ]);
  });

  it("treats legacy form names as the grouped forms", () => {
    expect(ids({ form: "sheet" }).sort()).toEqual(["al-5052", "ss-304"]);
    expect(ids({ form: "plate-sheet" }).sort()).toEqual(["al-5052", "ss-304"]);
    expect(ids({ form: "tube" })).toEqual(["ss-316"]);
    expect(ids({ form: "tube-pipe" })).toEqual(["ss-316"]);
    expect(ids({ form: "angle-channel" })).toEqual(["mild"]);
    expect(ids({ form: "scrap-mixed" })).toEqual(["scrap"]);
    expect(ids({ form: "round" })).toContain("brass");
    expect(ids({ form: "round" })).not.toContain("ss-316");
  });

  it("filters thickness and length buckets", () => {
    expect(ids({ thickness: "lt-0.125" }).sort()).toEqual(["ss-304", "ss-316"]);
    expect(ids({ thickness: "0.125-0.25" })).toEqual(["al-5052"]);
    expect(ids({ thickness: "0.25-0.5" })).toEqual(["mild"]);
    expect(ids({ thickness: "gt-1" }).sort()).toEqual([
      "al-6061",
      "al-7075",
      "brass",
      "bronze",
      "scrap",
    ]);
    expect(ids({ length: "lt-12" }).sort()).toEqual(["al-7075", "scrap"]);
    expect(ids({ length: "12-24" })).toEqual(["copper"]);
    expect(ids({ length: "24-48" }).sort()).toEqual([
      "al-5052",
      "al-6061",
      "brass",
      "bronze",
      "ss-304",
      "titanium",
    ]);
    expect(ids({ length: "48-96" }).sort()).toEqual(["mild", "ss-316"]);
  });

  it("filters price, distance, and delivery together", () => {
    expect(ids({ max: "40", zip: "92101", miles: "any" })).toContain("scrap");
    expect(ids({ max: "40", zip: "92101", miles: "any" })).not.toContain("titanium");
    expect(ids({ zip: "92101", miles: "20" })).not.toContain("titanium");
    expect(ids({ delivery: "1" }).sort()).toEqual(["al-5052", "mild", "ss-316"]);
    expect(ids({ certs: "1" })).toEqual(["al-5052"]);
    expect(ids({ certs: "1", delivery: "1" })).toEqual(["al-5052"]);
    expect(
      ids({
        metal: "ss-316",
        form: "tube-pipe",
        delivery: "1",
        max: "80",
        thickness: "lt-0.125",
        length: "48-96",
      }),
    ).toEqual(["ss-316"]);
  });

  it("matches a keyword across title, alloy, and shop", () => {
    expect(ids({ q: "7075" })).toEqual(["al-7075"]);
    expect(ids({ q: "kearny angle" })).toEqual(["mild"]);
    expect(ids({ q: "saw" })).toContain("al-6061");
  });

  it("covers the seeded metal types, forms, and delivery choices", () => {
    const metals = new Set(SEED_LISTINGS.map((row) => row.metalType));
    for (const metal of [
      "al-6061",
      "al-7075",
      "al-5052",
      "mild-steel",
      "ss-304",
      "ss-316",
      "copper",
      "brass",
      "bronze",
      "titanium",
      "other",
    ]) {
      expect(metals.has(metal as never)).toBe(true);
    }
    const forms = new Set(SEED_LISTINGS.map((row) => row.form));
    for (const form of [
      "plate-sheet",
      "bar-round",
      "tube-pipe",
      "angle-channel",
      "scrap-mixed",
    ]) {
      expect(forms.has(form as never)).toBe(true);
    }
    expect(SEED_LISTINGS.some((row) => row.deliveryMode === "delivery")).toBe(true);
    expect(SEED_LISTINGS.some((row) => row.deliveryMode === "pickup")).toBe(true);
  });
});

describe("buildShopPins", () => {
  it("counts active listings and separates shops that share a ZIP", () => {
    const pins = buildShopPins(
      [
        {
          sellerId: "a",
          shopName: "Shop A",
          zip: "92111",
          shopZip: "92111",
          status: "active",
        },
        {
          sellerId: "a",
          shopName: "Shop A",
          zip: "92111",
          shopZip: "92111",
          status: "active",
        },
        {
          sellerId: "a",
          shopName: "Shop A",
          zip: "92111",
          shopZip: "92111",
          status: "sold",
        },
        {
          sellerId: "b",
          shopName: "Shop B",
          zip: "92111",
          shopZip: "92111",
          status: "active",
        },
      ],
      (zip) => points[zip] ?? null,
    );
    expect(pins).toHaveLength(2);
    const shopA = pins.find((pin) => pin.sellerId === "a");
    const shopB = pins.find((pin) => pin.sellerId === "b");
    expect(shopA?.count).toBe(2);
    expect(shopB?.count).toBe(1);
    expect(shopA?.lat).not.toBe(shopB?.lat);
    expect(shopA?.city).toBe("San Diego");
  });
});
