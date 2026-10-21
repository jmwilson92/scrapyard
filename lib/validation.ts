import {
  canonicalForm,
  defaultSubtype,
  isCategory,
  isSubtypeFor,
  type Category,
  inferMetalType,
  isMaterial,
  isMetalType,
  isReportReason,
  materialForMetalType,
  type DeliveryMode,
  type Material,
  type MetalType,
  type ReportReason,
} from "@/lib/constants";
import type { ListingInput } from "@/lib/types";
import { normalizeZip } from "@/lib/zip";

export type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseListingForm(
  raw: Record<string, FormDataEntryValue | string | undefined>,
  zipExists: (zip: string) => boolean,
): { ok: true; value: ListingInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const title = cleanText(text(raw.title), 80);
  const alloy = cleanText(text(raw.alloy), 40);
  const notes = text(raw.notes).trim().slice(0, 1000);
  const materialRaw = text(raw.material).trim().toLowerCase();
  const metalRaw = text(raw.metalType).trim().toLowerCase();
  const form = canonicalForm(text(raw.form));
  const zip = normalizeZip(text(raw.zip));
  const categoryRaw = text(raw.category).trim().toLowerCase();
  const subtypeRaw = text(raw.subtype).trim().toLowerCase();
  let category: Category = "metal";
  if (!categoryRaw) category = "metal";
  else if (isCategory(categoryRaw)) category = categoryRaw;
  else errors.category = "Choose a category.";
  const isMetal = category === "metal";
  const metal = isMetal
    ? resolveMetal(metalRaw, materialRaw, alloy, errors)
    : { metalType: "other" as MetalType, material: "other" as Material };
  let subtype = isMetal ? (metal?.metalType ?? "other") : defaultSubtype(category);
  if (!isMetal && subtypeRaw) {
    if (isSubtypeFor(category, subtypeRaw)) subtype = subtypeRaw;
    else errors.subtype = "Choose a type.";
  }

  if (title.length < 3) errors.title = "Give the listing a short title.";
  if (isMetal && alloy.length < 1) errors.alloy = "Add an alloy or grade.";
  if (!form) errors.form = "Choose a form.";

  const lengthIn = optionalInches(text(raw.lengthIn), "Length", errors, "lengthIn");
  const widthIn = optionalInches(text(raw.widthIn), "Width", errors, "widthIn");
  const thicknessIn = optionalInches(
    text(raw.thicknessIn),
    "Thickness",
    errors,
    "thicknessIn",
  );
  const diameterIn = optionalInches(
    text(raw.diameterIn),
    "Diameter",
    errors,
    "diameterIn",
  );
  if (
    isMetal &&
    !errors.lengthIn &&
    !errors.widthIn &&
    !errors.thicknessIn &&
    !errors.diameterIn &&
    lengthIn == null &&
    widthIn == null &&
    thicknessIn == null &&
    diameterIn == null
  ) {
    errors.lengthIn = "Add at least one dimension, in inches.";
  }

  const quantity = parseQuantity(text(raw.quantity), errors);
  const weightLbs = optionalWeight(text(raw.weightLbs), errors);
  const priceCents = parsePrice(text(raw.price), text(raw.isFree) === "on", errors);
  const delivery = parseDelivery(raw, errors);
  const certs = isMetal
    ? parseCerts(raw, errors)
    : { available: false, note: "" };

  if (zip.length !== 5) {
    errors.zip = "Enter a 5-digit pickup ZIP code.";
  } else if (!zipExists(zip)) {
    errors.zip = "That ZIP isn't in the US centroid list.";
  }

  if (Object.keys(errors).length > 0 || !metal || !form) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      category,
      subtype,
      material: metal.material,
      metalType: metal.metalType,
      alloy,
      form,
      lengthIn,
      widthIn,
      thicknessIn,
      diameterIn,
      quantity: quantity ?? 1,
      weightLbs,
      priceCents,
      zip,
      notes,
      deliveryMode: delivery.mode,
      deliveryRadiusMiles: delivery.radius,
      deliveryFeeCents: delivery.fee,
      certsAvailable: certs.available,
      certsNote: certs.note,
    },
  };
}

function parseCerts(
  raw: Record<string, FormDataEntryValue | string | undefined>,
  errors: FieldErrors,
): { available: boolean; note: string } {
  const available = text(raw.certsAvailable) === "on" || text(raw.certsAvailable) === "1";
  const note = text(raw.certsNote).trim();
  if (!available) return { available: false, note: "" };
  if (note.length > 300) {
    errors.certsNote = "Keep the cert note under 300 characters.";
    return { available: true, note: "" };
  }
  return { available: true, note };
}

function resolveMetal(
  metalRaw: string,
  materialRaw: string,
  alloy: string,
  errors: FieldErrors,
): { metalType: MetalType; material: Material } | null {
  if (isMetalType(metalRaw)) {
    return { metalType: metalRaw, material: materialForMetalType(metalRaw) };
  }
  if (metalRaw) {
    errors.metalType = "Choose a metal type.";
    return null;
  }
  if (isMaterial(materialRaw)) {
    return {
      metalType: inferMetalType(materialRaw, alloy),
      material: materialRaw,
    };
  }
  errors.material = "Choose a material.";
  errors.metalType = "Choose a metal type.";
  return null;
}

function parseDelivery(
  raw: Record<string, FormDataEntryValue | string | undefined>,
  errors: FieldErrors,
): { mode: DeliveryMode; radius: number | null; fee: number | null } {
  const mode: DeliveryMode = text(raw.deliveryMode) === "delivery" ? "delivery" : "pickup";
  if (mode === "pickup") return { mode, radius: null, fee: null };

  const radiusRaw = text(raw.deliveryRadius).trim();
  let radius: number | null = null;
  if (radiusRaw) {
    const value = Number(radiusRaw);
    if (!Number.isFinite(value) || value < 1 || value > 500) {
      errors.deliveryRadius = "Delivery radius should be between 1 and 500 miles.";
    } else {
      radius = Math.round(value);
    }
  }

  const feeRaw = text(raw.deliveryFee).trim();
  let fee: number | null = null;
  if (feeRaw) {
    const value = Number(feeRaw);
    if (!Number.isFinite(value) || value < 0 || value > 10000) {
      errors.deliveryFee = "Delivery fee should be a dollar amount under $10,000.";
    } else {
      fee = Math.round(value * 100);
    }
  }

  return { mode, radius, fee };
}

export function parseRegisterInput(
  raw: Record<string, string>,
  zipExists: (zip: string) => boolean,
):
  | { ok: true; value: { shopName: string; email: string; password: string; zip: string } }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const shopName = cleanText(raw.shopName ?? "", 80);
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  const zip = normalizeZip(raw.zip ?? "");

  if (shopName.length < 2) errors.shopName = "Enter the shop name.";
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  if (password.length > 72) errors.password = "Passwords stop at 72 characters.";
  if (zip.length !== 5) errors.zip = "Enter a 5-digit shop ZIP code.";
  else if (!zipExists(zip)) errors.zip = "That ZIP isn't in the US centroid list.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { shopName, email, password, zip } };
}

export function parseLoginInput(raw: Record<string, string>):
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  if (!email || !password) {
    errors.form = "Enter your email and password.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password } };
}

export function parseShopUpdate(
  raw: Record<string, string>,
  zipExists: (zip: string) => boolean,
):
  | { ok: true; value: { shopName: string; zip: string } }
  | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const shopName = cleanText(raw.shopName ?? "", 80);
  const zip = normalizeZip(raw.zip ?? "");
  if (shopName.length < 2) errors.shopName = "Enter the shop name.";
  if (zip.length !== 5) errors.zip = "Enter a 5-digit shop ZIP code.";
  else if (!zipExists(zip)) errors.zip = "That ZIP isn't in the US centroid list.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { shopName, zip } };
}

export function parseMessageBody(
  raw: string,
): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.trim();
  if (body.length < 1) return { ok: false, error: "Write a message first." };
  if (body.length > 2000) {
    return { ok: false, error: "Keep the message under 2,000 characters." };
  }
  return { ok: true, body };
}

export function parseReport(
  reasonRaw: string,
  noteRaw: string,
):
  | { ok: true; reason: ReportReason; note: string }
  | { ok: false; error: string } {
  const reason = reasonRaw.trim();
  const note = noteRaw.trim();
  if (!isReportReason(reason)) return { ok: false, error: "Choose a reason." };
  if (note.length > 500) {
    return { ok: false, error: "Keep the note under 500 characters." };
  }
  return { ok: true, reason, note };
}

function text(value: FormDataEntryValue | string | undefined): string {
  return typeof value === "string" ? value : "";
}

function cleanText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function optionalInches(
  raw: string,
  label: string,
  errors: FieldErrors,
  key: string,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    errors[key] = `${label} must be a number of inches.`;
    return null;
  }
  if (value < 0) {
    errors[key] = `${label} can't be negative.`;
    return null;
  }
  if (value === 0) return null;
  if (value > 600) {
    errors[key] = `${label} looks too large.`;
    return null;
  }
  return value;
}

function parseQuantity(raw: string, errors: FieldErrors): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    errors.quantity = "Enter how many pieces are in the lot.";
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    errors.quantity = "Quantity should be a whole number.";
    return null;
  }
  const value = Number(trimmed);
  if (value < 1 || value > 9999) {
    errors.quantity = "Quantity has to be between 1 and 9,999.";
    return null;
  }
  return value;
}

function optionalWeight(raw: string, errors: FieldErrors): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 20000) {
    errors.weightLbs = "Weight should be a positive number of pounds.";
    return null;
  }
  return Math.round(value * 10) / 10;
}

function parsePrice(
  raw: string,
  isFree: boolean,
  errors: FieldErrors,
): number | null {
  if (isFree) return null;
  const trimmed = raw.trim();
  if (!trimmed) {
    errors.price = "Enter a lot price, or mark it free.";
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    errors.price = "Enter a price in dollars.";
    return null;
  }
  if (value > 100000) {
    errors.price = "Listings stay under $100,000.";
    return null;
  }
  if (value === 0) return null;
  return Math.round(value * 100);
}
