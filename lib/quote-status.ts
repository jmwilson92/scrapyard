/** What a supplier sees for one of its quotes. */
export const SUPPLIER_QUOTE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "expired", label: "Expired" },
  { value: "rfq-closed", label: "RFQ closed" },
] as const;

export type SupplierQuoteStatus = (typeof SUPPLIER_QUOTE_STATUSES)[number]["value"];

export function isSupplierQuoteStatus(value: string): value is SupplierQuoteStatus {
  return SUPPLIER_QUOTE_STATUSES.some((item) => item.value === value);
}

export function supplierQuoteStatus(
  quote: { status: string; validUntil: string },
  rfq: { status: string; expiresOn: string },
  today: string,
): SupplierQuoteStatus {
  if (quote.status === "accepted") return "accepted";
  if (quote.status === "declined") return "declined";
  if (quote.status === "withdrawn") return "withdrawn";
  if (rfq.status === "closed" || rfq.status === "awarded") return "rfq-closed";
  if (rfq.expiresOn < today || (quote.validUntil && quote.validUntil < today)) return "expired";
  return "pending";
}

export function supplierQuoteLabel(status: SupplierQuoteStatus): string {
  return SUPPLIER_QUOTE_STATUSES.find((item) => item.value === status)?.label ?? status;
}
