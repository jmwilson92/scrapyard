export const MATERIALS = [
  { value: "aluminum", label: "Aluminum" },
  { value: "steel", label: "Steel" },
  { value: "stainless", label: "Stainless" },
  { value: "titanium", label: "Titanium" },
  { value: "brass", label: "Brass" },
  { value: "copper", label: "Copper" },
  { value: "plastic", label: "Plastic" },
  { value: "other", label: "Other" },
] as const;

export const FORMS = [
  { value: "bar", label: "Bar" },
  { value: "plate", label: "Plate" },
  { value: "tube", label: "Tube" },
  { value: "sheet", label: "Sheet" },
  { value: "round", label: "Round" },
  { value: "block", label: "Block" },
] as const;

export const REPORT_REASONS = [
  { value: "inaccurate", label: "Material, size, or price looks wrong" },
  { value: "unavailable", label: "Already gone, or not actually for sale" },
  { value: "spam", label: "Spam, or not a remnant listing" },
  { value: "other", label: "Something else" },
] as const;

export const MILES_OPTIONS = [10, 25, 50, 100, 250] as const;

export type Material = (typeof MATERIALS)[number]["value"];
export type StockForm = (typeof FORMS)[number]["value"];
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function isMaterial(value: string): value is Material {
  return MATERIALS.some((item) => item.value === value);
}

export function isForm(value: string): value is StockForm {
  return FORMS.some((item) => item.value === value);
}

export function isReportReason(value: string): value is ReportReason {
  return REPORT_REASONS.some((item) => item.value === value);
}

export function materialLabel(value: string): string {
  return MATERIALS.find((item) => item.value === value)?.label ?? value;
}

export function formLabel(value: string): string {
  return FORMS.find((item) => item.value === value)?.label ?? value;
}
