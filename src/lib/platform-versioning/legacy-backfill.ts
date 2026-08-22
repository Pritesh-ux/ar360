/**
 * Phase 1 helpers for legacy revision asset references.
 * Read-only against existing revisions (immutability). Does not copy GLB bytes.
 */

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { getProductFolder } from "@/lib/localCustomerStorage";
import {
  type Ar360AssetFileRef,
  buildLegacyAssetRefs,
  decideLegacyRevisionBackfill,
  type LegacyProductRowForRevision,
} from "@/lib/platform-versioning/foundation";

const DISK_HINTS: Array<{ role: Ar360AssetFileRef["role"]; name: string }> = [
  { role: "model", name: "model.glb" },
  { role: "modelArLite", name: "model.ar.glb" },
  { role: "usdz", name: "model.usdz" },
  { role: "poster", name: "poster.png" },
  { role: "thumbnail", name: "thumbnail.png" },
];

async function hashFileSha256(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    return createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

/** Inspect product folder for asset references (no writes, no GLB duplication). */
export async function collectProductDiskAssetRefs(
  customerUid: string,
  productUid: string,
): Promise<Ar360AssetFileRef[]> {
  const folder = getProductFolder(customerUid, productUid);
  const out: Ar360AssetFileRef[] = [];

  for (const hint of DISK_HINTS) {
    const filePath = path.join(folder, hint.name);
    try {
      const st = await fs.stat(filePath);
      if (!st.isFile()) continue;
      const shouldHash =
        st.size <= 5 * 1024 * 1024 && hint.role !== "model" && hint.role !== "modelArLite";
      out.push({
        role: hint.role,
        path: hint.name,
        hint: hint.name,
        sizeBytes: st.size,
        mtimeMs: st.mtimeMs,
        exists: true,
        contentHash: shouldHash ? await hashFileSha256(filePath) : null,
      });
    } catch {
      out.push({
        role: hint.role,
        path: hint.name,
        hint: hint.name,
        exists: false,
      });
    }
  }

  return out;
}

/** Build asset_refs for a brand-new revision insert (never mutates prior revisions). */
export async function buildLegacyAssetRefsWithDisk(
  product: LegacyProductRowForRevision,
): Promise<ReturnType<typeof buildLegacyAssetRefs>> {
  const customerUid = String(product.customer_uid || "").trim();
  if (!customerUid) {
    return buildLegacyAssetRefs(product);
  }
  const diskFiles = await collectProductDiskAssetRefs(customerUid, product.id);
  return buildLegacyAssetRefs(product, diskFiles);
}

export type PointerBackfillStats = {
  productsConsidered: number;
  wouldInsert: number;
  skipped: number;
};

/** Dry-run helper — does not write. */
export function summarizeBackfillDecisions(
  products: Array<{
    productUid: string;
    hasRevision1: boolean;
    hasActiveConfigPointer: boolean;
  }>,
): PointerBackfillStats {
  let wouldInsert = 0;
  let skipped = 0;
  for (const p of products) {
    const d = decideLegacyRevisionBackfill(p);
    if (d.action === "insert") wouldInsert += 1;
    else skipped += 1;
  }
  return {
    productsConsidered: products.length,
    wouldInsert,
    skipped,
  };
}

export { decideLegacyRevisionBackfill };
