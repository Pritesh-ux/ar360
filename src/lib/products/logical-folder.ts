/** True when a value is a disk storage path, not a user-facing folder label. */
export function isStoragePathFolder(value?: string | null) {
  const folder = String(value || "").trim().replace(/\\/g, "/");
  if (!folder) return false;
  return (
    folder.startsWith("/Storage/")
    || folder.startsWith("Storage/")
    || /\/Storage\/Customers\//i.test(folder)
    || /\/Customers\/[^/]+\/Products\//i.test(folder)
  );
}

/**
 * Organizational folder label for the products UI ("All", "Furniture", …).
 * Never treat /Storage/Customers/... asset paths as folders.
 */
export function normalizeLogicalProductFolder(value?: string | null) {
  const folder = String(value || "All").trim();
  if (!folder || folder === "All") return "All";
  if (isStoragePathFolder(folder)) return "All";
  return folder;
}

export function resolveLogicalProductFolder(
  json: Record<string, unknown> | null | undefined,
  fallback = "All",
) {
  if (!json) return normalizeLogicalProductFolder(fallback);
  // Prefer explicit org labels; never fall back to publicFolder (disk path).
  return normalizeLogicalProductFolder(String(json.folder || json.productFolder || fallback));
}
