import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { ensureProductSchema, query } from "@/lib/db";
import { getProductFolder } from "@/lib/localCustomerStorage";
import { patchCustomerProduct } from "@/lib/user-panel/products.service";
import {
  deleteProductFolder,
  recalculateCustomerStorage,
  StorageSecurityError,
} from "@/lib/storage";
import fs from "fs/promises";
import path from "path";
import { checkEnterpriseArExperienceLimit } from "@/lib/billing/limit-enforcement";
import { resolveLogicalProductFolder } from "@/lib/products/logical-folder";
import { urlColumnValue } from "@/lib/products/asset-url-column";
import { sanitizeEnvironmentImage } from "@/lib/products/environment-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ProductRow = {
  id: string;
  customer_uid: string | null;
  user_id: number | null;
  title: string;
  category: string | null;
  model_url: string | null;
  file_name: string | null;
  poster: string | null;
  thumbnail_url: string | null;
  qr_url: string | null;
  product_folder: string | null;
  status: string;
  views: number;
  version?: number | null;
  public_id?: string | null;
  viewer_slug?: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

async function readProductJson(customerUid: string, productUid: string) {
  try {
    const file = path.join(getProductFolder(customerUid, productUid), "product.json");
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseJsonColumn(val: any) {
  if (!val) return undefined;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

async function syncJsonToMysql(json: any, userId: number, customerUid: string) {
  try {
    await query(
      `INSERT INTO products
         (id, customer_uid, user_id, title, category, model_url, file_name,
          poster, thumbnail_url, qr_url, product_folder, status, views,
          settings, material_settings, variants, hotspots)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title        = VALUES(title),
         category     = VALUES(category),
         model_url    = COALESCE(VALUES(model_url), model_url),
         file_name    = COALESCE(VALUES(file_name), file_name),
         poster       = COALESCE(VALUES(poster), poster),
         thumbnail_url= COALESCE(VALUES(thumbnail_url), thumbnail_url),
         qr_url       = COALESCE(VALUES(qr_url), qr_url),
         product_folder = COALESCE(VALUES(product_folder), product_folder),
         status       = COALESCE(VALUES(status), status),
         settings     = COALESCE(VALUES(settings), settings),
         material_settings = COALESCE(VALUES(material_settings), material_settings),
         variants     = COALESCE(VALUES(variants), variants),
         hotspots     = COALESCE(VALUES(hotspots), hotspots),
         updated_at   = NOW()`,
      [
        String(json.productUid || json.id || ""),
        customerUid,
        userId,
        String(json.title || "Untitled"),
        String(json.category || "Uncategorized"),
        urlColumnValue(json.modelUrl),
        String(json.fileName || ""),
        urlColumnValue(json.poster),
        urlColumnValue(json.thumbnailUrl),
        urlColumnValue(json.qrUrl),
        resolveLogicalProductFolder(json, "All"),
        String(json.status || "published"),
        Number(json.views || 0),
        json.settings ? JSON.stringify(json.settings) : null,
        json.materialSettings ? JSON.stringify(json.materialSettings) : null,
        json.variants ? JSON.stringify(json.variants) : null,
        json.hotspots ? JSON.stringify(json.hotspots) : null,
      ],
    );
  } catch (err) {
    console.warn("[id/GET] sync to mysql failed:", err);
  }
}

// ── GET /api/products/[id] ────────────────────────────────────────────────────
export async function GET(_req: Request, context: RouteContext) {
  try {
    // SECURITY: Require authenticated customer session
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "upload", { isEdit: true });
    if (!permission.ok) return permission.response;

    const params = await context.params;
    const productId = normalizeScopedId(params.id);
    if (!productId) {
      return NextResponse.json({ error: "Product id required." }, { status: 400 });
    }

    // SECURITY: customerUid comes from the verified session — never from the URL
    const customerUid = user.customerUid ?? "";

    // 1. MySQL is the source of truth
    await ensureProductSchema();
    const rows = await query<ProductRow>(
      `SELECT id, customer_uid, user_id, title, category, model_url, file_name,
              poster, thumbnail_url, qr_url, product_folder, status, views, version,
              public_id, viewer_slug,
              settings, material_settings, variants, hotspots, published_at, created_at, updated_at,
              deleted_at
       FROM products
       WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
       LIMIT 1`,
      [productId, customerUid, user.id],
    ).catch(() => [] as ProductRow[]);

    if (rows[0]?.deleted_at) {
      // Soft-deleted — never heal from disk.
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (rows[0]) {
      const row = rows[0];
      const disk = await readProductJson(customerUid, productId);
      const mysqlMaterialSettings = parseJsonColumn((row as any).material_settings);
      const mysqlVariants = parseJsonColumn((row as any).variants);
      const mysqlSettings = parseJsonColumn((row as any).settings);
      const mysqlHotspots = parseJsonColumn((row as any).hotspots);

      return NextResponse.json({
        product: {
          ...(disk || {}),
          ...(mysqlSettings && typeof mysqlSettings === "object" ? mysqlSettings : {}),
          id: row.id,
          productUid: row.id,
          publicId:
            row.public_id ||
            (typeof disk?.publicId === "string" ? disk.publicId : "") ||
            undefined,
          viewerSlug:
            row.viewer_slug ||
            (typeof disk?.viewerSlug === "string" ? disk.viewerSlug : "") ||
            undefined,
          customerUid: row.customer_uid ?? customerUid,
          title: row.title || (disk?.title as string) || "Untitled",
          category: row.category ?? (disk?.category as string) ?? "Uncategorized",
          modelUrl: row.model_url || (disk?.modelUrl as string) || "",
          fileName: row.file_name ?? (disk?.fileName as string) ?? "",
          poster: row.poster ?? (disk?.poster as string) ?? "",
          thumbnailUrl: row.thumbnail_url ?? (disk?.thumbnailUrl as string) ?? "",
          qrUrl: row.qr_url ?? (disk?.qrUrl as string) ?? "",
          publicFolder: String(disk?.publicFolder || ""),
          status: row.status || (disk?.status as string) || "Draft",
          views: row.views ?? (disk?.views as number) ?? 0,
          version: Number(row.version ?? disk?.version ?? 1) || 1,
          materialSettings: disk?.materialSettings ?? mysqlMaterialSettings,
          nativeMaterialSettings: disk?.nativeMaterialSettings,
          variants: mysqlVariants ?? disk?.variants,
          hotspots: mysqlHotspots ?? disk?.hotspots,
          environmentImage: sanitizeEnvironmentImage(
            (disk as any)?.environmentImage ||
              (mysqlSettings as any)?.environmentImage ||
              "default",
          ),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          folder: resolveLogicalProductFolder(
            { folder: disk?.folder, productFolder: disk?.productFolder || row.product_folder },
            "All",
          ),
          productFolder: resolveLogicalProductFolder(
            { folder: disk?.folder, productFolder: disk?.productFolder || row.product_folder },
            "All",
          ),
        },
      });
    }

    // Heal only when MySQL has no row at all (e.g. upload disk wrote but sync failed).
    // Never revive soft-deleted products.
    const disk = await readProductJson(customerUid, productId);
    if (disk && (disk.modelUrl || disk.fileName || disk.title)) {
      await syncJsonToMysql(
        { ...disk, productUid: productId, id: productId, customerUid },
        user.id,
        customerUid,
      );
      return NextResponse.json({
        product: {
          ...disk,
          id: productId,
          productUid: productId,
          customerUid,
          title: String(disk.title || "Untitled"),
          category: String(disk.category || "Uncategorized"),
          modelUrl: String(disk.modelUrl || ""),
          fileName: String(disk.fileName || ""),
          poster: String(disk.poster || ""),
          thumbnailUrl: String(disk.thumbnailUrl || ""),
          qrUrl: String(disk.qrUrl || ""),
          publicFolder: String(disk.publicFolder || ""),
          status: String(disk.status || "Draft"),
          views: Number(disk.views || 0),
          version: Number(disk.version || 1) || 1,
          environmentImage: sanitizeEnvironmentImage(
            (disk as { environmentImage?: string }).environmentImage || "default",
          ),
          folder: resolveLogicalProductFolder(disk, "All"),
          productFolder: resolveLogicalProductFolder(disk, "All"),
        },
      });
    }

    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  } catch (error) {
    console.error("[products/[id] GET]", error);
    return NextResponse.json({ error: "Failed to load product." }, { status: 500 });
  }
}

// ── DELETE /api/products/[id] ─────────────────────────────────────────────────
export async function DELETE(_req: Request, context: RouteContext) {
  try {
    // SECURITY: Require authenticated customer session
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "upload", { isEdit: true });
    if (!permission.ok) return permission.response;

    const params = await context.params;
    const productId = normalizeScopedId(params.id);
    if (!productId) {
      return NextResponse.json({ error: "Product id required." }, { status: 400 });
    }

    // SECURITY: customerUid comes from the verified session — never from the URL
    const customerUid = user.customerUid ?? "";

    await ensureProductSchema();

    // SECURITY: Verify ownership — the WHERE clause enforces customer_uid = session customerUid.
    // A customer cannot delete another customer's product even if they know the product ID.
    const rows = await query<{ id: string; customer_uid: string | null }>(
      "SELECT id, customer_uid FROM products WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1",
      [productId, customerUid, user.id],
    );

    if (!rows[0]) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const confirmedCustomerUid = rows[0].customer_uid || customerUid;

    await query("DELETE FROM products WHERE id = ? AND customer_uid = ?", [
      productId,
      confirmedCustomerUid,
    ]);

    // SECURITY: deleteProductFolder validates the path through getSecureProductFolder()
    // before calling fs.rm — prevents any path traversal on delete.
    await deleteProductFolder(confirmedCustomerUid, productId);
    void recalculateCustomerStorage(confirmedCustomerUid).catch((err) =>
      console.warn("[products/[id] DELETE] Storage recalculation failed:", err),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof StorageSecurityError) {
      console.error("[products/[id] DELETE] SECURITY:", error.message);
      return NextResponse.json({ error: "Delete rejected." }, { status: 403 });
    }
    console.error("[products/[id] DELETE]", error);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}

// ── PATCH /api/products/[id] ──────────────────────────────────────────────────
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "access_dashboard");
    if (!permission.ok) return permission.response;

    const params = await context.params;
    const productId = normalizeScopedId(params.id);
    if (!productId) {
      return NextResponse.json({ error: "Product id required." }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      folder?: string;
      status?: string;
      category?: string;
    };

    if (["published", "active"].includes(String(body.status || "").toLowerCase())) {
      const arLimit = await checkEnterpriseArExperienceLimit(
        user.customerUid ?? "",
        productId,
      );
      if (arLimit.ok === false) {
        return NextResponse.json(
          { success: false, code: arLimit.code, error: arLimit.message },
          { status: 403 },
        );
      }
    }

    await patchCustomerProduct({
      customerUid: user.customerUid ?? "",
      userId: user.id,
      productUid: productId,
      title: body.title,
      folder: body.folder,
      status: body.status,
      category: body.category,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status = message.includes("not found") ? 404 : 500;
    console.error("[products/[id] PATCH]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
