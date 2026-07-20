import { promises as fs } from "fs";
import path from "path";
import { normalizeProductAssetPaths } from "@/lib/storage/path-normalizer";

export type ProductJsonIssue = {
  severity: "critical" | "warning";
  field: string;
  message: string;
};

export type ProductJsonAuditItem = {
  productJsonPath: string;
  customerUid: string;
  productUid: string;
  title?: string;
  issues: ProductJsonIssue[];
  repaired?: boolean;
};

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function auditProductJsonFile(productJsonPath: string, write = false): Promise<ProductJsonAuditItem> {
  const raw = await fs.readFile(productJsonPath, "utf8");
  const product = JSON.parse(raw);
  const productUid = product.productUid || product.id || path.basename(path.dirname(productJsonPath));
  const customerUid = product.customerUid || path.basename(path.dirname(path.dirname(path.dirname(productJsonPath))));
  const productDir = path.dirname(productJsonPath);
  const normalized = normalizeProductAssetPaths({ ...product, productUid, id: product.id || productUid, customerUid });
  const issues: ProductJsonIssue[] = [];

  if (!normalized.productUid) issues.push({ severity: "critical", field: "productUid", message: "Missing productUid." });
  if (!normalized.customerUid) issues.push({ severity: "critical", field: "customerUid", message: "Missing customerUid." });
  if (!normalized.modelUrl) issues.push({ severity: "critical", field: "modelUrl", message: "Missing modelUrl." });
  if (normalized.folderPath && String(normalized.folderPath).includes("\\\\")) issues.push({ severity: "warning", field: "folderPath", message: "Windows folderPath is kept only for server reference; public URLs were normalized." });

  const modelPath = path.join(productDir, "model.glb");
  const posterPath = path.join(productDir, "poster.png");
  const thumbnailPath = path.join(productDir, "thumbnail.png");
  const qrPath = path.join(productDir, "qr.png");

  if (!(await exists(modelPath))) issues.push({ severity: "critical", field: "model.glb", message: "model.glb is missing in product folder." });
  if (!(await exists(posterPath))) issues.push({ severity: "warning", field: "poster.png", message: "poster.png is missing." });
  if (!(await exists(thumbnailPath))) issues.push({ severity: "warning", field: "thumbnail.png", message: "thumbnail.png is missing." });
  if (!(await exists(qrPath))) issues.push({ severity: "warning", field: "qr.png", message: "qr.png is missing." });

  const before = JSON.stringify(product, null, 2);
  const after = JSON.stringify({ ...normalized, updatedAt: normalized.updatedAt || new Date().toISOString() }, null, 2);
  const changed = before !== after;

  if (write && changed) {
    await fs.writeFile(productJsonPath, `${after}\n`, "utf8");
  }

  return {
    productJsonPath,
    customerUid,
    productUid,
    title: normalized.title,
    issues,
    repaired: write && changed,
  };
}
