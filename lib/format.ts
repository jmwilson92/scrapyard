import { canonicalForm } from "@/lib/constants";
import type { ListingInput } from "@/lib/types";

export function formatMoney(cents: number | null): string {
  if (cents == null) return "Free";
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

export function formatInches(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function formatDimensions(item: {
  form: string;
  lengthIn: number | null;
  widthIn: number | null;
  thicknessIn: number | null;
  diameterIn: number | null;
}): string {
  const inch = (value: number | null) =>
    value == null ? null : formatInches(value);
  const form = canonicalForm(item.form) ?? item.form;

  if (form === "tube-pipe") {
    const od = inch(item.diameterIn);
    const wall = inch(item.thicknessIn);
    const length = inch(item.lengthIn);
    return [
      od ? `${od}" OD` : null,
      wall ? `${wall}" wall` : null,
      length ? `${length}" L` : null,
    ]
      .filter(Boolean)
      .join(" × ");
  }

  if (form === "bar-round" && item.diameterIn != null) {
    const diameter = inch(item.diameterIn);
    const length = inch(item.lengthIn);
    return [diameter ? `${diameter}" dia` : null, length ? `${length}" L` : null]
      .filter(Boolean)
      .join(" × ");
  }

  if (item.form === "block") {
    return [item.lengthIn, item.widthIn, item.thicknessIn]
      .filter((value): value is number => value != null)
      .map((value) => `${formatInches(value)}"`)
      .join(" × ");
  }

  const thickness = inch(item.thicknessIn);
  const width = inch(item.widthIn);
  const length = inch(item.lengthIn);
  const diameter = inch(item.diameterIn);
  return [
    thickness ? `${thickness}" thk` : null,
    width ? `${width}" W` : null,
    length ? `${length}" L` : null,
    diameter ? `${diameter}" dia` : null,
  ]
    .filter(Boolean)
    .join(" × ");
}

export function formatDistance(miles: number | null): string | null {
  if (miles == null) return null;
  if (miles < 0.1) return "same ZIP";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatWeight(pounds: number | null): string | null {
  if (pounds == null) return null;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(pounds)} lb`;
}

export function formatQuantity(quantity: number): string {
  return `${quantity} ${quantity === 1 ? "pc" : "pcs"}`;
}

export function formatDelivery(
  item: Pick<ListingInput, "deliveryMode" | "deliveryRadiusMiles" | "deliveryFeeCents">,
): string {
  if (item.deliveryMode !== "delivery") return "Buyer pickup only";
  const parts = ["Seller can deliver"];
  if (item.deliveryRadiusMiles != null) {
    parts.push(`within ${item.deliveryRadiusMiles} mi`);
  }
  if (item.deliveryFeeCents != null) {
    parts.push(
      item.deliveryFeeCents === 0 ? "no delivery fee" : `${formatMoney(item.deliveryFeeCents)} fee`,
    );
  }
  return parts.join(" · ");
}

export function formatWhen(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
