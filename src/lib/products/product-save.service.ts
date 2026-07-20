import fs from "fs/promises";
import path from "path";
import { ensureAppSchema, query, type QueryValue } from "@/lib/db";
import { getProductFolder, updateProductJson, saveQrPng } from "@/lib/localCustomerStorage";
import { writeProductFile } from "@/lib/storage";
import { ProductErrorCode } from "@/lib/products/product-errors";
import { normalizeProductStatus } from "@/lib/products/publish.service";
import { logProductActivity } from "@/lib/products/publish.service";

export class ProductSaveError extends Error {
  phase: "disk" | "mysql" | "validation" | "conflict";
  code?: string;

  constructor(
    message: string,
    phase: "disk" | "mysql" | "validation" | "conflict",
    code?: string,
  ) {
    super(message);
    this.name = "ProductSaveError";
    this.phase = phase;
    this.code = code;
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

async function readProductJsonSnapshot(customerUid: string, productUid: string) {
  const file = path.join(getProductFolder(customerUid, productUid), "product.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function restoreProductJsonSnapshot(
  customerUid: string,
  productUid: string,
  snapshot: Record<string, unknown> | null,
) {
  if (!snapshot) return;
  const file = path.join(getProductFolder(customerUid, productUid), "product.json");
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
}

async function upsertProductFromJson(
  json: Record<string, unknown>,
  userId?: number,
  expectedVersion?: number,
) {
  const productUid = String(json.productUid || json.id || "");
  const customerUid = String(json.customerUid || "");
  if (!productUid || !customerUid) {
    throw new ProductSaveError("Missing productUid or customerUid for MySQL sync.", "validation");
  }

  if (typeof expectedVersion === "number" && Number.isFinite(expectedVersion)) {
    const rows = await query<{ version: number }>(
      `SELECT version FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productUid, customerUid],
    );
    const current = Number(rows[0]?.version || 0);
    if (current > expectedVersion) {
      throw new ProductSaveError(
        "A newer version of this product exists. Reload to continue editing.",
        "conflict",
        ProductErrorCode.VERSION_CONFLICT,
      );
    }
  }

  const normalizedStatus = normalizeProductStatus(String(json.status || "draft"));
  const nextVersion = Number(json.version || 0) > 0 ? Number(json.version) : undefined;

  await query(
    `INSERT INTO products
       (id, customer_uid, user_id, title, category, model_url, file_name,
        poster, thumbnail_url, qr_url, product_folder, status, views,
        settings, material_settings, variants, hotspots, version, last_editor_user_id, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title             = VALUES(title),
       category          = VALUES(category),
       description       = COALESCE(VALUES(description), description),
       model_url         = COALESCE(VALUES(model_url), model_url),
       file_name         = COALESCE(VALUES(file_name), file_name),
       poster            = COALESCE(VALUES(poster), poster),
       thumbnail_url     = COALESCE(VALUES(thumbnail_url), thumbnail_url),
       qr_url            = COALESCE(VALUES(qr_url), qr_url),
       product_folder    = COALESCE(VALUES(product_folder), product_folder),
       status            = COALESCE(VALUES(status), status),
       settings          = COALESCE(VALUES(settings), settings),
       material_settings = COALESCE(VALUES(material_settings), material_settings),
       variants          = COALESCE(VALUES(variants), variants),
       hotspots          = COALESCE(VALUES(hotspots), hotspots),
       version           = COALESCE(VALUES(version), version),
       last_editor_user_id = COALESCE(VALUES(last_editor_user_id), last_editor_user_id),
       updated_at        = NOW()`,
    [
      productUid,
      customerUid,
      userId ?? null,
      String(json.title || "Untitled"),
      String(json.category || "Uncategorized"),
      String(json.modelUrl || ""),
      String(json.fileName || ""),
      String(json.poster || ""),
      String(json.thumbnailUrl || ""),
      String(json.qrUrl || ""),
      String(json.publicFolder || json.productFolder || ""),
      normalizedStatus,
      Number(json.views || 0),
      json.settings ? JSON.stringify(json.settings) : null,
      json.materialSettings ? JSON.stringify(json.materialSettings) : null,
      json.variants ? JSON.stringify(json.variants) : null,
      json.hotspots ? JSON.stringify(json.hotspots) : null,
      nextVersion ?? null,
      userId ?? null,
      json.description ? String(json.description) : null,
    ] as QueryValue[],
  );

  if (!nextVersion) {
    await query(
      `UPDATE products SET version = COALESCE(version, 0) + 1, last_editor_user_id = ?
       WHERE id = ? AND customer_uid = ?`,
      [userId ?? null, productUid, customerUid],
    );
  }
}

export type SaveProductAssetsInput = {
  customerUid: string;
  productUid: string;
  userId?: number;
  posterDataUrl?: string;
  destination?: string;
  status?: string;
  patch: Record<string, unknown>;
  expectedVersion?: number;
};

export type SaveProductAssetsResult = {
  product: Record<string, unknown>;
  posterUrl: string;
  thumbnailUrl: string;
  qrUrl: string;
  version: number;
};

/**
 * Saves product assets with MySQL as source of truth.
 * Disk writes run first; if MySQL upsert fails, product.json is restored from snapshot.
 */
export async function saveProductAssetsTransactional(
  input: SaveProductAssetsInput,
): Promise<SaveProductAssetsResult> {
  await ensureAppSchema();

  const { customerUid, productUid } = input;
  const jsonSnapshot = await readProductJsonSnapshot(customerUid, productUid);

  let posterUrl = "";
  let thumbnailUrl = "";
  let qrUrl = "";

  try {
    if (input.posterDataUrl?.startsWith("data:image/")) {
      const buffer = dataUrlToBuffer(input.posterDataUrl);
      if (buffer) {
        posterUrl = await writeProductFile({
          customerUid,
          productUid,
          fileName: "poster.png",
          data: buffer,
        });
        thumbnailUrl = await writeProductFile({
          customerUid,
          productUid,
          fileName: "thumbnail.png",
          data: buffer,
        });
      }
    }

    if (input.destination) {
      qrUrl = await saveQrPng({ customerUid, productUid, destination: input.destination });
    }

    const patch: Record<string, unknown> = {
      ...input.patch,
      customerUid,
      productUid,
      id: String(input.patch.id || productUid),
      status: normalizeProductStatus(input.status || String(input.patch.status || "draft")),
      destination: input.destination || input.patch.destination,
      updatedAt: new Date().toISOString(),
    };

    if (posterUrl) patch.poster = posterUrl;
    if (thumbnailUrl) patch.thumbnailUrl = thumbnailUrl;
    if (qrUrl) patch.qrUrl = qrUrl;

    const productJson = await updateProductJson({ customerUid, productUid, patch });

    try {
      await upsertProductFromJson(productJson as Record<string, unknown>, input.userId, input.expectedVersion);
    } catch (error) {
      await restoreProductJsonSnapshot(customerUid, productUid, jsonSnapshot);
      if (error instanceof ProductSaveError) throw error;
      throw new ProductSaveError(
        error instanceof Error ? error.message : "MySQL sync failed.",
        "mysql",
        ProductErrorCode.SAVE_FAILED,
      );
    }

    const versionRows = await query<{ version: number }>(
      `SELECT version FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productUid, customerUid],
    );
    const savedVersion = Number(versionRows[0]?.version || 1);

    await logProductActivity({
      productUid,
      customerUid,
      userId: input.userId,
      action: normalizeProductStatus(String(patch.status)) === "published" ? "save_publish" : "autosave",
      version: savedVersion,
    });

    return {
      product: { ...(productJson as Record<string, unknown>), version: savedVersion },
      posterUrl,
      thumbnailUrl,
      qrUrl,
      version: savedVersion,
    };
  } catch (error) {
    if (error instanceof ProductSaveError) throw error;
    throw new ProductSaveError(
      error instanceof Error ? error.message : "Disk save failed.",
      "disk",
    );
  }
}
