import { query } from "@/lib/db";
import { productCode } from "@/components/features/master-admin/products-utils";
import { paginationMeta } from "@/lib/master-admin/pagination";
import {
  getAvgSessionDuration,
  getBounceRate,
  getBrowserBreakdown,
  getDailySeries,
  getDeviceBreakdown,
  getReferrerBreakdown,
  getSummaryCounts,
  getTopCountries,
} from "@/server/analytics/analytics.repository";
import { buildDateRange } from "@/server/analytics/analytics.middleware";
import type { AnalyticsFilter } from "@/server/analytics/analytics.types";

export type ViewerAnalyticsQuery = {
  from?: string;
  to?: string;
  customerUid?: string;
  productUid?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

function fmtDuration(seconds: number) {
  if (!seconds || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return n.toLocaleString("en-IN");
  return String(n);
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousPeriod(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000);
  return { fromDate: toDateString(prevFrom), toDate: toDateString(prevTo) };
}

function trendLabel(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? { label: "New in period", up: true } : { label: "No change", up: true };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  return {
    label: `${pct >= 0 ? "↑" : "↓"} ${rounded}% vs prior period`,
    up: pct >= 0,
  };
}

function buildEventConditions(filter: AnalyticsFilter, search?: string, alias = "e") {
  const conditions: string[] = [
    `${alias}.created_at >= ?`,
    `${alias}.created_at <= ?`,
  ];
  const values: (string | number)[] = [`${filter.from} 00:00:00`, `${filter.to} 23:59:59`];

  if (filter.customerUid) {
    conditions.push(`${alias}.customer_uid = ?`);
    values.push(filter.customerUid);
  }
  if (filter.productUid) {
    conditions.push(`${alias}.product_uid = ?`);
    values.push(filter.productUid);
  }
  if (search?.trim()) {
    conditions.push(`(p.title LIKE ? OR p.id LIKE ? OR c.contact_name LIKE ? OR c.email LIKE ?)`);
    const like = `%${search.trim()}%`;
    values.push(like, like, like, like);
  }

  return { conditions, values };
}

async function getMonthlySeries(filter: AnalyticsFilter) {
  const aggConditions: string[] = [];
  const values: (string | number)[] = [];
  if (filter.customerUid) {
    aggConditions.push("customer_uid = ?");
    values.push(filter.customerUid);
  }
  if (filter.productUid) {
    aggConditions.push("product_uid = ?");
    values.push(filter.productUid);
  }
  const aggWhere = aggConditions.length ? `WHERE ${aggConditions.join(" AND ")}` : "";

  const rows = await query<{ label: string; value: number }>(`
    SELECT DATE_FORMAT(d.month_start, '%b') AS label, COALESCE(ad.views, 0) AS value
    FROM (
      SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL seq MONTH), '%Y-%m-01') AS month_start
      FROM (
        SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
        UNION ALL SELECT 10 UNION ALL SELECT 11
      ) m
    ) d
    LEFT JOIN (
      SELECT DATE_FORMAT(date, '%Y-%m-01') AS month_start, SUM(views) AS views
      FROM analytics_daily
      ${aggWhere}
      GROUP BY DATE_FORMAT(date, '%Y-%m-01')
    ) ad ON ad.month_start = d.month_start
    ORDER BY d.month_start
  `, values);

  return rows.map((row) => ({ label: row.label, value: Number(row.value || 0) }));
}

async function getProductRanking(
  filter: AnalyticsFilter,
  search: string | undefined,
  page: number,
  pageSize: number,
) {
  const { conditions, values } = buildEventConditions(filter, search);
  const clause = `WHERE ${conditions.join(" AND ")}`;
  const needsJoin = Boolean(search?.trim());

  const joinSql = needsJoin
    ? `LEFT JOIN products p ON p.id = e.product_uid LEFT JOIN customers c ON c.customer_uid = e.customer_uid`
    : `LEFT JOIN products p ON p.id = e.product_uid LEFT JOIN customers c ON c.customer_uid = e.customer_uid`;

  const [countRows, rows, sessionRows, bounceRows] = await Promise.all([
    query<{ total: number }>(`
      SELECT COUNT(DISTINCT e.product_uid) AS total
      FROM analytics_events e
      ${joinSql}
      ${clause}
    `, values),

    query<any>(`
      SELECT
        e.product_uid AS id,
        COALESCE(p.title, e.product_uid) AS name,
        COALESCE(p.poster, p.thumbnail_url, '') AS poster,
        COALESCE(c.contact_name, 'Unknown') AS owner,
        COUNT(*) AS views,
        SUM(e.event IN ('ar_launch_success','ar_button_click')) AS arOpens,
        SUM(e.event IN ('download_qr','qr_scan')) AS qrScans
      FROM analytics_events e
      ${joinSql}
      ${clause}
      GROUP BY e.product_uid, p.title, p.poster, p.thumbnail_url, c.contact_name
      ORDER BY views DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, (page - 1) * pageSize]),

    query<{ product_uid: string; avgSeconds: number }>(`
      SELECT product_uid, ROUND(AVG(duration)) AS avgSeconds
      FROM analytics_sessions
      WHERE started_at >= ? AND started_at <= ?
        AND duration IS NOT NULL
        ${filter.customerUid ? "AND customer_uid = ?" : ""}
        ${filter.productUid ? "AND product_uid = ?" : ""}
      GROUP BY product_uid
    `, [
      `${filter.from} 00:00:00`,
      `${filter.to} 23:59:59`,
      ...(filter.customerUid ? [filter.customerUid] : []),
      ...(filter.productUid ? [filter.productUid] : []),
    ]).catch(() => []),

    query<{ product_uid: string; total: number; bounced: number }>(`
      SELECT product_uid, COUNT(*) AS total, SUM(cnt = 1) AS bounced
      FROM (
        SELECT e.product_uid, e.session_id, COUNT(*) AS cnt
        FROM analytics_events e
        ${needsJoin ? joinSql : ""}
        ${clause}
        GROUP BY e.product_uid, e.session_id
      ) sub
      GROUP BY product_uid
    `, values).catch(() => []),
  ]);

  const sessionMap = Object.fromEntries(sessionRows.map((r) => [r.product_uid, Number(r.avgSeconds || 0)]));
  const bounceMap = Object.fromEntries(
    bounceRows.map((r) => [
      r.product_uid,
      Number(r.total) > 0 ? Math.round((Number(r.bounced) / Number(r.total)) * 100) : 0,
    ]),
  );

  const totalViews = rows.reduce((sum, row) => sum + Number(row.views || 0), 0) || 1;

  const items = rows.map((row: any, index: number) => {
    const views = Number(row.views || 0);
    const id = String(row.id);
    return {
      rank: (page - 1) * pageSize + index + 1,
      id,
      name: String(row.name),
      code: productCode(id),
      poster: row.poster || "",
      owner: String(row.owner || "Unknown"),
      views,
      arOpens: Number(row.arOpens || 0),
      qrScans: Number(row.qrScans || 0),
      avgSessionTime: fmtDuration(sessionMap[id] || 0),
      avgSessionSeconds: sessionMap[id] || 0,
      bounceRate: bounceMap[id] ?? 0,
      shareOfViews: Math.round((views / totalViews) * 1000) / 10,
    };
  });

  return {
    items,
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
  };
}

async function getDailySummaryFallback(filter: AnalyticsFilter) {
  const conditions: string[] = ["date >= ?", "date <= ?"];
  const values: (string | number)[] = [filter.from!, filter.to!];
  if (filter.customerUid) {
    conditions.push("customer_uid = ?");
    values.push(filter.customerUid);
  }
  if (filter.productUid) {
    conditions.push("product_uid = ?");
    values.push(filter.productUid);
  }

  const rows = await query<{ totalViews: number; totalAr: number; totalQr: number }>(`
    SELECT
      COALESCE(SUM(views), 0) AS totalViews,
      COALESCE(SUM(ar_launches), 0) AS totalAr,
      COALESCE(SUM(qr_scans), 0) AS totalQr
    FROM analytics_daily
    WHERE ${conditions.join(" AND ")}
  `, values);

  return rows[0] || { totalViews: 0, totalAr: 0, totalQr: 0 };
}

export async function getViewerAnalyticsDashboard(input: ViewerAnalyticsQuery) {
  const { fromDate, toDate } = buildDateRange(input.from, input.to);
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(50, Math.max(5, Number(input.pageSize || 10)));

  const filter: AnalyticsFilter = {
    from: fromDate,
    to: toDate,
    customerUid: input.customerUid || undefined,
    productUid: input.productUid || undefined,
  };

  const prev = previousPeriod(fromDate, toDate);
  const prevFilter: AnalyticsFilter = { ...filter, from: prev.fromDate, to: prev.toDate };

  const [
    counts,
    prevCounts,
    avgSessionDuration,
    prevAvgSession,
    bounceRate,
    prevBounceRate,
    daily,
    devices,
    browsers,
    countries,
    referrers,
    monthlyViews,
    productRanking,
    dailyFallback,
    realtimeRows,
  ] = await Promise.all([
    getSummaryCounts(filter),
    getSummaryCounts(prevFilter),
    getAvgSessionDuration(filter),
    getAvgSessionDuration(prevFilter),
    getBounceRate(filter),
    getBounceRate(prevFilter),
    getDailySeries(filter),
    getDeviceBreakdown(filter),
    getBrowserBreakdown(filter),
    getTopCountries(filter, 8),
    getReferrerBreakdown(filter),
    getMonthlySeries(filter),
    getProductRanking(filter, input.search, page, pageSize),
    getDailySummaryFallback(filter),
    query<{ activeViewers: number; viewsLastHour: number }>(`
      SELECT
        (SELECT COUNT(DISTINCT session_id) FROM analytics_events
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)) AS activeViewers,
        (SELECT COUNT(*) FROM analytics_events
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
           AND event IN ('viewer_open','open_embed')) AS viewsLastHour
    `).catch(() => [{ activeViewers: 0, viewsLastHour: 0 }]),
  ]);

  let totalViews = Number(counts.totalViews || 0);
  let arOpens = Number(counts.arLaunches || 0);
  let qrScans = Number(counts.qrScans || 0);

  if (totalViews === 0 && dailyFallback) {
    totalViews = Number(dailyFallback.totalViews || 0);
    arOpens = Number(dailyFallback.totalAr || 0);
    qrScans = Number(dailyFallback.totalQr || 0);
  }

  const viewsTrend = trendLabel(totalViews, Number(prevCounts.totalViews || 0));
  const arTrend = trendLabel(arOpens, Number(prevCounts.arLaunches || 0));
  const qrTrend = trendLabel(qrScans, Number(prevCounts.qrScans || 0));
  const sessionTrend = trendLabel(avgSessionDuration, prevAvgSession);
  const bounceTrend = trendLabel(bounceRate, prevBounceRate);

  const dailyViews = daily.map((row) => ({
    label: row.date.slice(5),
    value: row.views,
    arLaunches: row.arLaunches,
    qrScans: 0,
  }));

  const dailyAr = daily.map((row) => row.arLaunches);

  const dailyQrRows = await query<{ date: string; qr: number }>(`
    SELECT date, SUM(qr_scans) AS qr FROM analytics_daily
    WHERE date >= ? AND date <= ?
    ${filter.customerUid ? "AND customer_uid = ?" : ""}
    ${filter.productUid ? "AND product_uid = ?" : ""}
    GROUP BY date ORDER BY date ASC
  `, [
    fromDate,
    toDate,
    ...(filter.customerUid ? [filter.customerUid] : []),
    ...(filter.productUid ? [filter.productUid] : []),
  ]).catch(() => []);

  const qrByDate = Object.fromEntries(dailyQrRows.map((r) => [r.date.slice(5), Number(r.qr || 0)]));
  dailyViews.forEach((row) => {
    row.qrScans = qrByDate[row.label] ?? 0;
  });

  const shareBase = Math.max(totalViews, 1);
  const rankedProducts = productRanking.items.map((row) => ({
    ...row,
    shareOfViews: Math.round((row.views / shareBase) * 1000) / 10,
  }));

  return {
    summary: {
      totalViews,
      arOpens,
      qrScans,
      uniqueVisitors: Number(counts.uniqueVisitors || 0),
      avgSessionTime: fmtDuration(avgSessionDuration),
      avgSessionSeconds: avgSessionDuration,
      bounceRate,
      totalViewsFmt: fmtCount(totalViews),
      arOpensFmt: fmtCount(arOpens),
      qrScansFmt: fmtCount(qrScans),
      trends: {
        views: viewsTrend,
        arOpens: arTrend,
        qrScans: qrTrend,
        avgSession: { ...sessionTrend, label: sessionTrend.label.replace("vs prior period", "vs prior period duration") },
        bounceRate: {
          label: `${bounceRate <= prevBounceRate ? "↓" : "↑"} ${Math.abs(Math.round((bounceRate - prevBounceRate) * 10) / 10)} pts vs prior period`,
          up: bounceRate <= prevBounceRate,
        },
      },
      sparklines: {
        views: dailyViews.map((r) => r.value),
        arOpens: dailyAr,
        qrScans: dailyViews.map((r) => r.qrScans),
        avgSession: dailyViews.map(() => avgSessionDuration),
        bounceRate: dailyViews.map(() => bounceRate),
      },
    },
    realtime: {
      activeViewers: Number(realtimeRows[0]?.activeViewers || 0),
      viewsLastHour: Number(realtimeRows[0]?.viewsLastHour || 0),
    },
    dailyViews,
    monthlyViews,
    devices,
    browsers,
    countries,
    trafficSources: referrers.slice(0, 8),
    productRanking: rankedProducts,
    pagination: productRanking.pagination,
    range: { from: fromDate, to: toDate },
  };
}

export function buildViewerAnalyticsCsv(data: Awaited<ReturnType<typeof getViewerAnalyticsDashboard>>) {
  const header = [
    "Rank",
    "Product",
    "Product ID",
    "Owner",
    "Views",
    "AR Opens",
    "QR Scans",
    "Avg Session",
    "Bounce Rate %",
    "Share of Views %",
  ];
  const rows = data.productRanking.map((row) => [
    row.rank,
    row.name,
    row.code,
    row.owner,
    row.views,
    row.arOpens,
    row.qrScans,
    row.avgSessionTime,
    row.bounceRate,
    row.shareOfViews,
  ]);
  return [header, ...rows]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
