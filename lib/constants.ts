export const MATERIALS = [
  { value: "aluminum", label: "Aluminum" },
  { value: "steel", label: "Steel" },
  { value: "stainless", label: "Stainless" },
  { value: "copper", label: "Copper" },
  { value: "brass", label: "Brass" },
  { value: "bronze", label: "Bronze" },
  { value: "titanium", label: "Titanium" },
  { value: "plastic", label: "Plastic" },
  { value: "other", label: "Other" },
] as const;

export const METAL_TYPES = [
  { value: "al-6061", label: "Aluminum 6061", material: "aluminum" },
  { value: "al-7075", label: "Aluminum 7075", material: "aluminum" },
  { value: "al-5052", label: "Aluminum 5052", material: "aluminum" },
  { value: "al-other", label: "Aluminum (other)", material: "aluminum" },
  { value: "mild-steel", label: "Mild steel", material: "steel" },
  { value: "steel-other", label: "Steel (other)", material: "steel" },
  { value: "ss-304", label: "Stainless 304", material: "stainless" },
  { value: "ss-316", label: "Stainless 316", material: "stainless" },
  { value: "ss-other", label: "Stainless (other)", material: "stainless" },
  { value: "copper", label: "Copper", material: "copper" },
  { value: "brass", label: "Brass", material: "brass" },
  { value: "bronze", label: "Bronze", material: "bronze" },
  { value: "titanium", label: "Titanium", material: "titanium" },
  { value: "plastic", label: "Plastic", material: "plastic" },
  { value: "other", label: "Other", material: "other" },
] as const;

export const FORMS = [
  { value: "plate-sheet", label: "Plate / sheet" },
  { value: "bar-round", label: "Bar / round" },
  { value: "tube-pipe", label: "Tube / pipe" },
  { value: "angle-channel", label: "Angle / channel" },
  { value: "scrap-mixed", label: "Scrap / mixed" },
  { value: "lot-bundle", label: "Lot / bundle" },
  { value: "pieces-units", label: "Pieces / units" },
] as const;

export const CATEGORIES = [
  { value: "metal", label: "Metal" },
  { value: "wood", label: "Wood / lumber" },
  { value: "construction", label: "Construction materials" },
  { value: "plastics", label: "Plastics" },
  { value: "glass", label: "Glass" },
  { value: "electrical", label: "Electrical / wire" },
  { value: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];

/** Subtypes for non-metal categories. Metal uses METAL_TYPES instead. */
export const SUBTYPES = [
  { value: "dimensional-lumber", label: "Dimensional lumber", category: "wood" },
  { value: "plywood-sheet", label: "Plywood / sheet goods", category: "wood" },
  { value: "hardwood", label: "Hardwood", category: "wood" },
  { value: "pallets", label: "Pallets / crating", category: "wood" },
  { value: "wood-other", label: "Wood (other)", category: "wood" },
  { value: "drywall", label: "Drywall", category: "construction" },
  { value: "concrete-block", label: "Concrete / block", category: "construction" },
  { value: "brick", label: "Brick / pavers", category: "construction" },
  { value: "tile", label: "Tile / stone", category: "construction" },
  { value: "roofing", label: "Roofing", category: "construction" },
  { value: "insulation", label: "Insulation", category: "construction" },
  { value: "pipe-fittings", label: "Pipe / fittings", category: "construction" },
  { value: "fixtures", label: "Fixtures", category: "construction" },
  { value: "construction-other", label: "Construction (other)", category: "construction" },
  { value: "acrylic", label: "Acrylic", category: "plastics" },
  { value: "polycarbonate", label: "Polycarbonate", category: "plastics" },
  { value: "hdpe-uhmw", label: "HDPE / UHMW", category: "plastics" },
  { value: "delrin-nylon", label: "Delrin / nylon", category: "plastics" },
  { value: "pvc", label: "PVC", category: "plastics" },
  { value: "plastics-other", label: "Plastic (other)", category: "plastics" },
  { value: "flat-glass", label: "Flat / sheet glass", category: "glass" },
  { value: "tempered", label: "Tempered", category: "glass" },
  { value: "windows-mirrors", label: "Windows / mirrors", category: "glass" },
  { value: "glass-other", label: "Glass (other)", category: "glass" },
  { value: "building-wire", label: "Building wire", category: "electrical" },
  { value: "conduit", label: "Conduit", category: "electrical" },
  { value: "boxes-breakers", label: "Boxes / breakers", category: "electrical" },
  { value: "lighting", label: "Lighting", category: "electrical" },
  { value: "electrical-other", label: "Electrical (other)", category: "electrical" },
  { value: "other", label: "Other", category: "other" },
] as const;

export type Subtype = (typeof SUBTYPES)[number]["value"];

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((item) => item.value === value);
}

export function categoryLabel(value: string): string {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

export function isSubtypeFor(category: string, value: string): boolean {
  if (category === "metal") return isMetalType(value);
  return SUBTYPES.some((item) => item.value === value && item.category === category);
}

export function subtypesFor(category: string): readonly { value: string; label: string }[] {
  if (category === "metal") return METAL_TYPES;
  return SUBTYPES.filter((item) => item.category === category);
}

export function subtypeLabel(category: string, value: string): string {
  if (category === "metal") return metalTypeLabel(value);
  return SUBTYPES.find((item) => item.value === value)?.label ?? value;
}

export function defaultSubtype(category: string): string {
  return subtypesFor(category)[0]?.value ?? "other";
}

export const THICKNESS_BUCKETS = [
  { value: "lt-0.125", label: 'Under 1/8"', min: 0, max: 0.125 },
  { value: "0.125-0.25", label: '1/8" – 1/4"', min: 0.125, max: 0.25 },
  { value: "0.25-0.5", label: '1/4" – 1/2"', min: 0.25, max: 0.5 },
  { value: "0.5-1", label: '1/2" – 1"', min: 0.5, max: 1 },
  { value: "gt-1", label: 'Over 1"', min: 1, max: null },
] as const;

export const LENGTH_BUCKETS = [
  { value: "lt-12", label: 'Under 12"', min: 0, max: 12 },
  { value: "12-24", label: '12" – 24"', min: 12, max: 24 },
  { value: "24-48", label: "2 – 4 ft", min: 24, max: 48 },
  { value: "48-96", label: "4 – 8 ft", min: 48, max: 96 },
  { value: "gt-96", label: "Over 8 ft", min: 96, max: null },
] as const;

export const DELIVERY_MODES = [
  { value: "pickup", label: "Buyer pickup only" },
  { value: "delivery", label: "Seller can deliver" },
] as const;

export const REPORT_REASONS = [
  { value: "inaccurate", label: "Material, size, or price looks wrong" },
  { value: "unavailable", label: "Already gone, or not actually for sale" },
  { value: "spam", label: "Spam, or not a remnant listing" },
  { value: "other", label: "Something else" },
] as const;

export const MILES_OPTIONS = [10, 25, 50, 100, 250] as const;

const FORM_ALIASES: Record<string, StockForm> = {
  plate: "plate-sheet",
  sheet: "plate-sheet",
  bar: "bar-round",
  round: "bar-round",
  block: "bar-round",
  tube: "tube-pipe",
  pipe: "tube-pipe",
  angle: "angle-channel",
  channel: "angle-channel",
  scrap: "scrap-mixed",
  mixed: "scrap-mixed",
};

export type Material = (typeof MATERIALS)[number]["value"];
export type MetalType = (typeof METAL_TYPES)[number]["value"];
export type StockForm = (typeof FORMS)[number]["value"];
export type SizeBucket = (typeof THICKNESS_BUCKETS)[number]["value"];
export type DeliveryMode = (typeof DELIVERY_MODES)[number]["value"];
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function isMaterial(value: string): value is Material {
  return MATERIALS.some((item) => item.value === value);
}

export function isMetalType(value: string): value is MetalType {
  return METAL_TYPES.some((item) => item.value === value);
}

export function canonicalForm(value: string): StockForm | null {
  const key = value.trim().toLowerCase();
  if (FORMS.some((item) => item.value === key)) return key as StockForm;
  return FORM_ALIASES[key] ?? null;
}

export function isForm(value: string): boolean {
  return canonicalForm(value) != null;
}

export function isDeliveryMode(value: string): value is DeliveryMode {
  return value === "pickup" || value === "delivery";
}

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((item) => item.value === value);
}

export function materialLabel(value: string): string {
  return MATERIALS.find((item) => item.value === value)?.label ?? value;
}

export function metalTypeLabel(value: string): string {
  return METAL_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function formLabel(value: string): string {
  const canonical = canonicalForm(value);
  return FORMS.find((item) => item.value === canonical)?.label ?? value;
}

export function materialForMetalType(metalType: MetalType): Material {
  const match = METAL_TYPES.find((item) => item.value === metalType);
  return match?.material ?? "other";
}

export function thicknessBucket(value: string) {
  return THICKNESS_BUCKETS.find((item) => item.value === value) ?? null;
}

export function lengthBucket(value: string) {
  return LENGTH_BUCKETS.find((item) => item.value === value) ?? null;
}

export function matchesBucket(
  value: number | null,
  bucket: { min: number; max: number | null },
): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  if (value < bucket.min) return false;
  if (bucket.max == null) return true;
  return value < bucket.max;
}

export function inferMetalType(material: string, alloy: string): MetalType {
  const hay = alloy.toLowerCase();
  const family = material.toLowerCase();
  if (hay.includes("7075")) return "al-7075";
  if (hay.includes("5052")) return "al-5052";
  if (hay.includes("6061")) return "al-6061";
  if (family === "aluminum") return "al-other";
  if (hay.includes("316")) return "ss-316";
  if (hay.includes("304")) return "ss-304";
  if (family === "stainless") return "ss-other";
  if (
    family === "steel" &&
    (hay.includes("1018") || hay.includes("a36") || hay.includes("mild"))
  ) {
    return "mild-steel";
  }
  if (family === "steel") return "steel-other";
  if (family === "copper" || hay.includes("copper")) return "copper";
  if (family === "brass" || hay.includes("brass")) return "brass";
  if (family === "bronze" || hay.includes("bronze")) return "bronze";
  if (family === "titanium" || hay.includes("titanium") || hay.includes("6al-4v")) {
    return "titanium";
  }
  if (family === "plastic") return "plastic";
  return "other";
}
