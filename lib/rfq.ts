/** RFQ and quote rules shared by forms, server actions, and tests. */
import { isCategory, isSubtypeFor, defaultSubtype, type Category } from "@/lib/constants";

export const UNITS = [
  { value: "pcs", label: "pieces" },
  { value: "lbs", label: "lbs" },
  { value: "tons", label: "tons" },
  { value: "sheets", label: "sheets" },
  { value: "bars", label: "bars / sticks" },
  { value: "linear-ft", label: "linear ft" },
  { value: "board-ft", label: "board ft" },
  { value: "sq-ft", label: "sq ft" },
  { value: "pallets", label: "pallets" },
  { value: "lots", label: "lots" },
] as const;

export type Unit = (typeof UNITS)[number]["value"];

export function isUnit(value: string): value is Unit {
  return UNITS.some((unit) => unit.value === value);
}

export function unitLabel(value: string): string {
  return UNITS.find((unit) => unit.value === value)?.label ?? value;
}

export const RFQ_STATUSES = ["open", "awarded", "closed"] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const QUOTE_STATUSES = ["submitted", "accepted", "declined"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type RfqInput = {
  title: string;
  category: Category;
  subtype: string;
  quantity: number;
  unit: Unit;
  specs: string;
  neededBy: string | null;
  deliveryZip: string;
  deliveryLocation: string;
  budgetCents: number | null;
  expiresOn: string;
};

export type QuoteInput = {
  priceCents: number;
  priceBasis: "total" | "per-unit";
  quantity: number;
  leadTimeDays: number;
  notes: string;
  validUntil: string;
};

type Raw = Record<string, FormDataEntryValue | string | undefined>;
type Errors = Record<string, string>;

/** Today's date as YYYY-MM-DD in UTC. */
export function isoDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseRfqForm(
  raw: Raw,
  zipExists: (zip: string) => boolean,
  today = isoDay(),
): { ok: true; value: RfqInput } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const title = clean(raw.title, 100);
  const categoryRaw = clean(raw.category, 30).toLowerCase();
  const subtypeRaw = clean(raw.subtype, 40).toLowerCase();
  const specs = str(raw.specs).trim().slice(0, 4000);
  const deliveryLocation = clean(raw.deliveryLocation, 160);
  const deliveryZip = str(raw.deliveryZip).replace(/\D/g, "").slice(0, 5);
  const unitRaw = clean(raw.unit, 20).toLowerCase();

  if (title.length < 4) errors.title = "Give the RFQ a short, specific title.";
  let category: Category = "metal";
  if (isCategory(categoryRaw)) category = categoryRaw;
  else errors.category = "Choose a material category.";
  let subtype = defaultSubtype(category);
  if (subtypeRaw) {
    if (isSubtypeFor(category, subtypeRaw)) subtype = subtypeRaw;
    else errors.subtype = "Choose a material type.";
  }
  const quantity = positiveNumber(raw.quantity, "quantity", "Enter how much you need.", errors, 1_000_000);
  if (!isUnit(unitRaw)) errors.unit = "Choose a unit.";
  if (specs.length < 10) errors.specs = "Add specs: grade, dimensions, tolerances, finish, certs.";

  const neededByRaw = clean(raw.neededBy, 10);
  let neededBy: string | null = null;
  if (neededByRaw) {
    if (!isValidDay(neededByRaw)) errors.neededBy = "Use a real date.";
    else if (neededByRaw < today) errors.neededBy = "Needed-by date is in the past.";
    else neededBy = neededByRaw;
  }

  if (deliveryZip.length !== 5) errors.deliveryZip = "Enter a 5-digit delivery ZIP.";
  else if (!zipExists(deliveryZip)) errors.deliveryZip = "That ZIP isn't in the US centroid list.";

  let budgetCents: number | null = null;
  const budgetRaw = clean(raw.budget, 12);
  if (budgetRaw) {
    const value = Number(budgetRaw.replace(/[$,]/g, ""));
    if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) {
      errors.budget = "Budget should be a dollar amount.";
    } else budgetCents = Math.round(value * 100);
  }

  const expiresRaw = clean(raw.expiresOn, 10);
  let expiresOn = addDays(today, 14);
  if (expiresRaw) {
    if (!isValidDay(expiresRaw)) errors.expiresOn = "Use a real date.";
    else if (expiresRaw <= today) errors.expiresOn = "Quotes have to be due after today.";
    else if (expiresRaw > addDays(today, 180)) errors.expiresOn = "Keep RFQs open 6 months or less.";
    else expiresOn = expiresRaw;
  }

  if (Object.keys(errors).length > 0 || quantity == null || !isUnit(unitRaw)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      title,
      category,
      subtype,
      quantity,
      unit: unitRaw,
      specs,
      neededBy,
      deliveryZip,
      deliveryLocation,
      budgetCents,
      expiresOn,
    },
  };
}

export function parseQuoteForm(
  raw: Raw,
  today = isoDay(),
): { ok: true; value: QuoteInput } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const priceRaw = clean(raw.price, 14).replace(/[$,]/g, "");
  const basisRaw = clean(raw.priceBasis, 10);
  const notes = str(raw.notes).trim().slice(0, 2000);
  let priceCents = 0;
  const price = Number(priceRaw);
  if (!priceRaw || !Number.isFinite(price) || price <= 0 || price > 10_000_000) {
    errors.price = "Enter your price in dollars.";
  } else priceCents = Math.round(price * 100);
  const priceBasis = basisRaw === "per-unit" ? "per-unit" : basisRaw === "total" ? "total" : null;
  if (!priceBasis) errors.priceBasis = "Choose total or per unit.";
  const quantity = positiveNumber(raw.quantity, "quantity", "Enter the quantity you can supply.", errors, 1_000_000);
  const leadRaw = clean(raw.leadTimeDays, 4);
  let leadTimeDays = 0;
  if (!/^\d+$/.test(leadRaw) || Number(leadRaw) > 365) {
    errors.leadTimeDays = "Lead time in days, 0 to 365.";
  } else leadTimeDays = Number(leadRaw);
  const validRaw = clean(raw.validUntil, 10);
  let validUntil = addDays(today, 14);
  if (validRaw) {
    if (!isValidDay(validRaw)) errors.validUntil = "Use a real date.";
    else if (validRaw < today) errors.validUntil = "Valid-until date is in the past.";
    else validUntil = validRaw;
  }
  if (Object.keys(errors).length > 0 || quantity == null || !priceBasis) return { ok: false, errors };
  return { ok: true, value: { priceCents, priceBasis, quantity, leadTimeDays, notes, validUntil } };
}

/** An RFQ takes new quotes while open and not past its due date. */
export function acceptsQuotes(rfq: { status: string; expiresOn: string }, today = isoDay()): boolean {
  return rfq.status === "open" && rfq.expiresOn >= today;
}

/** Status shown to people: an open RFQ past its due date reads as closed. */
export function displayRfqStatus(rfq: { status: string; expiresOn: string }, today = isoDay()): RfqStatus {
  if (rfq.status === "awarded") return "awarded";
  if (rfq.status === "closed" || rfq.expiresOn < today) return "closed";
  return "open";
}

export function quoteTotalCents(quote: { priceCents: number; priceBasis: string; quantity: number }): number {
  return quote.priceBasis === "per-unit" ? Math.round(quote.priceCents * quote.quantity) : quote.priceCents;
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function positiveNumber(
  value: FormDataEntryValue | string | undefined,
  key: string,
  message: string,
  errors: Errors,
  max: number,
): number | null {
  const raw = clean(value, 14).replace(/,/g, "");
  const num = Number(raw);
  if (!raw || !Number.isFinite(num) || num <= 0 || num > max) {
    errors[key] = message;
    return null;
  }
  return Math.round(num * 1000) / 1000;
}

function str(value: FormDataEntryValue | string | undefined): string {
  return typeof value === "string" ? value : "";
}

function clean(value: FormDataEntryValue | string | undefined, max: number): string {
  return str(value).trim().replace(/\s+/g, " ").slice(0, max);
}
