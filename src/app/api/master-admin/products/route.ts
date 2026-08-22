import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { getProductFileMeta } from "@/lib/storage";
import { syncAllProductsFromDiskToMysql } from "@/lib/products/disk-sync";
import { paginationMeta, parsePagination } from "@/lib/master-admin/pagination";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import {
  countJsonItems,
  fmtDateShort,
  fmtFileSize,
  productCode,
  productStatusLabel,
} from "@/components/features/master-admin/products-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonField(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await guardAdminPermission("products.read", { request: req });
    if (auth instanceof NextResponse) return auth;

    await ensureAppSchema();
    // Disk→MySQL sync is opt-in only. Auto-sync on every list load resurrected hard-deleted products.
    const syncRequested = new URL(req.url).searchParams.get("syncDisk") === "1";
    const syncedFromDisk = syncRequested ? await syncAllProductsFromDiskToMysql() : 0;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const customer = searchParams.get("customer") || "";
    const category = searchParams.get("category") || "";
    const status = searchParams.get("status") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const sort = searchParams.get("sort") || "default";
    const { page, pageSize, offset } = parsePagination(searchParams, { pageSize: 10 });

    const conditions: string[] = [];
    const values: string[] = [];

    if (search) {
      conditions.push("(p.title LIKE ? OR p.id LIKE ? OR c.contact_name LIKE ? OR c.company_name LIKE ?)");
      const like = `%${search}%`;
      values.push(like, like, like, like);
    }
    if (customer) {
      conditions.push("(c.company_name LIKE ? OR c.contact_name LIKE ? OR c.customer_uid LIKE ?)");
      const like = `%${customer}%`;
      values.push(like, like, like);
    }
    if (category) {
      conditions.push("p.category LIKE ?");
      values.push(`%${category}%`);
    }
    if (status) {
      if (status === "Published") {
        conditions.push("LOWER(p.status) IN ('published', 'active')");
      } else if (status === "Draft") {
        conditions.push("LOWER(p.status) IN ('draft', '') OR p.status IS NULL");
      } else if (status === "Archived") {
        conditions.push("LOWER(p.status) IN ('archived', 'suspended')");
      }
    }
    if (dateFrom) {
      conditions.push("DATE(p.created_at) >= ?");
      values.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("DATE(p.created_at) <= ?");
      values.push(dateTo);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy =
      sort === "storage"
        ? "ORDER BY productStorageMB DESC, p.created_at DESC"
        : sort === "views"
          ? "ORDER BY p.views DESC, p.created_at DESC"
          : "ORDER BY p.created_at DESC";

    const baseFrom = `
      FROM products p
      LEFT JOIN customers c ON c.customer_uid = p.customer_uid
      LEFT JOIN (
        SELECT
          product_uid,
          SUM(CASE WHEN event IN ('ar_launch_success','ar_button_click') THEN 1 ELSE 0 END) AS arClicks,
          SUM(CASE WHEN event IN ('download_qr','qr_scan') THEN 1 ELSE 0 END) AS qrScans,
          SUM(CASE WHEN event IN ('open_embed','embed_open') THEN 1 ELSE 0 END) AS embedLoads
        FROM analytics_events
        GROUP BY product_uid
      ) a ON a.product_uid = p.id
      LEFT JOIN (
        SELECT product_uid, ROUND(SUM(size_bytes) / 1024 / 1024, 2) AS size_mb
        FROM product_assets
        GROUP BY product_uid
      ) asset ON asset.product_uid = p.id
    `;

    const [countRows, rows, summaryRows, categoryRows, topViewedRows, recentRows, topCustomerRows] = await Promise.all([
      query<{ total: number }>(`SELECT COUNT(*) AS total ${baseFrom} ${where}`, values),
      query<any>(`
      SELECT
        p.id,
        p.title,
        p.category,
        p.status,
        p.file_name,
        p.model_url,
        p.created_at,
        p.updated_at,
        p.customer_uid,
        COALESCE(p.views, 0) AS views,
        p.poster,
        p.thumbnail_url,
        p.public_id,
        p.viewer_slug,
        p.variants,
        p.material_settings,
        c.company_name,
        c.contact_name,
        c.email,
        COALESCE(a.arClicks, 0) AS arClicks,
        COALESCE(a.qrScans, 0) AS qrScans,
        COALESCE(a.embedLoads, 0) AS embedLoads,
        COALESCE(asset.size_mb, 0) AS productStorageMB
      ${baseFrom}
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

      query<any>(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(p.status) IN ('published', 'active') THEN 1 ELSE 0 END) AS published,
          SUM(CASE WHEN LOWER(p.status) IN ('draft', '') OR p.status IS NULL THEN 1 ELSE 0 END) AS draft,
          SUM(CASE WHEN LOWER(p.status) IN ('archived', 'suspended') THEN 1 ELSE 0 END) AS archived,
          COALESCE(SUM(COALESCE(asset.size_mb, 0)), 0) AS totalStorageMB,
          COALESCE(SUM(COALESCE(p.views, 0)), 0) AS totalViews,
          COALESCE(SUM(COALESCE(a.arClicks, 0)), 0) AS totalArViews,
          SUM(CASE WHEN YEAR(p.created_at) = YEAR(CURDATE()) AND MONTH(p.created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) AS uploadsThisMonth
        ${baseFrom}
        ${where}
      `, values),

      query<{ category: string; count: number }>(`
        SELECT COALESCE(NULLIF(p.category, ''), 'Uncategorized') AS category, COUNT(*) AS count
        ${baseFrom}
        ${where}
        GROUP BY category
        ORDER BY count DESC
        LIMIT 6
      `, values),

      query<any>(`
        SELECT p.id, p.title, p.poster, p.thumbnail_url, COALESCE(p.views, 0) AS views
        ${baseFrom}
        ${where}
        ORDER BY p.views DESC
        LIMIT 5
      `, values),

      query<any>(`
        SELECT p.id, p.title, p.poster, p.thumbnail_url, p.created_at, c.contact_name
        ${baseFrom}
        ${where}
        ORDER BY p.created_at DESC
        LIMIT 5
      `, values),

      query<{ customer_uid: string; contact_name: string; company_name: string; count: number }>(`
        SELECT p.customer_uid, c.contact_name, c.company_name, COUNT(*) AS count
        ${baseFrom}
        ${where}
        GROUP BY p.customer_uid, c.contact_name, c.company_name
        ORDER BY count DESC
        LIMIT 5
      `, values),
    ]);

    const products = await Promise.all(
      rows.map(async (r: any) => {
        let storageMB = Number(r.productStorageMB || 0);

        if (storageMB <= 0 && r.customer_uid && r.id) {
          const files = await getProductFileMeta(String(r.customer_uid), String(r.id));
          storageMB = files.reduce((sum, file) => sum + file.sizeMB, 0);
        }

        const variants = countJsonItems(parseJsonField(r.variants));
        const materials = countJsonItems(parseJsonField(r.material_settings));
        const statusLabel = productStatusLabel(r.status);

        return {
          id: String(r.id),
          name: r.title || r.file_name || r.id,
          code: productCode(String(r.id)),
          owner: r.contact_name || "Unknown",
          customer: r.company_name || r.contact_name || r.customer_uid || "Customer",
          email: r.email || "",
          category: r.category || "Uncategorized",
          status: statusLabel,
          fileSize: fmtFileSize(storageMB),
          storageMB: Math.max(0, Math.round(storageMB * 10) / 10),
          variants,
          materials,
          views: Number(r.views || 0),
          arViews: Number(r.arClicks || 0),
          qrScans: Number(r.qrScans || 0),
          embedLoads: Number(r.embedLoads || 0),
          createdAt: fmtDateShort(r.created_at),
          updatedAt: fmtDateShort(r.updated_at),
          createdAtRaw: r.created_at,
          modelFile: r.file_name || "—",
          poster: r.poster || r.thumbnail_url || "",
          customerUid: r.customer_uid || "",
          publicId: r.public_id || r.viewer_slug || "",
        };
      }),
    );

    const settings = await getPlatformSettings().catch(() => null);
    const storageCapacityMB = Math.max(
      1,
      Number(settings?.platformStorageLimitGb || 50) * 1024,
    );
    const summaryRow = summaryRows[0] || {};
    const totalStorageMB = Number(summaryRow.totalStorageMB || 0);
    const summary = {
      total: Number(summaryRow.total || 0),
      published: Number(summaryRow.published || 0),
      draft: Number(summaryRow.draft || 0),
      archived: Number(summaryRow.archived || 0),
      totalStorageMB,
      storageCapacityMB,
      storageUsedPct: Math.min(
        100,
        Math.round((totalStorageMB / storageCapacityMB) * 1000) / 10,
      ),
      totalArViews: Number(summaryRow.totalArViews || 0),
      totalViews: Number(summaryRow.totalViews || 0),
      uploadsThisMonth: Number(summaryRow.uploadsThisMonth || 0),
    };

    const categoryBreakdown = categoryRows.map((row) => ({
      name: row.category,
      value: Number(row.count || 0),
    }));

    const pagination = paginationMeta(Number(countRows[0]?.total || 0), page, pageSize);

    const growthDaily = await query<any>(`
      SELECT DATE_FORMAT(d.date, '%d %b') AS label, COUNT(p.id) AS value
      FROM (
        SELECT CURDATE() - INTERVAL seq DAY AS date FROM (
          SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
          UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
          UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
          UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
          UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
          UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
        ) n
      ) d
      LEFT JOIN products p ON DATE(p.created_at) = d.date
      GROUP BY d.date
      ORDER BY d.date
    `).catch(() => []);

    const uploadsDaily = growthDaily.map((row: any) => ({
      label: String(row.label || ""),
      value: Number(row.value || 0),
    }));

    const recentUploadsSum = uploadsDaily.slice(-7).reduce((sum, row) => sum + row.value, 0);
    const priorUploadsSum = uploadsDaily.slice(-14, -7).reduce((sum, row) => sum + row.value, 0);
    const productGrowthPct =
      priorUploadsSum > 0
        ? Math.round(((recentUploadsSum - priorUploadsSum) / priorUploadsSum) * 1000) / 10
        : recentUploadsSum > 0
          ? 100
          : 0;

    const assetRows = await query<{ file_path: string | null; size_bytes: number }>(`
      SELECT file_path, size_bytes FROM product_assets
    `).catch(() => [] as { file_path: string | null; size_bytes: number }[]);

    const buckets = { Models: 0, Textures: 0, Thumbnails: 0, Others: 0 };
    for (const row of assetRows) {
      const mb = Number(row.size_bytes || 0) / 1024 / 1024;
      const name = String(row.file_path || "").toLowerCase();
      if (/poster\.(png|jpe?g|webp)$/.test(name) || /\/(poster|thumb|thumbnail)/.test(name)) {
        buckets.Thumbnails += mb;
      } else if (/\.(glb|gltf|usdz)$/.test(name)) {
        buckets.Models += mb;
      } else if (/\.(png|jpe?g|webp|ktx2)$/.test(name)) {
        buckets.Textures += mb;
      } else {
        buckets.Others += mb;
      }
    }
    const storageBreakdown = Object.entries(buckets).map(([label, mb]) => ({
      label,
      mb: Math.round(mb * 10) / 10,
    }));

    const topViewed = topViewedRows.map((p: any) => ({
      id: String(p.id),
      name: p.title || p.id,
      poster: p.poster || p.thumbnail_url || "",
      views: Number(p.views || 0),
    }));

    const recentUploads = recentRows.map((p: any) => ({
      id: String(p.id),
      name: p.title || p.id,
      poster: p.poster || p.thumbnail_url || "",
      owner: p.contact_name || "Unknown",
      createdAt: fmtDateShort(p.created_at),
    }));

    const topCustomers = topCustomerRows.map((row) => ({
      customer: row.contact_name || row.customer_uid,
      company: row.company_name || row.contact_name || row.customer_uid,
      count: Number(row.count || 0),
    }));

    const categories = await query<{ category: string }>(`
      SELECT DISTINCT p.category AS category
      FROM products p
      WHERE p.category IS NOT NULL AND p.category != ''
      ORDER BY p.category ASC
      LIMIT 100
    `).then((rows) => rows.map((row) => row.category).filter(Boolean)).catch(() => [] as string[]);

    return NextResponse.json({
      products,
      pagination,
      categories,
      summary,
      analytics: {
        growthDaily: uploadsDaily,
        uploadsDaily,
        storageDaily: [] as { label: string; value: number }[],
        categoryBreakdown,
        uploadsThisMonth: summary.uploadsThisMonth,
        productGrowthPct,
      },
      sidebar: {
        topViewed,
        recentUploads,
        topCustomers,
        storageBreakdown,
      },
      meta: {
        total: summary.total,
        syncedFromDisk,
        customersWithProducts: topCustomers.length,
      },
    });
  } catch (error) {
    console.error("[master-admin/products]", error);
    return NextResponse.json({ error: "Failed to load products." }, { status: 500 });
  }
}
