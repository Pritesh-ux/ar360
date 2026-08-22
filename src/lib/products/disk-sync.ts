import fs from "fs/promises";
import path from "path";
import { ensureProductSchema, query } from "@/lib/db";
import { resolveLogicalProductFolder } from "@/lib/products/logical-folder";
import { urlColumnValue } from "@/lib/products/asset-url-column";
import { getStorageRootsForScan } from "@/lib/storage/locate-asset";

export type DiskProductRecord = {
  customerUid: string;
  productUid: string;
  json: Record<string, unknown>;
};

async function readProductJsonFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function scanAllProductsFromDisk(): Promise<DiskProductRecord[]> {
  const results: DiskProductRecord[] = [];
  const seen = new Set<string>();

  for (const root of getStorageRootsForScan()) {
    let customerEntries;
    try {
      customerEntries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const customer of customerEntries) {
      if (!customer.isDirectory()) continue;

      const customerUid = customer.name;
      const productsDir = path.join(root, customerUid, "Products");

      let productEntries;
      try {
        productEntries = await fs.readdir(productsDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const product of productEntries) {
        if (!product.isDirectory()) continue;

        const productUid = product.name;
        const dedupeKey = `${customerUid}:${productUid}`;
        if (seen.has(dedupeKey)) continue;

        const jsonPath = path.join(productsDir, productUid, "product.json");
        const json = await readProductJsonFile(jsonPath);
        if (!json) continue;

        seen.add(dedupeKey);
        results.push({
          customerUid: String(json.customerUid || customerUid),
          productUid: String(json.productUid || json.id || productUid),
          json,
        });
      }
    }
  }

  return results;
}

export async function scanCustomerProductsFromDisk(customerUid: string) {
  const results: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const root of getStorageRootsForScan()) {
    const productsDir = path.join(root, customerUid, "Products");

    try {
      const entries = await fs.readdir(productsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const productUid = entry.name;
        if (seen.has(productUid)) continue;

        const json = await readProductJsonFile(
          path.join(productsDir, productUid, "product.json"),
        );
        if (!json) continue;

        seen.add(productUid);
        results.push(json);
      }
    } catch {
      continue;
    }
  }

  return results;
}

async function knownCustomerUids(): Promise<Set<string>> {
  const rows = await query<{ customer_uid: string | null }>(
    "SELECT customer_uid FROM customers WHERE status <> 'Deleted'",
  ).catch(() => []);
  return new Set(rows.map((row) => String(row.customer_uid || "")).filter(Boolean));
}

export async function syncProductJsonToMysql(record: DiskProductRecord) {
  const { customerUid, productUid, json } = record;
  if (!customerUid || !productUid) return;

  await ensureProductSchema();

  await query(
    `INSERT INTO products
       (id, customer_uid, user_id, title, category, model_url, file_name,
        poster, thumbnail_url, qr_url, product_folder, status, views,
        settings, material_settings, variants, hotspots, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       COALESCE(?, NOW()), COALESCE(?, NOW()))
     ON DUPLICATE KEY UPDATE
       customer_uid      = VALUES(customer_uid),
       title             = VALUES(title),
       category          = VALUES(category),
       model_url         = COALESCE(VALUES(model_url), model_url),
       file_name         = COALESCE(VALUES(file_name), file_name),
       poster            = COALESCE(VALUES(poster), poster),
       thumbnail_url     = COALESCE(VALUES(thumbnail_url), thumbnail_url),
       qr_url            = COALESCE(VALUES(qr_url), qr_url),
       product_folder    = COALESCE(VALUES(product_folder), product_folder),
       status            = COALESCE(VALUES(status), status),
       views             = GREATEST(COALESCE(VALUES(views), 0), COALESCE(views, 0)),
       settings          = COALESCE(VALUES(settings), settings),
       material_settings = COALESCE(VALUES(material_settings), material_settings),
       variants          = COALESCE(VALUES(variants), variants),
       hotspots          = COALESCE(VALUES(hotspots), hotspots),
       updated_at        = NOW()`,
    [
      productUid,
      customerUid,
      String(json.title || "Untitled"),
      String(json.category || "Uncategorized"),
      urlColumnValue(json.modelUrl),
      String(json.fileName || ""),
      urlColumnValue(json.poster),
      urlColumnValue(json.thumbnailUrl),
      urlColumnValue(json.qrUrl),
      resolveLogicalProductFolder(json, "All"),
      String(json.status || "Draft"),
      Number(json.views || 0),
      json.settings ? JSON.stringify(json.settings) : null,
      json.materialSettings ? JSON.stringify(json.materialSettings) : null,
      json.variants ? JSON.stringify(json.variants) : null,
      json.hotspots != null && Array.isArray(json.hotspots)
        ? JSON.stringify(json.hotspots)
        : null,
      json.createdAt ? new Date(String(json.createdAt)) : null,
      json.updatedAt ? new Date(String(json.updatedAt)) : null,
    ],
  );
}

export async function syncAllProductsFromDiskToMysql() {
  const scanned = await scanAllProductsFromDisk();
  const liveCustomers = await knownCustomerUids();
  const existingIds = new Set(
    (
      await query<{ id: string }>("SELECT id FROM products WHERE deleted_at IS NULL").catch(() => [])
    ).map((row) => String(row.id)),
  );

  let synced = 0;
  for (const record of scanned) {
    // Never recreate products that were deleted from MySQL.
    if (!liveCustomers.has(record.customerUid)) continue;
    if (!existingIds.has(record.productUid)) continue;
    try {
      await syncProductJsonToMysql(record);
      synced += 1;
    } catch (error) {
      console.warn("[disk-sync] product sync failed:", record.productUid, error);
    }
  }
  return synced;
}
