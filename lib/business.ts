
export const BUSINESS_TYPES = [
  { value: "machine-shop", label: "Machine shop" },
  { value: "fabricator", label: "Fabrication / welding" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "contractor", label: "General contractor" },
  { value: "builder", label: "Builder / remodeler" },
  { value: "cabinet-millwork", label: "Cabinet / millwork shop" },
  { value: "distributor", label: "Distributor / supplier" },
  { value: "recycler", label: "Recycler / scrap yard" },
  { value: "electrical-contractor", label: "Electrical contractor" },
  { value: "other-business", label: "Other business" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export function isBusinessType(value: string): value is BusinessType {
  return BUSINESS_TYPES.some((item) => item.value === value);
}

export function businessTypeLabel(value: string): string {
  return BUSINESS_TYPES.find((item) => item.value === value)?.label ?? "Business";
}

export const LISTING_TYPES = [
  { value: "offer", label: "Selling / offering material" },
  { value: "wanted", label: "Wanted: request for material" },
] as const;

export type ListingType = (typeof LISTING_TYPES)[number]["value"];

export function isListingType(value: string): value is ListingType {
  return value === "offer" || value === "wanted";
}

export type CompanyInput = {
  name: string;
  businessType: BusinessType;
  street: string;
  city: string;
  state: string;
  zip: string;
  serviceRadiusMiles: number | null;
  ein: string;
  website: string;
  contactName: string;
  contactPhone: string;
};

export type Company = CompanyInput & {
  id: string;
  isExample: boolean;
  verified: boolean;
  createdAt: number;
};

/** A company can post and message only once these are filled in. */
export function isProfileComplete(company: {
  name: string;
  businessType: string;
  city: string;
  state: string;
  zip: string;
  contactName: string;
} | null | undefined): boolean {
  if (!company) return false;
  return (
    company.name.trim().length >= 2 &&
    isBusinessType(company.businessType) &&
    company.city.trim().length > 0 &&
    /^[A-Z]{2}$/.test(company.state) &&
    company.zip.length === 5 &&
    company.contactName.trim().length > 0
  );
}

type Raw = Record<string, FormDataEntryValue | string | undefined>;
export type FieldErrors = Record<string, string>;

export function parseCompanyInput(
  raw: Raw,
  zipExists: (zip: string) => boolean,
): { ok: true; value: CompanyInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = clean(raw.companyName, 80);
  const businessType = clean(raw.businessType, 40);
  const street = clean(raw.street, 120);
  const city = clean(raw.city, 60);
  const state = clean(raw.state, 2).toUpperCase();
  const zip = normalizeZip(str(raw.zip));
  const radiusRaw = clean(raw.serviceRadius, 6);
  const einRaw = clean(raw.ein, 12);
  const websiteRaw = clean(raw.website, 200);
  const contactName = clean(raw.contactName, 80);
  const contactPhone = clean(raw.contactPhone, 30);

  if (name.length < 2) errors.companyName = "Enter your company's legal or trade name.";
  if (!isBusinessType(businessType)) errors.businessType = "Choose a business type.";
  if (!city) errors.city = "Enter the city.";
  if (!/^[A-Z]{2}$/.test(state)) errors.state = "Use the 2-letter state code.";
  if (zip.length !== 5) errors.zip = "Enter a 5-digit business ZIP code.";
  else if (!zipExists(zip)) errors.zip = "That ZIP isn't in the US centroid list.";
  if (!contactName) errors.contactName = "Who should other businesses contact?";

  let serviceRadiusMiles: number | null = null;
  if (radiusRaw) {
    const value = Number(radiusRaw);
    if (!Number.isFinite(value) || value <= 0 || value > 3000) {
      errors.serviceRadius = "Service area should be 1 to 3,000 miles.";
    } else serviceRadiusMiles = Math.round(value);
  }

  const ein = normalizeEin(einRaw);
  if (einRaw && ein == null) errors.ein = "EIN looks like 12-3456789.";

  const website = normalizeWebsite(websiteRaw);
  if (websiteRaw && website == null) errors.website = "Enter a website like example.com.";

  if (contactPhone && !/^[0-9+().\-\s]{7,30}$/.test(contactPhone)) {
    errors.contactPhone = "Enter a phone number.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      businessType: businessType as BusinessType,
      street,
      city,
      state,
      zip,
      serviceRadiusMiles,
      ein: ein ?? "",
      website: website ?? "",
      contactName,
      contactPhone,
    },
  };
}

export function normalizeEin(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Last 4 of an EIN for public display; the full number is never shown. */
export function maskEin(ein: string): string {
  return ein ? `••-•••${ein.slice(-4)}` : "";
}

function normalizeZip(input: string): string {
  return input.replace(/\D/g, "").slice(0, 5);
}

function str(value: FormDataEntryValue | string | undefined): string {
  return typeof value === "string" ? value : "";
}

function clean(value: FormDataEntryValue | string | undefined, max: number): string {
  return str(value).trim().replace(/\s+/g, " ").slice(0, max);
}
