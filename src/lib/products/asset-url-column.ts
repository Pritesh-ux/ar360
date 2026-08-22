/**
 * Product url columns (model_url, poster, thumbnail_url, qr_url) are sized for
 * storage paths. Inline captures from the editor canvas are megabytes long and
 * overflow them, so they are filtered out before any MySQL write.
 */
export function isInlineAssetUrl(value: unknown): boolean {
  return typeof value === "string" && /^\s*(data:|blob:)/i.test(value);
}

/** NULL keeps the previously stored path through `COALESCE(VALUES(col), col)`. */
export function urlColumnValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || isInlineAssetUrl(trimmed)) return null;
  return trimmed;
}
