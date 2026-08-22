/**
 * lib/storage.ts
 *
 * Central storage security module for AR360Studio.
 *
 * SECURITY RESPONSIBILITIES:
 *  1. Canonical path resolution — all disk paths are resolved through
 *     getSecureProductPath() which calls path.resolve() and then asserts
 *     the result is still inside STORAGE_ROOT.  Any path-traversal attempt
 *     (e.g. "../../etc/passwd") throws before a single byte is read/written.
 *
 *  2. Customer isolation — every write/read helper requires both customerUid
 *     AND productUid.  Neither value may contain "..", "/", or "\" (enforced
 *     by assertSafeSegment).  A customer can never reach another customer's
 *     folder because the path is always built as:
 *       STORAGE_ROOT / <customerUid> / Products / <productUid> / <fileName>
 *
 *  3. File-type allow-list — only the extensions in ALLOWED_EXTENSIONS are
 *     accepted.  The check is done on the original file name (lower-cased),
 *     not on the MIME type supplied by the browser (which is untrusted).
 *
 *  4. File-size limits — each file type has a maximum byte size defined in
 *     MAX_FILE_SIZES.  The check happens before any disk write.
 *
 *  5. Storage-quota enforcement — after every successful upload the customer's
 *     storage_used_mb column is recalculated from the actual folder size on
 *     disk and written back to MySQL.  This prevents quota drift.
 *
 *  6. Master Admin read-only metadata — getProductFileMeta() lets the admin
 *     panel inspect file names, sizes and modification times without ever
 *     returning file contents or a writable path.
 */

import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { resolveStorageRoot, STORAGE_PUBLIC_PREFIX } from "@/lib/storage/paths";

/** @deprecated Use resolveStorageRoot() — root is resolved dynamically per request. */
export function getStorageRoot() {
  return resolveStorageRoot();
}

/** Public URL prefix that maps to STORAGE_ROOT via the asset proxy. */
export { STORAGE_PUBLIC_PREFIX };

/** File extensions that may be stored.  Checked against the original filename. */
export const ALLOWED_EXTENSIONS = new Set([
  ".glb",
  ".gltf",
  ".usdz",
  ".hdr",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

/** Per-extension maximum upload size in bytes. */
export const MAX_FILE_SIZES: Record<string, number> = {
  ".glb":  2 * 1024 * 1024 * 1024, // 2 GB — allow large authored models
  ".gltf": 2 * 1024 * 1024 * 1024,
  ".usdz": 2 * 1024 * 1024 * 1024,
  ".hdr":  80 * 1024 * 1024,
  ".png":   20 * 1024 * 1024,
  ".jpg":   20 * 1024 * 1024,
  ".jpeg":  20 * 1024 * 1024,
  ".webp":  20 * 1024 * 1024,
};

/** Regex that a safe UID segment must fully match. */
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]{1,180}$/;

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * SECURITY: Validates that a UID segment contains only safe characters.
 * Rejects anything with "..", "/", "\", or non-alphanumeric characters
 * that could be used for path traversal.
 */
function assertSafeSegment(value: string, label: string): void {
  if (!SAFE_SEGMENT_RE.test(value) || value.includes("..")) {
    throw new StorageSecurityError(`Unsafe ${label}: "${value}"`);
  }
}

/**
 * SECURITY: Builds the absolute disk path for a product file and asserts
 * it is still inside STORAGE_ROOT after path.resolve() normalisation.
 * This is the single choke-point that prevents directory traversal.
 */
export function getSecureProductPath(customerUid: string, productUid: string, fileName: string): string {
  // Validate each segment independently before joining
  assertSafeSegment(customerUid, "customerUid");
  assertSafeSegment(productUid, "productUid");

  // fileName may contain a single dot (extension) but must not traverse
  const safeName = path.basename(fileName); // strips any directory component
  if (safeName !== fileName || safeName.includes("..")) {
    throw new StorageSecurityError(`Unsafe fileName: "${fileName}"`);
  }

  const storageRoot = resolveStorageRoot();
  const resolved = path.resolve(storageRoot, customerUid, "Products", productUid, safeName);

  // SECURITY: Final containment check — resolved path must start with storage root
  if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) {
    throw new StorageSecurityError(`Path traversal detected for customer "${customerUid}"`);
  }

  return resolved;
}

/** Returns the absolute path to a customer's product folder. */
export function getSecureProductFolder(customerUid: string, productUid: string): string {
  assertSafeSegment(customerUid, "customerUid");
  assertSafeSegment(productUid, "productUid");

  const storageRoot = resolveStorageRoot();
  const resolved = path.resolve(storageRoot, customerUid, "Products", productUid);

  // SECURITY: Containment check
  if (!resolved.startsWith(storageRoot + path.sep)) {
    throw new StorageSecurityError(`Path traversal detected for customer "${customerUid}"`);
  }

  return resolved;
}

/** Returns the public URL for a stored file (no disk access). */
export function getPublicFileUrl(customerUid: string, productUid: string, fileName: string): string {
  assertSafeSegment(customerUid, "customerUid");
  assertSafeSegment(productUid, "productUid");
  const safeName = path.basename(fileName);
  return `${STORAGE_PUBLIC_PREFIX}/${customerUid}/Products/${productUid}/${safeName}`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export class StorageSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageSecurityError";
  }
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

/**
 * SECURITY: Validates file type and size before any disk write.
 * Throws StorageValidationError with a user-safe message on failure.
 */
export function validateUploadedFile(file: File): void {
  const ext = path.extname(file.name).toLowerCase();

  // SECURITY: Extension allow-list check (not MIME type — browser MIME is untrusted)
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new StorageValidationError(
      `File type "${ext}" is not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`
    );
  }

  const maxBytes = MAX_FILE_SIZES[ext] ?? 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    const maxMB = Math.round(maxBytes / (1024 * 1024));
    throw new StorageValidationError(
      `File "${file.name}" exceeds the ${maxMB} MB limit for ${ext} files.`
    );
  }

  if (file.size === 0) {
    throw new StorageValidationError(`File "${file.name}" is empty.`);
  }
}

// ─── Secure write ─────────────────────────────────────────────────────────────

/**
 * Writes a validated file buffer to the customer-isolated product folder.
 * Returns the public URL (relative path stored in DB — never a blob).
 *
 * SECURITY: Uses getSecureProductPath() which enforces containment.
 */
export async function writeProductFile(input: {
  customerUid: string;
  productUid: string;
  fileName: string;
  data: Buffer;
  /** When true, skip synchronous disk walk (caller should recalc later). */
  deferStorageRecalc?: boolean;
}): Promise<string> {
  const { getStorageAdapter, ensureActiveStorageRoot } = await import("@/lib/storage/adapter");
  await ensureActiveStorageRoot();
  const cdnUrl = await (await getStorageAdapter()).write(input);

  const sizeBytes = input.data.length;
  await query(
    `INSERT INTO product_assets (customer_uid, product_uid, file_path, size_bytes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes), created_at = NOW()`,
    [input.customerUid, input.productUid, input.fileName, sizeBytes]
  ).catch((err) => {
    console.error("[storage] Failed to write product_asset to DB:", err);
  });

  if (!input.deferStorageRecalc) {
    void recalculateCustomerStorage(input.customerUid).catch((err) =>
      console.warn("[storage] Recalculation failed during write:", err),
    );
  }

  return cdnUrl;
}

// ─── Secure delete ────────────────────────────────────────────────────────────

/**
 * A product folder can also exist under the legacy public root. Disk sync scans
 * every root, so any leftover copy would recreate the product row after delete.
 */
async function purgeProductFolderFromAllRoots(customerUid: string, productUid: string): Promise<void> {
  assertSafeSegment(customerUid, "customerUid");
  assertSafeSegment(productUid, "productUid");

  const { getStorageRootsForScan } = await import("@/lib/storage/locate-asset");
  for (const root of getStorageRootsForScan()) {
    const resolved = path.resolve(root, customerUid, "Products", productUid);
    if (!resolved.startsWith(root + path.sep)) continue;
    await fs.rm(resolved, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Deletes an entire product folder from disk.
 * SECURITY: Path is validated through getSecureProductFolder() before deletion.
 */
export async function deleteProductFolder(customerUid: string, productUid: string): Promise<void> {
  const { getStorageAdapter } = await import("@/lib/storage/adapter");
  await (await getStorageAdapter()).deleteProductFolder(customerUid, productUid);
  await purgeProductFolderFromAllRoots(customerUid, productUid);

  await query(
    "DELETE FROM product_assets WHERE customer_uid = ? AND product_uid = ?",
    [customerUid, productUid]
  ).catch((err) => {
    console.error("[storage] Failed to delete product_assets from DB:", err);
  });

  await recalculateCustomerStorage(customerUid).catch((err) =>
    console.warn("[storage] Recalculation failed during delete:", err)
  );
}

// ─── Storage accounting ───────────────────────────────────────────────────────

/**
 * Recalculates the actual disk usage for a customer by walking their folder
 * and updates the storage_used_mb column in MySQL.
 *
 * Called after every upload and delete to keep quota accurate.
 */
export async function recalculateCustomerStorage(customerUid: string): Promise<number> {
  assertSafeSegment(customerUid, "customerUid");

  const storageRoot = resolveStorageRoot();
  const customerFolder = path.resolve(storageRoot, customerUid);
  const productsRoot = path.resolve(customerFolder, "Products");

  // SECURITY: Containment check before walking the filesystem
  if (!customerFolder.startsWith(storageRoot + path.sep)) {
    throw new StorageSecurityError(`Path traversal in storage recalculation for "${customerUid}"`);
  }

  const activeFiles: { productUid: string; fileName: string; sizeBytes: number }[] = [];
  let totalBytes = 0;

  try {
    const productDirs = await fs.readdir(productsRoot, { withFileTypes: true });
    for (const dir of productDirs) {
      if (!dir.isDirectory()) continue;
      const productUid = dir.name;
      if (!SAFE_SEGMENT_RE.test(productUid)) continue;

      const productFolder = path.join(productsRoot, productUid);
      const files = await fs.readdir(productFolder, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile()) continue;
        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;

        try {
          const stat = await fs.stat(path.join(productFolder, file.name));
          activeFiles.push({
            productUid,
            fileName: file.name,
            sizeBytes: stat.size,
          });
          totalBytes += stat.size;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Products or customer folder may not exist yet
  }

  // Database reconciliation
  if (activeFiles.length > 0) {
    for (const file of activeFiles) {
      await query(
        `INSERT INTO product_assets (customer_uid, product_uid, file_path, size_bytes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes)`,
        [customerUid, file.productUid, file.fileName, file.sizeBytes]
      ).catch(() => {});
    }

    const placeholders = activeFiles.map(() => "(?, ?)").join(", ");
    const params: (string | number)[] = [customerUid];
    for (const file of activeFiles) {
      params.push(file.productUid, file.fileName);
    }
    await query(
      `DELETE FROM product_assets 
       WHERE customer_uid = ? 
         AND (product_uid, file_path) NOT IN (${placeholders})`,
      params
    ).catch(() => {});
  } else {
    await query(
      "DELETE FROM product_assets WHERE customer_uid = ?",
      [customerUid]
    ).catch(() => {});
  }

  const usedMB = totalBytes / (1024 * 1024);

  // Update MySQL — only the numeric value, never a path
  await query(
    "UPDATE customers SET storage_used_mb = ? WHERE customer_uid = ?",
    [usedMB, customerUid],
  ).catch((err) => {
    console.warn("[storage] Failed to update storage_used_mb:", err);
  });

  return usedMB;
}

// ─── Admin metadata (read-only) ───────────────────────────────────────────────

export type ProductFileMeta = {
  fileName: string;
  sizeBytes: number;
  sizeMB: number;
  modifiedAt: string;
  publicUrl: string;
};

/**
 * SECURITY: Master Admin read-only file metadata.
 * Returns file names, sizes and modification times — never file contents
 * or absolute disk paths.  Admin cannot write through this function.
 */
export async function getProductFileMeta(
  customerUid: string,
  productUid: string,
): Promise<ProductFileMeta[]> {
  const folderPath = getSecureProductFolder(customerUid, productUid);

  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: ProductFileMeta[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    // Only expose known file types — skip product.json and other metadata
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    try {
      const stat = await fs.stat(path.join(folderPath, entry.name));
      results.push({
        fileName: entry.name,
        sizeBytes: stat.size,
        sizeMB: Number((stat.size / (1024 * 1024)).toFixed(2)),
        modifiedAt: stat.mtime.toISOString(),
        // SECURITY: Public URL only — no absolute disk path exposed
        publicUrl: getPublicFileUrl(customerUid, productUid, entry.name),
      });
    } catch {
      // stat failed — skip
    }
  }

  return results;
}

// ─── Customer folder size summary (for admin panel) ──────────────────────────

export type CustomerStorageSummary = {
  customerUid: string;
  totalFiles: number;
  totalBytes: number;
  totalMB: number;
  products: { productUid: string; files: number; bytes: number }[];
};

/**
 * SECURITY: Admin-only storage summary.
 * Returns aggregate numbers only — no file contents, no absolute paths.
 */
export async function getCustomerStorageSummary(customerUid: string): Promise<CustomerStorageSummary> {
  assertSafeSegment(customerUid, "customerUid");

  const storageRoot = resolveStorageRoot();
  const productsRoot = path.resolve(storageRoot, customerUid, "Products");

  // SECURITY: Containment check
  if (!productsRoot.startsWith(storageRoot + path.sep)) {
    throw new StorageSecurityError(`Path traversal in storage summary for "${customerUid}"`);
  }

  let productDirs: string[] = [];
  try {
    const entries = await fs.readdir(productsRoot, { withFileTypes: true });
    productDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // no products yet
  }

  let totalBytes = 0;
  let totalFiles = 0;
  const products: CustomerStorageSummary["products"] = [];

  for (const productUid of productDirs) {
    if (!SAFE_SEGMENT_RE.test(productUid)) continue; // skip any unexpected dirs

    const productFolder = path.join(productsRoot, productUid);
    let pBytes = 0;
    let pFiles = 0;

    try {
      const files = await fs.readdir(productFolder, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile()) continue;
        try {
          const stat = await fs.stat(path.join(productFolder, f.name));
          pBytes += stat.size;
          pFiles++;
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }

    totalBytes += pBytes;
    totalFiles += pFiles;
    products.push({ productUid, files: pFiles, bytes: pBytes });
  }

  return {
    customerUid,
    totalFiles,
    totalBytes,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    products,
  };
}
