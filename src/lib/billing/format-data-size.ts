/**
 * Client-safe byte formatter (B → KB → MB → GB → TB).
 * Keep free of server-only imports so dashboard / billing UI can use it.
 */
export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const fixed = value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
  return `${fixed} ${units[unit]}`;
}

/** Alias for live usage meters. */
export const formatDataSize = formatBytesShort;

export function formatLimitPair(
  used: number,
  limit: number | null,
  unit: "products" | "bytes" | "qr" | "share" = "products",
): string {
  if (unit === "products") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} products`;
  }
  if (unit === "qr") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} QR codes`;
  }
  if (unit === "share") {
    const limitLabel = limit == null ? "Unlimited" : String(limit);
    return `${used} / ${limitLabel} share links`;
  }
  const usedLabel = formatBytesShort(used);
  const limitLabel = limit == null ? "Unlimited" : formatBytesShort(limit);
  return `${usedLabel} / ${limitLabel}`;
}
