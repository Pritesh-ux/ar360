import { query } from "@/lib/db";
import { buildDateRange } from "@/server/analytics/analytics.middleware";
import { getSummaryCounts, getDeviceBreakdown, getBrowserBreakdown, getTopCountries, getTopProducts } from "@/server/analytics/analytics.repository";

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

  const qrRows = await query<{ scans: number }>(
    `SELECT COALESCE(SUM(scans),0) AS scans FROM product_qr_codes
     WHERE customer_uid = ? AND deleted_at IS NULL`,
    [input.customerUid],
  );

  const shareRows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(view_count),0) AS views FROM share_links
     WHERE customer_uid = ? AND deleted_at IS NULL`,
    [input.customerUid],
  );

  const embedRows = await query<{ views: number }>(
    `SELECT COALESCE(SUM(view_count),0) AS views FROM product_embed_configs WHERE customer_uid = ?`,
    [input.customerUid],
  );

  const ctaRows = await query<{ clicks: number }>(
    `SELECT COUNT(*) AS clicks FROM analytics_events
     WHERE customer_uid = ? AND event = 'cta_click' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
    [input.customerUid, fromDate, toDate],
  );

  const sourceRows = await query<{ source: string; count: number }>(
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
     WHERE customer_uid = ? AND event IN ('viewer_open','open_embed') AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY source ORDER BY count DESC`,
    [input.customerUid, fromDate, toDate],
  );

  return {
    totalViews: counts.totalViews,
    uniqueVisitors: counts.uniqueVisitors,
    qrScans: Number(qrRows[0]?.scans || counts.qrScans || 0),
    shareViews: Number(shareRows[0]?.views || 0),
    embedViews: Number(embedRows[0]?.views || 0),
    arLaunches: counts.arLaunches,
    ctaClicks: Number(ctaRows[0]?.clicks || 0),
    trafficSources: sourceRows,
    topProducts: topProducts.map((p) => ({ productUid: p.productUid, title: p.title, views: p.views })),
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
  const overview = await getGrowthOverview({ ...input, customerUid: input.customerUid });
  const filter = { customerUid: input.customerUid, productUid: input.productUid, from: input.from, to: input.to };
  const counts = await getSummaryCounts(filter);

  const qr = await query<{ scans: number; unique_scans: number; last_scan_at: string | null }>(
    `SELECT scans, unique_scans, last_scan_at FROM product_qr_codes WHERE product_id = ? AND customer_uid = ? LIMIT 1`,
    [input.productUid, input.customerUid],
  );

  return {
    views: counts.totalViews,
    uniqueVisitors: counts.uniqueVisitors,
    arLaunches: counts.arLaunches,
    qrScans: Number(qr[0]?.scans || 0),
    qrUniqueScans: Number(qr[0]?.unique_scans || 0),
    lastQrScan: qr[0]?.last_scan_at || null,
    devices: await getDeviceBreakdown(filter),
    browsers: await getBrowserBreakdown(filter),
    countries: await getTopCountries(filter),
  };
}
