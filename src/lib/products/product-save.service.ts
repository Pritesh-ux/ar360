import fs from "fs/promises";
import path from "path";
import { ensureAppSchema, query, type QueryValue } from "@/lib/db";
import { getProductFolder, updateProductJson, saveQrPng } from "@/lib/localCustomerStorage";
import { writeProductFile } from "@/lib/storage";
import { ProductErrorCode } from "@/lib/products/product-errors";
import { isInlineAssetUrl, urlColumnValue } from "@/lib/products/asset-url-column";
import { normalizeProductStatus } from "@/lib/products/publish.service";
import { logProductActivity } from "@/lib/products/publish.service";
import { resolveLogicalProductFolder } from "@/lib/products/logical-folder";

export class ProductSaveError extends Error {
  phase: "disk" | "mysql" | "validation" | "conflict";
  code?: string;
  currentVersion?: number;

  constructor(
    message: string,
    phase: "disk" | "mysql" | "validation" | "conflict",
    code?: string,
    currentVersion?: number,
  ) {
    super(message);
    this.name = "ProductSaveError";
    this.phase = phase;
    this.code = code;
    this.currentVersion = currentVersion;
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const decoded = decodeImageDataUrl(dataUrl);
  return decoded ? decoded.buffer : null;
}

const IMAGE_DATA_URL_RE = /^data:image\/([a-z+]+);base64,(.+)$/i;

const DATA_URL_EXTENSIONS: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  "svg+xml": "svg",
};

function decodeImageDataUrl(value: unknown): { buffer: Buffer; extension: string } | null {
  if (typeof value !== "string") return null;
  const match = value.match(IMAGE_DATA_URL_RE);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  return {
    buffer: Buffer.from(match[2], "base64"),
    extension: DATA_URL_EXTENSIONS[mime] || "png",
  };
}

/**
 * Variant thumbnails arrive as inline data URLs from the editor canvas.
 * They are written to the product folder so the variants JSON stays small.
 */
async function persistInlineVariantPosters(
  customerUid: string,
  productUid: string,
  variants: unknown,
): Promise<unknown> {
  if (!Array.isArray(variants)) return variants;

  const persisted: unknown[] = [];
  for (const [index, variant] of variants.entries()) {
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
      persisted.push(variant);
      continue;
    }

    const entry = { ...(variant as Record<string, unknown>) };
    if (isInlineAssetUrl(entry.poster)) {
      const decoded = decodeImageDataUrl(entry.poster);
      if (!decoded) {
        delete entry.poster;
      } else {
        const slug = String(entry.id || `variant-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "");
        try {
          entry.poster = await writeProductFile({
            customerUid,
            productUid,
            fileName: `variant-${slug || index + 1}.${decoded.extension}`,
            data: decoded.buffer,
            deferStorageRecalc: true,
          });
        } catch {
          delete entry.poster;
        }
      }
    }

    if (entry.materialSettings != null) {
      const slug = String(entry.id || `variant-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
      entry.materialSettings = await persistInlineMaterialSettings(
        customerUid,
        productUid,
        entry.materialSettings,
        `v-${slug || index + 1}`,
        true,
      );
    }

    persisted.push(entry);
  }

  return persisted;
}

const MATERIAL_TEXTURE_FIELDS = [
  "baseColorTexture",
  "metallicRoughnessTexture",
  "normalTexture",
  "emissiveTexture",
  "occlusionTexture",
  "bumpTexture",
] as const;

async function persistInlineTextureValue(
  customerUid: string,
  productUid: string,
  fileStem: string,
  value: unknown,
  uniquePrefix?: string,
): Promise<string | undefined> {
  const safeStem = fileStem.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "tex";
  if (typeof value === "string") {
    const raw = value.trim();
    if (raw === "__clear__" || raw === "/__clear__" || raw.endsWith("/__clear__")) {
      return "__clear__";
    }
  }
  if (isInlineAssetUrl(value)) {
    const decoded = decodeImageDataUrl(value);
    if (!decoded) return undefined;
    return writeProductFile({
      customerUid,
      productUid,
      fileName: `${safeStem}.${decoded.extension}`,
      data: decoded.buffer,
      deferStorageRecalc: true,
    });
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (!uniquePrefix) return value;

  const fileName = path.basename(value.split("?")[0] || "");
  if (!fileName) return value;
  if (fileName.startsWith(`${uniquePrefix}-`) || fileName.startsWith(uniquePrefix)) return value;

  try {
    const sourcePath = path.join(getProductFolder(customerUid, productUid), fileName);
    const data = await fs.readFile(sourcePath);
    const ext = (path.extname(fileName).replace(".", "") || "png").toLowerCase();
    return await writeProductFile({
      customerUid,
      productUid,
      fileName: `${safeStem}.${ext}`,
      data,
      deferStorageRecalc: true,
    });
  } catch {
    return value;
  }
}

/**
 * Editor material maps arrive as multi-MB data: URLs. Storing them inside
 * material_settings JSON blows MySQL packets / autosave bodies, so posters and
 * other saves appear to "not stick". Persist maps as product files first.
 */
async function persistInlineMaterialSettings(
  customerUid: string,
  productUid: string,
  settings: unknown,
  prefix = "mat",
  isolateSharedFiles = false,
): Promise<unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return settings;
  }

  const out: Record<string, unknown> = {};
  for (const [slotKey, raw] of Object.entries(settings as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      out[slotKey] = raw;
      continue;
    }

    const setting = { ...(raw as Record<string, unknown>) };
    const stemBase = `${prefix}-${String(slotKey).replace(/[^a-zA-Z0-9_-]/g, "") || "0"}`;

    for (const field of MATERIAL_TEXTURE_FIELDS) {
      if (setting[field] === undefined) continue;
      const next = await persistInlineTextureValue(
        customerUid,
        productUid,
        `${stemBase}-${field}`,
        setting[field],
        isolateSharedFiles ? prefix : undefined,
      );
      if (next === undefined) delete setting[field];
      else setting[field] = next;
    }

    if (setting.logoLayer && typeof setting.logoLayer === "object" && !Array.isArray(setting.logoLayer)) {
      const layer = { ...(setting.logoLayer as Record<string, unknown>) };
      if (layer.image !== undefined) {
        const nextLogo = await persistInlineTextureValue(
          customerUid,
          productUid,
          `${stemBase}-logo`,
          layer.image,
          isolateSharedFiles ? prefix : undefined,
        );
        if (nextLogo === undefined) delete layer.image;
        else layer.image = nextLogo;
      }
      setting.logoLayer = layer;
    }

    out[slotKey] = setting;
  }

  return out;
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

  let currentVersion = 0;
  {
    const rows = await query<{ version: number }>(
      `SELECT version FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
      [productUid, customerUid],
    );
    currentVersion = Number(rows[0]?.version || 0);
  }

  if (typeof expectedVersion === "number" && Number.isFinite(expectedVersion)) {
    if (currentVersion > expectedVersion) {
      // Soft-rebase instead of hard 409: concurrent autosave/publish races were
      // dropping color, tags, and camera updates. Client patch is authoritative;
      // we still bump from the latest DB version so the editor can sync.
      console.warn(
        `[product-save] soft-rebase version product=${productUid} client=${expectedVersion} server=${currentVersion}`,
      );
    }
  }

  const normalizedStatus = normalizeProductStatus(String(json.status || "draft"));
  const nextVersion =
    Math.max(
      currentVersion,
      typeof expectedVersion === "number" && Number.isFinite(expectedVersion) ? expectedVersion : 0,
      Number(json.version || 0) || 0,
    ) + 1;

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
      urlColumnValue(json.modelUrl),
      String(json.fileName || ""),
      urlColumnValue(json.poster),
      urlColumnValue(json.thumbnailUrl),
      urlColumnValue(json.qrUrl),
      resolveLogicalProductFolder(json, "All"),
      normalizedStatus,
      Number(json.views || 0),
      json.settings ? JSON.stringify(json.settings) : null,
      json.materialSettings != null
        ? JSON.stringify(json.materialSettings)
        : null,
      json.variants != null ? JSON.stringify(json.variants) : null,
      Array.isArray(json.hotspots) ? JSON.stringify(json.hotspots) : null,
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
    // Older editor builds send the capture only inside the patch.
    const posterSource = [input.posterDataUrl, input.patch.poster, input.patch.thumbnailUrl].find(
      (value) => typeof value === "string" && value.startsWith("data:image/"),
    ) as string | undefined;

    if (posterSource) {
      const buffer = dataUrlToBuffer(posterSource);
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
      const { resolveQrCenterLogoForCustomer } = await import("@/lib/growth/qr-logo");
      const { query } = await import("@/lib/db");
      const existingQr = await query<{ logo_url: string | null; logo_size: number | null }>(
        `SELECT logo_url, logo_size FROM product_qr_codes
          WHERE product_id = ? AND customer_uid = ? AND deleted_at IS NULL
          ORDER BY id DESC LIMIT 1`,
        [productUid, customerUid],
      ).catch(() => [] as { logo_url: string | null; logo_size: number | null }[]);
      const logo = await resolveQrCenterLogoForCustomer({
        customerUid,
        customLogoUrl: existingQr[0]?.logo_url ?? null,
        customLogoSize: existingQr[0]?.logo_size ?? null,
      });
      qrUrl = await saveQrPng({
        customerUid,
        productUid,
        destination: input.destination,
        logoUrl: logo.logoUrl,
        logoSize: logo.logoSize,
      });
    }

    const patch: Record<string, unknown> = {
      ...input.patch,
      customerUid,
      productUid,
      id: String(input.patch.id || productUid),
      status: normalizeProductStatus(input.status || String(input.patch.status || "published")),
      destination: input.destination || input.patch.destination,
      updatedAt: new Date().toISOString(),
    };

    // Mirror canvas visuals into settings so public viewers always resolve them
    // even when only the settings JSON column is read.
    const settingsBag =
      patch.settings && typeof patch.settings === "object" && !Array.isArray(patch.settings)
        ? { ...(patch.settings as Record<string, unknown>) }
        : {};
    for (const key of [
      "backgroundColor",
      "backgroundType",
      "backgroundGradientEnd",
      "transparent",
      "useSkybox",
      "environmentImage",
      "environmentRotation",
      "environmentTint",
      "environmentSaturation",
      "exposure",
      "shadowIntensity",
      "shadowSoftness",
      "autoRotate",
      "cameraOrbit",
      "cameraTarget",
      "fov",
      "initialZoom",
      "materialSettings",
      "ctaEnabled",
      "ctaType",
      "ctaLabel",
      "ctaUrl",
      "contactUseCustom",
      "contactEnquireEnabled",
      "contactWhatsappEnabled",
      "contactWhatsappNumber",
      "contactEnquireLabel",
      "contactWhatsappLabel",
    ] as const) {
      if (patch[key] !== undefined) settingsBag[key] = patch[key];
    }
    patch.settings = settingsBag;

    if (posterUrl) patch.poster = posterUrl;
    if (thumbnailUrl) patch.thumbnailUrl = thumbnailUrl;
    if (qrUrl) patch.qrUrl = qrUrl;

    // Drop any remaining inline blob so the stored path survives the merge.
    for (const key of ["poster", "thumbnailUrl", "qrUrl", "modelUrl"]) {
      if (isInlineAssetUrl(patch[key])) delete patch[key];
    }

    // Material map data URLs must become disk paths before product.json / MySQL.
    if (patch.materialSettings !== undefined) {
      patch.materialSettings = await persistInlineMaterialSettings(
        customerUid,
        productUid,
        patch.materialSettings,
      );

      // Bake KHR_materials_transmission (+ ior/volume) into model.glb so AR /
      // native glTF viewers get real Physical transmission, not only runtime CSS.
      try {
        const {
          bakeKhrTransmissionIntoGlb,
          materialSettingsNeedKhrTransmissionBake,
        } = await import("@/lib/materials/khr-transmission-bake");
        if (
          materialSettingsNeedKhrTransmissionBake(
            patch.materialSettings as Record<string, { transmission?: number }>,
          )
        ) {
          const folder = getProductFolder(customerUid, productUid);
          for (const fileName of ["model.glb", "model.ar.glb"] as const) {
            const glbPath = path.join(folder, fileName);
            let existing: Buffer;
            try {
              existing = await fs.readFile(glbPath);
            } catch {
              continue;
            }
            const baked = await bakeKhrTransmissionIntoGlb(
              existing,
              patch.materialSettings as Record<string, { transmission?: number }>,
            );
            if (baked.changed) {
              await writeProductFile({
                customerUid,
                productUid,
                fileName,
                data: Buffer.from(baked.buffer),
              });
            }
          }
        }
      } catch (error) {
        console.warn("[product-save] KHR_materials_transmission bake skipped:", error);
      }
    }

    if (patch.variants !== undefined) {
      patch.variants = await persistInlineVariantPosters(customerUid, productUid, patch.variants);
    }

    // Re-mirror after texture persist so settings.materialSettings also uses file URLs.
    if (patch.materialSettings !== undefined && patch.settings && typeof patch.settings === "object") {
      (patch.settings as Record<string, unknown>).materialSettings = patch.materialSettings;
    }

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
