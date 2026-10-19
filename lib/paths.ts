export function safeNextPath(
  value: string | undefined | null,
  fallback = "/browse",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  if (value.includes("://")) return fallback;
  return value;
}

export function isSafeId(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,80}$/.test(value);
}
