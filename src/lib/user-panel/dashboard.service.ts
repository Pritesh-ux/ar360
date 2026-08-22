import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { resolvePlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getCustomerEntitlements } from "@/lib/billing/customer-entitlements";
import { getSummaryCounts } from "@/server/analytics/analytics.repository";
import { buildDateRange } from "@/server/analytics/analytics.middleware";
import { resolveStorageRoot } from "@/lib/storage/paths";

export type DashboardRangeKey = "7d" | "30d" | "month" | "year";

export type DashboardTrend = {
  current: number;
  previous: number;
  changePercent: number | null;
  direction: "up" | "down" | "flat";
};

export type DashboardActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  href: string | null;
  occurredAt: string;
};

export type DashboardTopProduct = {
  productUid: string;
  title: string;
  category: string;
  thumbnailUrl: string | null;
  views: number;
  arOpens: number;
  qrScans: number;
};

export type DashboardDailyPoint = {
  date: string;
  views: number;
  arOpens: number;
  qrScans: number;
};

export type DashboardOverviewData = {
  user: { name: string };
  range: { from: string; to: string; previousFrom: string; previousTo: string; label: string };
  metrics: {
    totalProducts: { total: number; trend: DashboardTrend };
    totalViews: DashboardTrend;
    arOpens: DashboardTrend;
    qrScans: DashboardTrend;
    storageUsedMb: { current: number; limitMb: number | null; percent: number };
  };
  chart: { daily: DashboardDailyPoint[] };
  recentActivity: DashboardActivityItem[];
  topProducts: DashboardTopProduct[];
  productsByStatus: Array<{ status: string; count: number; percent: number }>;
  storage: {
    usedMb: number;
    limitMb: number | null;
    breakdown: { modelsMb: number; texturesMb: number; postersMb: number; otherMb: number };
  };
  bandwidth: {
    usedMb: number;
    limitGb: number | null;
  };
  subscription: { planId: string; planName: string; status: string };
};

const STATUS_ORDER = ["Published", "Draft", "Processing", "Archived", "Failed"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function resolveDashboardRange(input?: {
  range?: DashboardRangeKey | null;
  from?: string | null;
  to?: string | null;
}): { from: string; to: string; label: string } {
  const now = new Date();
  const to = input?.to?.trim() || formatIsoDate(now);

  if (input?.from?.trim()) {
    return { from: input.from.trim(), to, label: "Custom range" };
  }

  const referenceDate = new Date(`${to}T00:00:00`);
  const key = input?.range || "30d";
  if (key === "7d") {
    return {
      from: formatIsoDate(new Date(referenceDate.getTime() - 6 * 86400000)),
      to,
      label: "Last 7 days",
    };
  }
  if (key === "month") {
    return {
      from: `${referenceDate.getFullYear()}-${pad(referenceDate.getMonth() + 1)}-01`,
      to,
      label: "This month",
    };
  }
  if (key === "year") {
    return { from: `${referenceDate.getFullYear()}-01-01`, to, label: "This year" };
  }
  return {
    from: formatIsoDate(new Date(referenceDate.getTime() - 29 * 86400000)),
    to,
    label: "Last 30 days",
  };
}

export function previousPeriod(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
  const prevTo = new Date(fromDate.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { previousFrom: formatIsoDate(prevFrom), previousTo: formatIsoDate(prevTo) };
}

export function buildTrend(current: number, previous: number): DashboardTrend {
  if (previous === 0 && current === 0) {
    return { current, previous, changePercent: null, direction: "flat" };
  }
  if (previous === 0) {
    return { current, previous, changePercent: null, direction: current > 0 ? "up" : "flat" };
  }
  const changePercent = Math.round(((current - previous) / previous) * 1000) / 10;
  return {
    current,
    previous,
    changePercent,
    direction: changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat",
  };
}

function normalizeStatus(raw: string | null | undefined) {
  const value = String(raw || "Draft").trim();
  const lower = value.toLowerCase();
  if (lower === "published" || lower === "active") return "Published";
  if (lower === "archived" || lower === "disabled") return "Archived";
  if (lower === "processing") return "Processing";
  if (lower === "failed" || lower === "error") return "Failed";
  return "Draft";
}

function classifyStorageFile(fileName: string): "models" | "textures" | "posters" | "other" {
  const lower = fileName.toLowerCase();
  if (/poster\.(png|jpe?g|webp)$/.test(lower)) return "posters";
  if (/\.(glb|gltf|usdz)$/.test(lower)) return "models";
  if (/\.(png|jpe?g|webp)$/.test(lower)) return "textures";
  return "other";
}

async function getStorageBreakdown(customerUid: string) {
  const breakdown = { modelsMb: 0, texturesMb: 0, postersMb: 0, otherMb: 0 };

  try {
    const rows = await query<{ file_path: string | null; size_bytes: number }>(
      "SELECT file_path, size_bytes FROM product_assets WHERE customer_uid = ?",
      [customerUid],
    );
    if (rows.length) {
      for (const row of rows) {
        const mb = Number(row.size_bytes || 0) / 1024 / 1024;
        const bucket = classifyStorageFile(path.basename(String(row.file_path || "")));
        if (bucket === "models") breakdown.modelsMb += mb;
        else if (bucket === "textures") breakdown.texturesMb += mb;
        else if (bucket === "posters") breakdown.postersMb += mb;
        else breakdown.otherMb += mb;
      }
      return breakdown;
    }
  } catch {
    // fall through to disk walk
  }

  try {
    const storageRoot = resolveStorageRoot();
    const productsRoot = path.resolve(storageRoot, customerUid, "Products");
    if (!productsRoot.startsWith(storageRoot + path.sep)) return breakdown;

    async function walk(dir: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(full);
            const mb = stat.size / 1024 / 1024;
            const bucket = classifyStorageFile(entry.name);
            if (bucket === "models") breakdown.modelsMb += mb;
            else if (bucket === "textures") breakdown.texturesMb += mb;
            else if (bucket === "posters") breakdown.postersMb += mb;
            else breakdown.otherMb += mb;
          } catch {
            // skip
          }
        }
      }
    }

    await walk(productsRoot);
  } catch {
    // ignore
  }

  return breakdown;
}

async function countProducts(customerUid: string) {
  try {
    const rows = await query<{ total: number }>(
      "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",
      [customerUid],
    );
    return Number(rows[0]?.total || 0);
  } catch {
    const rows = await query<{ total: number }>(
      "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ?",
      [customerUid],
    );
    return Number(rows[0]?.total || 0);
  }
}

async function countProductsCreatedBetween(customerUid: string, from: string, to: string) {
  try {
    const rows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM products
       WHERE customer_uid = ? AND deleted_at IS NULL
         AND created_at >= ? AND created_at <= ?`,
      [customerUid, `${from} 00:00:00`, `${to} 23:59:59`],
    );
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function getDailyChartSeries(customerUid: string, from: string, to: string): Promise<DashboardDailyPoint[]> {
  const rows = await query<{ date: string; views: number; ar_launches: number; qr_scans: number }>(
    `SELECT date,
            SUM(views) AS views,
            SUM(ar_launches) AS ar_launches,
            SUM(qr_scans) AS qr_scans
       FROM analytics_daily
      WHERE customer_uid = ? AND date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC`,
    [customerUid, from, to],
  ).catch(() => []);

  const map = new Map<string, DashboardDailyPoint>();
  for (const row of rows) {
    map.set(row.date, {
      date: row.date,
      views: Number(row.views || 0),
      arOpens: Number(row.ar_launches || 0),
      qrScans: Number(row.qr_scans || 0),
    });
  }

  const points: DashboardDailyPoint[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    const key = formatIsoDate(cursor);
    points.push(map.get(key) || { date: key, views: 0, arOpens: 0, qrScans: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

async function getTopProductsForRange(
  customerUid: string,
  from: string,
  to: string,
  limit = 5,
): Promise<DashboardTopProduct[]> {
  const rows = await query<{
    product_uid: string;
    title: string;
    category: string | null;
    poster: string | null;
    thumbnail_url: string | null;
    views: number;
    ar_opens: number;
    qr_scans: number;
  }>(
    `SELECT
       p.id AS product_uid,
       p.title,
       p.category,
       p.poster,
       p.thumbnail_url,
       SUM(CASE WHEN e.event = 'viewer_open' THEN 1 ELSE 0 END) AS views,
       SUM(CASE WHEN e.event = 'ar_launch_success' THEN 1 ELSE 0 END) AS ar_opens,
       SUM(CASE WHEN e.event IN ('qr_scan','download_qr') THEN 1 ELSE 0 END) AS qr_scans
     FROM analytics_events e
     INNER JOIN products p ON p.id = e.product_uid AND p.customer_uid = e.customer_uid
     WHERE e.customer_uid = ?
       AND e.created_at >= ? AND e.created_at <= ?
       AND p.deleted_at IS NULL
     GROUP BY p.id, p.title, p.category, p.poster, p.thumbnail_url
     ORDER BY views DESC, ar_opens DESC
     LIMIT ?`,
    [customerUid, `${from} 00:00:00`, `${to} 23:59:59`, limit],
  ).catch(() => []);

  return rows.map((row) => ({
    productUid: row.product_uid,
    title: row.title || row.product_uid,
    category: row.category || "Uncategorized",
    thumbnailUrl: row.thumbnail_url || row.poster || null,
    views: Number(row.views || 0),
    arOpens: Number(row.ar_opens || 0),
    qrScans: Number(row.qr_scans || 0),
  }));
}

async function getProductsByStatus(customerUid: string) {
  const rows = await query<{ status: string; total: number }>(
    `SELECT status, COUNT(*) AS total
       FROM products
      WHERE customer_uid = ? AND deleted_at IS NULL
      GROUP BY status`,
    [customerUid],
  ).catch(() => []);

  const grouped = new Map<string, number>();
  for (const row of rows) {
    const status = normalizeStatus(row.status);
    grouped.set(status, (grouped.get(status) || 0) + Number(row.total || 0));
  }

  const total = Array.from(grouped.values()).reduce((sum, n) => sum + n, 0);
  return STATUS_ORDER.map((status) => {
    const count = grouped.get(status) || 0;
    return {
      status,
      count,
      percent: total ? Math.round((count / total) * 1000) / 10 : 0,
    };
  });
}

async function getRecentActivity(customerUid: string, limit = 4): Promise<DashboardActivityItem[]> {
  const items: DashboardActivityItem[] = [];

  const [products, qrs, notifications, shares] = await Promise.all([
    query<{
      id: string;
      title: string;
      status: string;
      created_at: string;
      updated_at: string;
      published_at: string | null;
    }>(
      `SELECT id, title, status, created_at, updated_at, published_at
         FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 8`,
      [customerUid],
    ).catch(() => []),
    query<{ id: number; product_id: string; name: string; created_at: string }>(
      `SELECT id, product_id, name, created_at
         FROM product_qr_codes
        WHERE customer_uid = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5`,
      [customerUid],
    ).catch(() => []),
    query<{ notification_uid: string; title: string; body: string; href: string | null; created_at: string }>(
      `SELECT notification_uid, title, body, href, created_at
         FROM customer_notifications
        WHERE customer_uid = ?
        ORDER BY created_at DESC
        LIMIT 5`,
      [customerUid],
    ).catch(() => []),
    query<{ share_uid: string; product_id: string; link_type: string; created_at: string }>(
      `SELECT share_uid, product_id, link_type, created_at
         FROM share_links
        WHERE customer_uid = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5`,
      [customerUid],
    ).catch(() => []),
  ]);

  for (const product of products) {
    const status = normalizeStatus(product.status);
    const publishedAt = product.published_at;
    const updatedAt = product.updated_at;
    const createdAt = product.created_at;

    let title = "Product uploaded";
    let type = "product_uploaded";
    let occurredAt = createdAt;

    if (publishedAt && (!updatedAt || new Date(publishedAt) >= new Date(updatedAt))) {
      title = "Product published";
      type = "product_published";
      occurredAt = publishedAt;
    } else if (status === "Processing") {
      title = "Product processing";
      type = "product_processing";
      occurredAt = updatedAt || createdAt;
    } else if (updatedAt && updatedAt !== createdAt) {
      title = "Product updated";
      type = "product_updated";
      occurredAt = updatedAt;
    }

    items.push({
      id: `${type}-${product.id}-${occurredAt}`,
      type,
      title,
      description: product.title || product.id,
      href: `/dashboard/products/${encodeURIComponent(product.id)}`,
      occurredAt,
    });
  }

  for (const qr of qrs) {
    items.push({
      id: `qr-${qr.id}`,
      type: "qr_generated",
      title: "QR code generated",
      description: qr.name || qr.product_id,
      href: "/dashboard/qr-center",
      occurredAt: qr.created_at,
    });
  }

  for (const share of shares) {
    items.push({
      id: `share-${share.share_uid}`,
      type: "share_created",
      title: "Share link created",
      description: `${share.link_type} · ${share.product_id}`,
      href: "/dashboard/share-center",
      occurredAt: share.created_at,
    });
  }

  for (const note of notifications) {
    items.push({
      id: `note-${note.notification_uid}`,
      type: "notification",
      title: note.title,
      description: note.body,
      href: note.href,
      occurredAt: note.created_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit);
}

export async function getUserDashboardOverview(input: {
  customerUid: string;
  userName: string;
  range?: DashboardRangeKey | null;
  from?: string | null;
  to?: string | null;
}): Promise<DashboardOverviewData> {
  const resolvedRange = resolveDashboardRange(input);
  const { fromDate, toDate } = buildDateRange(resolvedRange.from, resolvedRange.to);
  const { previousFrom, previousTo } = previousPeriod(fromDate, toDate);

  const [
    entitlements,
    totalProducts,
    productsCurrentPeriod,
    productsPreviousPeriod,
    currentAnalytics,
    previousAnalytics,
    breakdown,
    daily,
    topProducts,
    productsByStatus,
    recentActivity,
  ] = await Promise.all([
    getCustomerEntitlements(input.customerUid),
    countProducts(input.customerUid),
    countProductsCreatedBetween(input.customerUid, fromDate, toDate),
    countProductsCreatedBetween(input.customerUid, previousFrom, previousTo),
    getSummaryCounts({ customerUid: input.customerUid, from: fromDate, to: toDate }),
    getSummaryCounts({ customerUid: input.customerUid, from: previousFrom, to: previousTo }),
    getStorageBreakdown(input.customerUid),
    getDailyChartSeries(input.customerUid, fromDate, toDate),
    getTopProductsForRange(input.customerUid, fromDate, toDate),
    getProductsByStatus(input.customerUid),
    getRecentActivity(input.customerUid),
  ]);

  const planId = entitlements.planSlug;
  const limits = await resolvePlanLimits(planId);
  const usedMb = entitlements.usage.storageBytes / (1024 * 1024);
  const bandwidthUsedMb = entitlements.usage.bandwidthBytes / (1024 * 1024);
  const storageLimit = limits.unlimitedStorage ? null : limits.storageMb;
  const storagePercent =
    storageLimit && storageLimit > 0 ? Math.min(100, Math.round((usedMb / storageLimit) * 100)) : 0;

  return {
    user: { name: input.userName },
    range: {
      from: fromDate,
      to: toDate,
      previousFrom,
      previousTo,
      label: resolvedRange.label,
    },
    metrics: {
      totalProducts: {
        total: totalProducts,
        trend: buildTrend(productsCurrentPeriod, productsPreviousPeriod),
      },
      totalViews: buildTrend(currentAnalytics.totalViews, previousAnalytics.totalViews),
      arOpens: buildTrend(currentAnalytics.arLaunches, previousAnalytics.arLaunches),
      qrScans: buildTrend(currentAnalytics.qrScans, previousAnalytics.qrScans),
      storageUsedMb: {
        current: Math.round(usedMb * 10) / 10,
        limitMb: storageLimit,
        percent: storagePercent,
      },
    },
    chart: { daily },
    recentActivity,
    topProducts,
    productsByStatus,
    storage: {
      usedMb: Math.round(usedMb * 10) / 10,
      limitMb: storageLimit,
      breakdown: {
        modelsMb: Math.round(breakdown.modelsMb * 10) / 10,
        texturesMb: Math.round(breakdown.texturesMb * 10) / 10,
        postersMb: Math.round(breakdown.postersMb * 10) / 10,
        otherMb: Math.round(breakdown.otherMb * 10) / 10,
      },
    },
    bandwidth: {
      usedMb: Math.round(bandwidthUsedMb * 10) / 10,
      limitGb: limits.unlimitedBandwidth ? null : limits.bandwidthGb ?? null,
    },
    subscription: {
      planId,
      planName: entitlements.planName,
      status: entitlements.subscriptionStatus,
    },
  };
}
