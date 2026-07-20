import fs from "fs";
import path from "path";

/** Public URL prefix — unchanged so existing product.json URLs keep working. */
export const STORAGE_PUBLIC_PREFIX = "/Storage/Customers";

/** Phase 2 protected disk root (outside public/). */
export const DEFAULT_STORAGE_ROOT = path.resolve(process.cwd(), "storage", "Customers");

/** Pre-Phase 2 location served directly from public/. */
export const LEGACY_STORAGE_ROOT = path.resolve(process.cwd(), "public", "Storage", "Customers");

function directoryHasEntries(dir: string): boolean {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolve the on-disk customer storage root.
 * Priority: STORAGE_ROOT env → non-empty storage/Customers → legacy public path → default storage/Customers.
 */
export function resolveStorageRoot(): string {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  if (directoryHasEntries(DEFAULT_STORAGE_ROOT)) {
    return DEFAULT_STORAGE_ROOT;
  }

  if (directoryHasEntries(LEGACY_STORAGE_ROOT)) {
    return LEGACY_STORAGE_ROOT;
  }

  return DEFAULT_STORAGE_ROOT;
}

/** Ensure the active storage root exists (creates storage/Customers on fresh installs). */
export async function ensureStorageRoot(): Promise<string> {
  const root = resolveStorageRoot();
  await fs.promises.mkdir(root, { recursive: true });
  return root;
}
