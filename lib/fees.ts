/**
 * Pure fee math for Skrappily checkouts. Amounts are integer cents.
 *
 * Destination charges: the buyer pays `totalCents` on the platform account,
 * Stripe deducts its processing fee from the platform balance, and the seller
 * receives `totalCents - applicationFeeCents` (= `sellerPayoutCents`).
 */
export type FeeConfig = {
  /** Skrappily's cut, in percent of the sale price. Default 1. */
  platformFeePercent: number;
  /** When true (default), the buyer's total is grossed up to cover card costs. */
  passThroughCardFees: boolean;
  /** Stripe's card rate, in percent. Default 2.9. */
  cardFeePercent: number;
  /** Stripe's fixed per-charge fee, in cents. Default 30. */
  cardFeeFixedCents: number;
};

export type FeeBreakdown = {
  baseCents: number;
  platformFeeCents: number;
  /** Card processing fee shown to the buyer (0 unless pass-through is on). */
  cardFeeCents: number;
  totalCents: number;
  applicationFeeCents: number;
  sellerPayoutCents: number;
  /** Estimated Stripe processing cost on the total, paid by the platform. */
  estimatedStripeCostCents: number;
  /** Estimated platform margin after Stripe's cost (can be negative). */
  estimatedNetCents: number;
};

export const DEFAULT_FEES: FeeConfig = {
  platformFeePercent: 1,
  passThroughCardFees: true,
  cardFeePercent: 2.9,
  cardFeeFixedCents: 30,
};

export function feeConfigFromEnv(env: Record<string, string | undefined>): FeeConfig {
  const pass = env.STRIPE_PASS_THROUGH_CARD_FEES?.trim().toLowerCase();
  return {
    platformFeePercent: pct(env.PLATFORM_FEE_PERCENT, DEFAULT_FEES.platformFeePercent),
    passThroughCardFees: pass === "false" || pass === "0" ? false : DEFAULT_FEES.passThroughCardFees,
    cardFeePercent: pct(env.STRIPE_CARD_FEE_PERCENT, DEFAULT_FEES.cardFeePercent),
    cardFeeFixedCents: cents(env.STRIPE_CARD_FEE_FIXED_CENTS, DEFAULT_FEES.cardFeeFixedCents),
  };
}

export function computeFees(baseCents: number, config: FeeConfig = DEFAULT_FEES): FeeBreakdown {
  if (!Number.isInteger(baseCents) || baseCents <= 0) {
    throw new Error("Sale amount must be a positive whole number of cents.");
  }
  const platformFeeCents = Math.round((baseCents * config.platformFeePercent) / 100);
  const rate = config.cardFeePercent / 100;
  let totalCents = baseCents;
  let cardFeeCents = 0;
  let sellerPayoutCents = baseCents - platformFeeCents;
  if (config.passThroughCardFees) {
    // Gross up: after Stripe takes rate*total + fixed, the seller still nets
    // (base - platform fee) and the platform keeps its full fee.
    totalCents = Math.ceil((baseCents + config.cardFeeFixedCents) / (1 - rate));
    cardFeeCents = totalCents - baseCents;
    sellerPayoutCents = baseCents - platformFeeCents;
  }
  const applicationFeeCents = totalCents - sellerPayoutCents;
  const estimatedStripeCostCents = Math.round(totalCents * rate) + config.cardFeeFixedCents;
  return {
    baseCents,
    platformFeeCents,
    cardFeeCents,
    totalCents,
    applicationFeeCents,
    sellerPayoutCents,
    estimatedStripeCostCents,
    estimatedNetCents: applicationFeeCents - estimatedStripeCostCents,
  };
}

function pct(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n < 50 ? n : fallback;
}

function cents(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < 1000 ? n : fallback;
}
