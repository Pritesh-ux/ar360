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
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
        String(json.modelUrl || ""),
        String(json.fileName || ""),
        String(json.poster || ""),
        String(json.thumbnailUrl || ""),
        String(json.qrUrl || ""),
        String(json.publicFolder || ""),
        String(json.status || "Draft"),
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
              poster, thumbnail_url, qr_url, product_folder, status, views,
              settings, material_settings, variants, hotspots, published_at, created_at, updated_at
       FROM products
       WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
       LIMIT 1`,
      [productId, customerUid, user.id],
    ).catch(() => [] as ProductRow[]);

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
          customerUid: row.customer_uid ?? customerUid,
          title: row.title || (disk?.title as string) || "Untitled",
          category: row.category ?? (disk?.category as string) ?? "Uncategorized",
          modelUrl: row.model_url || (disk?.modelUrl as string) || "",
          fileName: row.file_name ?? (disk?.fileName as string) ?? "",
          poster: row.poster ?? (disk?.poster as string) ?? "",
          thumbnailUrl: row.thumbnail_url ?? (disk?.thumbnailUrl as string) ?? "",
          qrUrl: row.qr_url ?? (disk?.qrUrl as string) ?? "",
          publicFolder: row.product_folder ?? (disk?.publicFolder as string) ?? "",
          status: row.status || (disk?.status as string) || "Draft",
          views: row.views ?? (disk?.views as number) ?? 0,
          materialSettings: disk?.materialSettings ?? mysqlMaterialSettings,
          nativeMaterialSettings: disk?.nativeMaterialSettings,
          variants: mysqlVariants ?? disk?.variants,
          hotspots: mysqlHotspots ?? disk?.hotspots,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          folder: String(disk?.folder || disk?.productFolder || "All"),
          productFolder: String(disk?.folder || disk?.productFolder || "All"),
        },
      });
    }

    // 2. Fallback: load product.json from disk and sync to MySQL
    if (customerUid) {
      const json = await readProductJson(customerUid, productId);
      if (json) {
        await syncJsonToMysql(json, user.id, customerUid);
        return NextResponse.json({
          product: {
            ...json,
            id: String(json.productUid || json.id || productId),
            productUid: String(json.productUid || json.id || productId),
            customerUid,
            folder: String(json.folder || json.productFolder || "All"),
            productFolder: String(json.folder || json.productFolder || "All"),
          },
        });
      }
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
    ).catch(() => [] as { id: string; customer_uid: string | null }[]);

    const confirmedCustomerUid = rows[0]?.customer_uid ?? customerUid;

    // Delete from MySQL
    if (rows.length > 0) {
      await query(
        "DELETE FROM products WHERE id = ? AND customer_uid = ?",
        [productId, confirmedCustomerUid],
      ).catch(() => {});
    }

    // SECURITY: deleteProductFolder validates the path through getSecureProductFolder()
    // before calling fs.rm — prevents any path traversal on delete.
    if (confirmedCustomerUid) {
      await deleteProductFolder(confirmedCustomerUid, productId);

      // Recalculate storage quota after deletion
      recalculateCustomerStorage(confirmedCustomerUid).catch((err) =>
        console.warn("[products/[id] DELETE] Storage recalculation failed:", err)
      );
    }

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
