import { categoryLabel, subtypeLabel } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { unitLabel, type RfqInput } from "@/lib/rfq";

export type FieldChange = { field: string; oldValue: string; newValue: string };

export const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  category: "Category",
  subtype: "Material type",
  quantity: "Quantity",
  unit: "Unit",
  specs: "Specs",
  neededBy: "Needed by",
  deliveryZip: "Delivery ZIP",
  deliveryLocation: "Delivery notes",
  budgetCents: "Budget",
  expiresOn: "Quotes due",
  fileAdded: "Drawing added",
  fileReplaced: "Drawing replaced",
  fileRemoved: "Drawing removed",
  nda: "NDA (signers must re-sign)",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Rev A for revision 1, Rev B for 2, … Rev Z, Rev AA. */
export function revLabel(revision: number): string {
  let n = Math.max(1, Math.floor(revision));
  let out = "";
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return `Rev ${out}`;
}

function display(field: keyof RfqInput, rfq: RfqInput): string {
  const value = rfq[field];
  if (field === "budgetCents") return value == null ? "Taking quotes" : formatMoney(value as number);
  if (field === "neededBy") return (value as string | null) ?? "Flexible";
  if (field === "unit") return unitLabel(String(value));
  if (field === "category") return categoryLabel(rfq.category);
  if (field === "subtype") return subtypeLabel(rfq.category, rfq.subtype);
  return value == null ? "" : String(value);
}

const TRACKED: (keyof RfqInput)[] = [
  "title",
  "category",
  "subtype",
  "quantity",
  "unit",
  "specs",
  "neededBy",
  "deliveryZip",
  "deliveryLocation",
  "budgetCents",
  "expiresOn",
];

/** Field-by-field differences between two versions, as display strings. */
export function diffRfq(before: RfqInput, after: RfqInput): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of TRACKED) {
    if ((before[field] ?? null) === (after[field] ?? null)) continue;
    changes.push({ field, oldValue: display(field, before), newValue: display(field, after) });
  }
  return changes;
}

export function summarizeChanges(changes: FieldChange[]): string {
  const names = [...new Set(changes.map((change) => fieldLabel(change.field).toLowerCase()))];
  return names.join(", ");
}
