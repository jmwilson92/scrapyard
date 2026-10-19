import { describe, expect, it } from "vitest";
import { haversineMiles } from "@/lib/geo";
import { SEED_LISTINGS } from "@/lib/seed-data";
import { parseSearchQuery, searchListings, type SearchableListing } from "@/lib/search";
import { lookupZip, parseZipCsv } from "@/lib/zip";

const points: Record<string, { lat: number; lng: number }> = {
  "92101": { lat: 32.7157, lng: -117.1611 },
  "92111": { lat: 32.797, lng: -117.17 },
  "92054": { lat: 33.2, lng: -117.38 },
};

function listing(
  overrides: Partial<SearchableListing> & Pick<SearchableListing, "id">,
): SearchableListing {
  return {
    material: "aluminum",
    alloy: "6061-T6",
    form: "round",
    priceCents: 1000,
    zip: "92111",
    status: "active",
    createdAt: 1,
    ...overrides,
  };
}

describe("haversineMiles", () => {
  it("is zero for the same point", () => {
    expect(haversineMiles(points["92101"], points["92101"])).toBe(0);
  });

  it("puts Los Angeles a bit over 100 miles from downtown San Diego", () => {
    const sanDiego = lookupZip("92101");
    const losAngeles = lookupZip("90012");
    expect(sanDiego).not.toBeNull();
    expect(losAngeles).not.toBeNull();
    const miles = haversineMiles(sanDiego!, losAngeles!);
    expect(miles).toBeGreaterThan(100);
    expect(miles).toBeLessThan(140);
  });
});

describe("parseZipCsv", () => {
  it("keeps quoted city names", () => {
    const index = parseZipCsv('zip,lat,lng,city,state\n12345,1,2,"Foo, Bar",ZZ\n');
    expect(index.get("12345")).toEqual({
      lat: 1,
      lng: 2,
      city: "Foo, Bar",
      state: "ZZ",
    });
  });
});

describe("searchListings", () => {
  const rows = [
    listing({ id: "near", zip: "92111", priceCents: 3600, createdAt: 2 }),
    listing({
      id: "far",
      zip: "92054",
      material: "titanium",
      alloy: "Ti-6Al-4V",
      form: "round",
      priceCents: 14000,
      createdAt: 3,
    }),
    listing({
      id: "free",
      zip: "92111",
      priceCents: null,
      alloy: "Acetal",
      material: "plastic",
      form: "round",
      createdAt: 4,
    }),
    listing({
      id: "sold",
      zip: "92111",
      status: "sold",
      alloy: "304",
      material: "stainless",
      form: "sheet",
      createdAt: 5,
    }),
    listing({
      id: "tube",
      zip: "92111",
      form: "tube",
      alloy: "4130",
      material: "steel",
      priceCents: 4500,
      createdAt: 1,
    }),
  ];

  it("filters material, alloy, form, price, free, sold, and distance", () => {
    const aluminum = searchListings(
      rows,
      parseSearchQuery({ material: "aluminum", zip: "92101", miles: "20" }),
      (zip) => points[zip] ?? null,
    );
    expect(aluminum.ok).toBe(true);
    if (!aluminum.ok) return;
    expect(aluminum.results.map((row) => row.id)).toEqual(["near"]);

    const grade = searchListings(
      rows,
      parseSearchQuery({ alloy: "t6", zip: "92101", miles: "any" }),
      (zip) => points[zip] ?? null,
    );
    expect(grade.ok && grade.results.map((row) => row.id)).toEqual(["near"]);

    const tubes = searchListings(
      rows,
      parseSearchQuery({ form: "tube" }),
      (zip) => points[zip] ?? null,
    );
    expect(tubes.ok && tubes.results.map((row) => row.id)).toEqual(["tube"]);

    const capped = searchListings(
      rows,
      parseSearchQuery({ max: "40", zip: "92101", miles: "any" }),
      (zip) => points[zip] ?? null,
    );
    expect(capped.ok && capped.results.map((row) => row.id).sort()).toEqual([
      "free",
      "near",
    ]);

    const paidOnly = searchListings(
      rows,
      parseSearchQuery({ free: "0", zip: "92101", miles: "any" }),
      (zip) => points[zip] ?? null,
    );
    expect(paidOnly.ok && paidOnly.results.some((row) => row.id === "free")).toBe(
      false,
    );

    const active = searchListings(rows, parseSearchQuery({}), () => null);
    expect(active.ok && active.results.some((row) => row.id === "sold")).toBe(false);
  });

  it("rejects an unknown origin ZIP", () => {
    const found = searchListings(
      rows,
      parseSearchQuery({ zip: "00000" }),
      () => null,
    );
    expect(found).toEqual({ ok: false, error: "unknown_zip" });
  });

  it("sorts real San Diego seed drops by distance from downtown", () => {
    const searchable = SEED_LISTINGS.map((row, index) => ({
      ...row,
      status: "active",
      createdAt: index,
    }));
    const found = searchListings(
      searchable,
      parseSearchQuery({ zip: "92101", miles: "20" }),
      (zip) => lookupZip(zip),
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    const ids = found.results.map((row) => row.id);
    expect(ids).toContain("ex-01");
    expect(ids).toContain("ex-14");
    expect(ids).not.toContain("ex-08");
    const miles = found.results.map((row) => row.distanceMiles ?? 999);
    expect([...miles].sort((a, b) => a - b)).toEqual(miles);
  });
});
