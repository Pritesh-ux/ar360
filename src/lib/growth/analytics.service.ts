import { query } from "@/lib/db";
import { buildDateRange } from "@/server/analytics/analytics.middleware";
import {
  getSummaryCounts,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getTopCountries,
  getTopProducts,
} from "@/server/analytics/analytics.repository";
import { resolveProductId } from "@/server/products/product-resolver";

export type GrowthOverview = {
  totalViews: number;
  uniqueVisitors: number;
  qrScans: number;
  shareViews: number;
  embedViews: number;
  arLaunches: number;
  ctaClicks: number;
  trafficSources: Array<{ source: string; count: number }>;
  topProducts: Array<{ productUid: string; title: string; views: number }>;
  topCountries: Array<{ country: string; views: number }>;
  devices: Array<{ device: string; views: number }>;
  browsers: Array<{ browser: string; views: number }>;
};

export async function getGrowthOverview(input: {
  customerUid: string;
  from?: string;
  to?: string;
}): Promise<GrowthOverview> {
  const { fromDate, toDate } = buildDateRange(input.from, input.to);
  const filter = { customerUid: input.customerUid, from: fromDate, to: toDate };

  const [counts, devices, browsers, countries, topProducts] = await Promise.all([
    getSummaryCounts(filter),
    getDeviceBreakdown(filter),
    getBrowserBreakdown(filter),
    getTopCountries(filter),
    getTopProducts(filter),
  ]);

  // Shares / CTAs from the same analytics_events stream (date-ranged).
  const [shareRows, ctaRows, sourceRows] = await Promise.all([
    query<{ views: number }>(
      `SELECT COUNT(*) AS views FROM analytics_events
       WHERE customer_uid = ? AND event = 'share_view'
         AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [input.customerUid, fromDate, toDate],
    ),
    query<{ clicks: number }>(
      `SELECT COUNT(*) AS clicks FROM analytics_events
       WHERE customer_uid = ? AND event = 'cta_click'
         AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [input.customerUid, fromDate, toDate],
    ),
    query<{ source: string; count: number }>(
      `SELECT
         CASE
           WHEN JSON_UNQUOTE(JSON_EXTRACT(meta, '$.trafficSource')) = 'qr' THEN 'qr'
           WHEN JSON_UNQUOTE(JSON_EXTRACT(meta, '$.trafficSource')) = 'share' THEN 'share'
           WHEN JSON_UNQUOTE(JSON_EXTRACT(meta, '$.trafficSource')) = 'embed' THEN 'embed'
           WHEN referrer IN ('direct','') OR referrer IS NULL THEN 'direct'
           WHEN referrer LIKE '%http%' THEN 'website'
           ELSE 'unknown'
         END AS source,
         COUNT(*) AS count
       FROM analytics_events
       WHERE customer_uid = ?
         AND event IN ('viewer_open','open_embed')
         AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY source ORDER BY count DESC`,
      [input.customerUid, fromDate, toDate],
    ),
  ]);

  return {
    totalViews: counts.totalViews,
    uniqueVisitors: counts.uniqueVisitors,
    // Always from ranged analytics_events — never lifetime product_qr_codes.scans
    qrScans: counts.qrScans,
    shareViews: Number(shareRows[0]?.views || 0),
    embedViews: counts.embedViews,
    arLaunches: counts.arLaunches,
    ctaClicks: Number(ctaRows[0]?.clicks || 0),
    trafficSources: sourceRows,
    topProducts: topProducts.map((p) => ({
      productUid: p.productUid,
      title: p.title,
      views: p.views,
    })),
    topCountries: countries.map((c) => ({ country: c.country, views: c.views })),
    devices: devices.map((d) => ({ device: d.device, views: d.views })),
    browsers: browsers.map((b) => ({ browser: b.browser, views: b.views })),
  };
}

export async function getProductGrowthAnalytics(input: {
  customerUid: string;
  productUid: string;
  from?: string;
  to?: string;
}) {
  const productId =
    (await resolveProductId(input.productUid).catch(() => null)) || input.productUid;
  const { fromDate, toDate } = buildDateRange(input.from, input.to);
  const filter = {
    customerUid: input.customerUid,
    productUid: productId,
    from: fromDate,
    to: toDate,
  };
  const counts = await getSummaryCounts(filter);

  // Projection counters for QR detail UI only (not dashboard KPI truth).
  const qr = await query<{
    scans: number;
    unique_scans: number;
    last_scan_at: string | null;
  }>(
    `SELECT scans, unique_scans, last_scan_at FROM product_qr_codes
     WHERE product_id = ? AND customer_uid = ? LIMIT 1`,
    [productId, input.customerUid],
  );

  return {
    views: counts.totalViews,
    uniqueVisitors: counts.uniqueVisitors,
    arLaunches: counts.arLaunches,
    qrScans: counts.qrScans,
    qrUniqueScans: Number(qr[0]?.unique_scans || 0),
    qrLifetimeScans: Number(qr[0]?.scans || 0),
    lastQrScan: qr[0]?.last_scan_at || null,
    devices: await getDeviceBreakdown(filter),
    browsers: await getBrowserBreakdown(filter),
    countries: await getTopCountries(filter),
  };
}
