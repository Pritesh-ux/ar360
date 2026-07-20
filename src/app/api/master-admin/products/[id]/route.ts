import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAnalyticsSchema, ensureAppSchema, query } from "@/lib/db";
import { getProductFileMeta } from "@/lib/storage";
import {
  adminDeleteProduct,
  transferProductOwner,
} from "@/lib/master-admin/product-actions.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import {
  countJsonItems,
  fmtDateShort,
  fmtFileSize,
  productCode,
  productStatusLabel,
} from "@/components/features/master-admin/products-utils";
import { getDashboardData } from "@/server/analytics/analytics.service";
import { getProductFolder } from "@/lib/localCustomerStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function fmtDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function persistProductJsonStatus(
  customerUid: string,
  productId: string,
  status: string,
) {
  const filePath = path.join(getProductFolder(customerUid, productId), "product.json");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const product = JSON.parse(raw) as Record<string, unknown>;
  product.status = productStatusLabel(status);
  product.updatedAt = new Date().toISOString();
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(product, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("products.read");
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();
  await ensureAnalyticsSchema();

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  const rows = await query<any>(`
    SELECT
      p.id,
      p.title,
      p.category,
      p.status,
      p.file_name,
      p.model_url,
      p.poster,
      p.thumbnail_url,
      p.qr_url,
      p.product_folder,
      p.settings,
      p.material_settings,
      p.variants,
      p.hotspots,
      p.views,
      p.public_id,
      p.viewer_slug,
      p.created_at,
      p.updated_at,
      p.published_at,
      p.customer_uid,
      c.contact_name,
      c.company_name,
      c.email,
      COALESCE(asset.size_mb, 0) AS productStorageMB
    FROM products p
    LEFT JOIN customers c ON c.customer_uid = p.customer_uid
    LEFT JOIN (
      SELECT product_uid, ROUND(SUM(size_bytes) / 1024 / 1024, 2) AS size_mb
      FROM product_assets
      GROUP BY product_uid
    ) asset ON asset.product_uid = p.id
    WHERE p.id = ?
    LIMIT 1
  `, [id]);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let storageMB = Number(row.productStorageMB || 0);
  if (storageMB <= 0 && row.customer_uid) {
    const files = await getProductFileMeta(String(row.customer_uid), String(row.id));
    storageMB = files.reduce((sum, file) => sum + file.sizeMB, 0);
  }

  const settings = parseJson(row.settings) || {};
  const materialSettings = parseJson(row.material_settings);
  const variants = parseJson(row.variants);
  const hotspots = parseJson(row.hotspots);

  const variantList = Array.isArray(variants)
    ? variants.map((v: any, index: number) => ({
        id: String(v?.id || index),
        name: String(v?.name || v?.title || `Variant ${index + 1}`),
        status: String(v?.status || "active"),
      }))
    : variants && typeof variants === "object"
      ? Object.entries(variants).map(([key, v]: [string, any]) => ({
          id: key,
          name: String(v?.name || key),
          status: String(v?.status || "active"),
        }))
      : [];

  const materialList = Array.isArray(materialSettings)
    ? materialSettings.map((m: any, index: number) => ({
        id: String(m?.index ?? index),
        name: String(m?.name || `Material ${index + 1}`),
        baseColor: String(m?.baseColor || "—"),
      }))
    : materialSettings && typeof materialSettings === "object"
      ? Object.entries(materialSettings).map(([key, m]: [string, any]) => ({
          id: key,
          name: String(m?.name || key),
          baseColor: String(m?.baseColor || "—"),
        }))
      : [];

  const [analytics, historyRows, qrRows, clientAssignmentRows] = await Promise.all([
    getDashboardData({
      customerUid: row.customer_uid || undefined,
      productUid: id,
      from,
      to,
    }).catch(() => null),

    query<any>(`
      SELECT id, action, created_at, actor_name AS admin_name, ip_hash AS ip, resource_label AS details
      FROM audit_logs
      WHERE customer_uid = ? AND (resource_id = ? OR resource_label LIKE ? OR action LIKE ?)
      ORDER BY created_at DESC
      LIMIT 30
    `, [row.customer_uid || "", id, `%${id}%`, `%${row.title || ""}%`]).catch(() => []),

    query<any>(`
      SELECT COALESCE(qr_code, qr_uid, public_id) AS code, name, created_at, scans
      FROM product_qr_codes
      WHERE product_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]).catch(() => []),

    query<{ client_uid: string; name: string; email: string | null; status: string }>(
      `SELECT c.client_uid, c.name, c.email, c.status
         FROM client_resources cr
         INNER JOIN clients c ON c.client_uid = cr.client_uid AND c.customer_uid = ?
        WHERE cr.resource_type = 'product' AND cr.resource_id = ?
        LIMIT 1`,
      [row.customer_uid || "", id],
    ).catch(() => []),
  ]);

  const analyticsSummary = analytics?.summary || {
    totalViews: Number(row.views || 0),
    uniqueVisitors: 0,
    returningVisitors: 0,
    arLaunches: 0,
    screenshots: 0,
    shares: 0,
    copyLinks: 0,
    qrScans: 0,
    avgSessionDuration: 0,
    bounceRate: 0,
  };

  const topDevice = analytics?.devices?.[0];
  const topCountry = analytics?.topCountries?.[0];
  const topBrowser = analytics?.browsers?.[0];

  const fileExt = String(row.file_name || row.model_url || "").split(".").pop()?.toUpperCase() || "GLB";

  return NextResponse.json({
    product: {
      id: String(row.id),
      code: productCode(String(row.id)),
      name: row.title || row.file_name || row.id,
      category: row.category || "Uncategorized",
      status: productStatusLabel(row.status),
      rawStatus: row.status,
      owner: row.contact_name || "Unknown",
      ownerEmail: row.email || "",
      company: row.company_name || row.contact_name || "—",
      customerUid: row.customer_uid || "",
      fileName: row.file_name || "model.glb",
      fileSize: fmtFileSize(storageMB),
      fileSizeMB: storageMB,
      storageMB: Math.round(storageMB * 10) / 10,
      format: fileExt.includes("GLB") || fileExt.includes("GLTF") ? "glTF (GLB)" : fileExt,
      modelUrl: row.model_url || "",
      productFolder: row.product_folder || "",
      poster: row.poster || row.thumbnail_url || "",
      qrUrl: row.qr_url || "",
      publicId: row.public_id || row.viewer_slug || row.id,
      views: Number(row.views || 0),
      arViews: Number(analyticsSummary.arLaunches || 0),
      qrScans: Number(analyticsSummary.qrScans || 0),
      variantsCount: variantList.length || countJsonItems(variants),
      materialsCount: materialList.length || countJsonItems(materialSettings),
      createdAt: fmtDateShort(row.created_at),
      updatedAt: fmtDateShort(row.updated_at),
      publishedAt: fmtDateShort(row.published_at),
      createdAtRaw: row.created_at,
      updatedAtRaw: row.updated_at,
    },
    settings: {
      exposure: Number(settings.exposure ?? 1),
      environmentImage: String(settings.environmentImage || "neutral"),
      backgroundColor: String(settings.backgroundColor || "#ffffff"),
      shadowIntensity: Number(settings.shadowIntensity ?? 1),
      autoRotate: Boolean(settings.autoRotate),
      useSkybox: Boolean(settings.useSkybox),
    },
    variants: variantList,
    materials: materialList,
    hotspots: Array.isArray(hotspots) ? hotspots : [],
    analytics: {
      summary: {
        views: analyticsSummary.totalViews,
        arOpens: analyticsSummary.arLaunches,
        avgSessionTime: fmtDuration(analyticsSummary.avgSessionDuration),
        avgSessionSeconds: analyticsSummary.avgSessionDuration,
        bounceRate: analyticsSummary.bounceRate,
        qrScans: analyticsSummary.qrScans,
      },
      daily: analytics?.daily || [],
      devices: analytics?.devices || [],
      countries: analytics?.topCountries || [],
      browsers: analytics?.browsers || [],
      insights: {
        topDevice: topDevice ? `${topDevice.device} (${topDevice.percent}%)` : "—",
        topCountry: topCountry ? `${topCountry.country} (${topCountry.percent}%)` : "—",
        topBrowser: topBrowser ? `${topBrowser.browser} (${topBrowser.percent}%)` : "—",
        arOpensWebXR: analyticsSummary.arLaunches,
        qrScans: analyticsSummary.qrScans,
      },
    },
    qrCodes: qrRows.map((q: any) => ({
      code: q.code,
      name: q.name || "QR",
      scans: Number(q.scans || 0),
      createdAt: fmtDateShort(q.created_at),
    })),
    clientDelivery: clientAssignmentRows[0]
      ? {
          clientUid: clientAssignmentRows[0].client_uid,
          clientName: clientAssignmentRows[0].name,
          clientEmail: clientAssignmentRows[0].email,
          clientStatus: clientAssignmentRows[0].status,
        }
      : null,
    history: historyRows.map((h: any) => ({
      id: h.id,
      action: h.action,
      adminName: h.admin_name || "System",
      createdAt: fmtDateShort(h.created_at),
      createdAtRaw: h.created_at,
      ip: h.ip || "—",
      details: h.details || "—",
    })),
    links: {
      editor: `/dashboard/products/${row.id}`,
      viewer: `/viewer/${row.public_id || row.viewer_slug || row.id}`,
      embed: `/embed/${row.public_id || row.viewer_slug || row.id}`,
      ar: `/ar/${row.public_id || row.viewer_slug || row.id}`,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureAppSchema();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").toLowerCase();

  if (action === "transfer_owner") {
    const auth = await guardAdminPermission("products.update");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const customerUid = String(body.customerUid || body.customer_uid || "").trim();
    if (!customerUid) {
      return NextResponse.json({ error: "Target customer UID is required." }, { status: 400 });
    }

    try {
      const result = await transferProductOwner(id, customerUid);
      await writeMasterAdminAudit({
        adminId: admin.id,
        action: "product.transfer_owner",
        entityType: "product",
        entityId: id,
        metadata: result,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Transfer failed." },
        { status: 400 },
      );
    }
  }

  if (action === "delete") {
    const auth = await guardAdminPermission("products.delete");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    try {
      const result = await adminDeleteProduct(id);
      await writeMasterAdminAudit({
        adminId: admin.id,
        action: "product.delete",
        entityType: "product",
        entityId: id,
        metadata: result,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Delete failed." },
        { status: 400 },
      );
    }
  }

  const auth = await guardAdminPermission("products.update");
  if (auth instanceof NextResponse) return auth;

  const statusMap: Record<string, string> = {
    publish: "published",
    published: "published",
    draft: "draft",
    disable: "archived",
    archive: "archived",
    archived: "archived",
  };

  const nextStatus = statusMap[action];
  if (!nextStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const existing = await query<{ id: string; customer_uid: string }>(
    `SELECT id, customer_uid FROM products WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!existing[0]) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  await persistProductJsonStatus(existing[0].customer_uid, id, nextStatus);
  await query(
    `UPDATE products SET status = ?, updated_at = NOW(), published_at = CASE WHEN ? = 'published' THEN NOW() ELSE published_at END WHERE id = ?`,
    [nextStatus, nextStatus, id],
  );

  return NextResponse.json({ ok: true, status: productStatusLabel(nextStatus) });
}
