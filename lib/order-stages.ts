/** Production stages for the order tracker. Separate from payment status. */
export const ORDER_STAGES = [
  { value: "placed", label: "Order placed / Paid", short: "Paid" },
  { value: "sourcing", label: "Materials sourced", short: "Sourced" },
  { value: "production", label: "In production", short: "Production" },
  { value: "quality", label: "Quality check", short: "QC" },
  { value: "ready", label: "Ready to ship", short: "Ready" },
  { value: "shipped", label: "Shipped", short: "Shipped" },
  { value: "delivered", label: "Delivered", short: "Delivered" },
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number]["value"];

export function isOrderStage(value: string): value is OrderStage {
  return ORDER_STAGES.some((stage) => stage.value === value);
}

export function stageIndex(stage: string): number {
  const index = ORDER_STAGES.findIndex((item) => item.value === stage);
  return index < 0 ? 0 : index;
}

export function stageLabel(stage: string): string {
  return ORDER_STAGES[stageIndex(stage)].label;
}

/** Percent of the tracker filled (0 at the first stage, 100 at delivered). */
export function stageProgress(stage: string): number {
  return Math.round((stageIndex(stage) / (ORDER_STAGES.length - 1)) * 100);
}

/**
 * A supplier can post an update for the current stage (a note or photo) or move
 * forward. Updates need a paid order; refunded/unpaid orders are frozen.
 */
export function canPostStage(
  order: { status: string; stage: string },
  next: string,
): { ok: true } | { ok: false; error: string } {
  if (!isOrderStage(next)) return { ok: false, error: "Choose a stage." };
  if (!["paid", "shipped", "completed"].includes(order.status)) {
    return { ok: false, error: "Progress updates start once the order is paid." };
  }
  if (stageIndex(next) < stageIndex(order.stage)) {
    return { ok: false, error: "Stages only move forward. Add a note to explain a setback." };
  }
  return { ok: true };
}

/** Fulfilment status implied by a stage, for the older paid → shipped → completed flow. */
export function statusForStage(stage: OrderStage, current: string): string {
  if (current !== "paid" && current !== "shipped") return current;
  if (stage === "delivered") return "completed";
  if (stage === "shipped") return "shipped";
  return current;
}
