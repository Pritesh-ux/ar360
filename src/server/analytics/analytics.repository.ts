import { query } from "@/lib/db";
import type {
  AnalyticsEventRow,
  AnalyticsFilter,
  AnalyticsSessionRow,
  BrowserBreakdown,
  BrowserName,
  DailyPoint,
  DeviceBreakdown,
  DeviceType,
  OSBreakdown,
  OSName,
  ReferrerBreakdown,
  TopCountry,
  TopProduct,
} from "./analytics.types";
import type { QueryValue } from "@/lib/db";

// ─── Insert event ─────────────────────────────────────────────────────────────

export interface InsertEventParams {
  customerUid: string;
  productUid: string;
  sessionId: string;
  event: string;
  device: DeviceType;
  browser: BrowserName;
  os: OSName;
  country: string;
  city: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  referrer: string;
  url: string;
  ipHash: string;
  meta: string;
}

export async function insertEvent(params: InsertEventParams): Promise<void> {
  await query(
    `INSERT INTO analytics_events
      (customer_uid, product_uid, session_id, event, device, browser, os,
       country, city, language, screen_width, screen_height, referrer, url,
       ip_hash, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      params.customerUid,
      params.productUid,
      params.sessionId,
      params.event,
      params.device,
      params.browser,
      params.os,
      params.country,
      params.city,
      params.language,
      params.screenWidth,
      params.screenHeight,
      params.referrer,
      params.url,
      params.ipHash,
      params.meta,
    ],
  );
}

// ─── Upsert session ───────────────────────────────────────────────────────────

export async function upsertSession(
  sessionId: string,
  customerUid: string,
  productUid: string,
  device: DeviceType,
  browser: BrowserName,
  os: OSName,
  country: string,
  city: string,
): Promise<void> {
  await query(
    `INSERT INTO analytics_sessions
       (session_id, customer_uid, product_uid, device, browser, os, country, city, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       ended_at = NOW(),
       duration = TIMESTAMPDIFF(SECOND, started_at, NOW())`,
    [sessionId, customerUid, productUid, device, browser, os, country, city],
  );
}

// ─── Upsert daily aggregation ─────────────────────────────────────────────────

export async function upsertDailyStats(
  customerUid: string,
  productUid: string,
  event: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Ensure row exists
  await query(
    `INSERT INTO analytics_daily
       (customer_uid, product_uid, date, views, unique_visitors, ar_launches,
        screenshots, shares, copy_links, qr_scans, avg_duration)
     VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)
     ON DUPLICATE KEY UPDATE date = date`,
    [customerUid, productUid, today],
  );

  const colMap: Record<string, string> = {
    viewer_open: "views",
    open_embed: "embed_views",
    ar_launch_success: "ar_launches",
    ar_button_click: "ar_launches",
    screenshot: "screenshots",
    share_native: "shares",
    copy_link: "copy_links",
    download_qr: "qr_scans",
    qr_scan: "qr_scans",
    cta_click: "cta_clicks",
  };

  const col = colMap[event];
  if (col) {
    await query(
      `UPDATE analytics_daily SET \`${col}\` = \`${col}\` + 1
       WHERE customer_uid = ? AND product_uid = ? AND date = ?`,
      [customerUid, productUid, today],
    );
  }
}

// ─── Build WHERE clause from filter ──────────────────────────────────────────

function buildWhere(
  filter: AnalyticsFilter,
  tableAlias = "e",
): { clause: string; values: QueryValue[] } {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) {
    conditions.push(`${tableAlias}.customer_uid = ?`);
    values.push(filter.customerUid);
  }
  if (filter.productUid) {
    conditions.push(`${tableAlias}.product_uid = ?`);
    values.push(filter.productUid);
  }
  if (filter.from) {
    conditions.push(`${tableAlias}.created_at >= ?`);
    values.push(`${filter.from} 00:00:00`);
  }
  if (filter.to) {
    conditions.push(`${tableAlias}.created_at <= ?`);
    values.push(`${filter.to} 23:59:59`);
  }
  if (filter.country) {
    conditions.push(`${tableAlias}.country = ?`);
    values.push(filter.country);
  }
  if (filter.device) {
    conditions.push(`${tableAlias}.device = ?`);
    values.push(filter.device);
  }
  if (filter.browser) {
    conditions.push(`${tableAlias}.browser = ?`);
    values.push(filter.browser);
  }
  if (filter.os) {
    conditions.push(`${tableAlias}.os = ?`);
    values.push(filter.os);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

// ─── Summary counts ───────────────────────────────────────────────────────────

export async function getSummaryCounts(filter: AnalyticsFilter): Promise<{
  totalViews: number;
  uniqueVisitors: number;
  arLaunches: number;
  screenshots: number;
  shares: number;
  copyLinks: number;
  qrScans: number;
}> {
  const { clause, values } = buildWhere(filter);

  const rows = await query<{
    totalViews: number;
    uniqueVisitors: number;
    arLaunches: number;
    screenshots: number;
    shares: number;
    copyLinks: number;
    qrScans: number;
  }>(
    `SELECT
       SUM(event IN ('viewer_open', 'open_embed')) AS totalViews,
       COUNT(DISTINCT ip_hash) AS uniqueVisitors,
       SUM(event IN ('ar_launch_success','ar_button_click')) AS arLaunches,
       SUM(event = 'screenshot') AS screenshots,
       SUM(event = 'share_native') AS shares,
       SUM(event = 'copy_link') AS copyLinks,
       SUM(event IN ('download_qr', 'qr_scan')) AS qrScans
     FROM analytics_events e
     ${clause}`,
    values,
  );

  const row = rows[0];
  return {
    totalViews: Number(row?.totalViews ?? 0),
    uniqueVisitors: Number(row?.uniqueVisitors ?? 0),
    arLaunches: Number(row?.arLaunches ?? 0),
    screenshots: Number(row?.screenshots ?? 0),
    shares: Number(row?.shares ?? 0),
    copyLinks: Number(row?.copyLinks ?? 0),
    qrScans: Number(row?.qrScans ?? 0),
  };
}

// ─── Returning visitors ───────────────────────────────────────────────────────

export async function getReturningVisitors(filter: AnalyticsFilter): Promise<number> {
  const { clause, values } = buildWhere(filter);
  const extra = clause ? " AND " : " WHERE ";
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM (
       SELECT ip_hash
       FROM analytics_events e ${clause}${extra}ip_hash IS NOT NULL AND ip_hash <> ''
       GROUP BY ip_hash HAVING COUNT(*) > 1
     ) sub`,
    values,
  );
  return Number(rows[0]?.total ?? 0);
}

// ─── Average session duration ─────────────────────────────────────────────────

export async function getAvgSessionDuration(filter: AnalyticsFilter): Promise<number> {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) { conditions.push("customer_uid = ?"); values.push(filter.customerUid); }
  if (filter.productUid) { conditions.push("product_uid = ?"); values.push(filter.productUid); }
  if (filter.from) { conditions.push("started_at >= ?"); values.push(`${filter.from} 00:00:00`); }
  if (filter.to) { conditions.push("started_at <= ?"); values.push(`${filter.to} 23:59:59`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")} AND duration IS NOT NULL` : "WHERE duration IS NOT NULL";

  const rows = await query<{ avg: number }>(
    `SELECT AVG(duration) AS avg FROM analytics_sessions ${where}`,
    values,
  );
  return Math.round(Number(rows[0]?.avg ?? 0));
}

// ─── Bounce rate ──────────────────────────────────────────────────────────────

export async function getBounceRate(filter: AnalyticsFilter): Promise<number> {
  const { clause, values } = buildWhere(filter);
  const rows = await query<{ total: number; bounced: number }>(
    `SELECT
       COUNT(DISTINCT session_id) AS total,
       SUM(cnt = 1) AS bounced
     FROM (
       SELECT session_id, COUNT(*) AS cnt
       FROM analytics_events e ${clause}
       GROUP BY session_id
     ) sub`,
    values,
  );
  const { total = 0, bounced = 0 } = rows[0] ?? {};
  if (Number(total) === 0) return 0;
  return Math.round((Number(bounced) / Number(total)) * 100);
}

// ─── Daily series ─────────────────────────────────────────────────────────────

export async function getDailySeries(filter: AnalyticsFilter): Promise<DailyPoint[]> {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) { conditions.push("customer_uid = ?"); values.push(filter.customerUid); }
  if (filter.productUid) { conditions.push("product_uid = ?"); values.push(filter.productUid); }
  if (filter.from) { conditions.push("date >= ?"); values.push(filter.from); }
  if (filter.to) { conditions.push("date <= ?"); values.push(filter.to); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<{ date: string; views: number; ar_launches: number; screenshots: number }>(
    `SELECT date, SUM(views) AS views, SUM(ar_launches) AS ar_launches, SUM(screenshots) AS screenshots
     FROM analytics_daily ${where}
     GROUP BY date ORDER BY date ASC`,
    values,
  );

  return rows.map((r) => ({
    date: r.date,
    views: Number(r.views ?? 0),
    arLaunches: Number(r.ar_launches ?? 0),
    screenshots: Number(r.screenshots ?? 0),
  }));
}

// ─── Top products ─────────────────────────────────────────────────────────────

export async function getTopProducts(filter: AnalyticsFilter, limit = 10): Promise<TopProduct[]> {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) { conditions.push("e.customer_uid = ?"); values.push(filter.customerUid); }
  if (filter.from) { conditions.push("e.created_at >= ?"); values.push(`${filter.from} 00:00:00`); }
  if (filter.to) { conditions.push("e.created_at <= ?"); values.push(`${filter.to} 23:59:59`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);

  const rows = await query<{
    product_uid: string;
    views: number;
    unique_visitors: number;
    ar_launches: number;
  }>(
    `SELECT
       e.product_uid,
       COUNT(*) AS views,
       COUNT(DISTINCT e.ip_hash) AS unique_visitors,
       SUM(e.event IN ('ar_launch_success','ar_button_click')) AS ar_launches
     FROM analytics_events e
     ${where}
     GROUP BY e.product_uid
     ORDER BY views DESC
     LIMIT ?`,
    values,
  );

  // Enrich with product title from products table
  const enriched: TopProduct[] = [];
  for (const row of rows) {
    const products = await query<{ title: string }>(
      "SELECT title FROM products WHERE id = ? OR customer_uid = ? LIMIT 1",
      [row.product_uid, row.product_uid],
    );
    enriched.push({
      productUid: row.product_uid,
      title: products[0]?.title ?? row.product_uid,
      views: Number(row.views ?? 0),
      uniqueVisitors: Number(row.unique_visitors ?? 0),
      arLaunches: Number(row.ar_launches ?? 0),
    });
  }
  return enriched;
}

// ─── Top countries ────────────────────────────────────────────────────────────

export async function getTopCountries(filter: AnalyticsFilter, limit = 10): Promise<TopCountry[]> {
  const { clause, values } = buildWhere(filter);
  values.push(limit);

  const rows = await query<{ country: string; views: number }>(
    `SELECT country, COUNT(*) AS views
     FROM analytics_events e ${clause}
     GROUP BY country ORDER BY views DESC LIMIT ?`,
    values,
  );

  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    country: r.country || "Unknown",
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

// ─── Device breakdown ─────────────────────────────────────────────────────────

export async function getDeviceBreakdown(filter: AnalyticsFilter): Promise<DeviceBreakdown[]> {
  const { clause, values } = buildWhere(filter);
  const rows = await query<{ device: DeviceType; views: number }>(
    `SELECT device, COUNT(*) AS views FROM analytics_events e ${clause} GROUP BY device ORDER BY views DESC`,
    values,
  );
  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    device: r.device,
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

// ─── Browser breakdown ────────────────────────────────────────────────────────

export async function getBrowserBreakdown(filter: AnalyticsFilter): Promise<BrowserBreakdown[]> {
  const { clause, values } = buildWhere(filter);
  const rows = await query<{ browser: BrowserName; views: number }>(
    `SELECT browser, COUNT(*) AS views FROM analytics_events e ${clause} GROUP BY browser ORDER BY views DESC`,
    values,
  );
  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    browser: r.browser,
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

// ─── OS breakdown ─────────────────────────────────────────────────────────────

export async function getOSBreakdown(filter: AnalyticsFilter): Promise<OSBreakdown[]> {
  const { clause, values } = buildWhere(filter);
  const rows = await query<{ os: OSName; views: number }>(
    `SELECT os, COUNT(*) AS views FROM analytics_events e ${clause} GROUP BY os ORDER BY views DESC`,
    values,
  );
  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    os: r.os,
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

// ─── Referrer breakdown ───────────────────────────────────────────────────────

export async function getReferrerBreakdown(filter: AnalyticsFilter): Promise<ReferrerBreakdown[]> {
  const { clause, values } = buildWhere(filter);
  const rows = await query<{ referrer: string; views: number }>(
    `SELECT referrer, COUNT(*) AS views FROM analytics_events e ${clause} GROUP BY referrer ORDER BY views DESC LIMIT 20`,
    values,
  );
  const total = rows.reduce((s, r) => s + Number(r.views), 0);
  return rows.map((r) => ({
    referrer: r.referrer || "direct",
    views: Number(r.views),
    percent: total > 0 ? Math.round((Number(r.views) / total) * 1000) / 10 : 0,
  }));
}

// ─── Raw events for export ────────────────────────────────────────────────────

export async function getRawEvents(filter: AnalyticsFilter, limit = 10000): Promise<AnalyticsEventRow[]> {
  const { clause, values } = buildWhere(filter);
  values.push(limit);
  return query<AnalyticsEventRow>(
    `SELECT * FROM analytics_events e ${clause} ORDER BY created_at DESC LIMIT ?`,
    values,
  );
}

// ─── Raw sessions for export ──────────────────────────────────────────────────

export async function getRawSessions(filter: AnalyticsFilter, limit = 10000): Promise<AnalyticsSessionRow[]> {
  const conditions: string[] = [];
  const values: QueryValue[] = [];

  if (filter.customerUid) { conditions.push("customer_uid = ?"); values.push(filter.customerUid); }
  if (filter.productUid) { conditions.push("product_uid = ?"); values.push(filter.productUid); }
  if (filter.from) { conditions.push("started_at >= ?"); values.push(`${filter.from} 00:00:00`); }
  if (filter.to) { conditions.push("started_at <= ?"); values.push(`${filter.to} 23:59:59`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);

  return query<AnalyticsSessionRow>(
    `SELECT * FROM analytics_sessions ${where} ORDER BY started_at DESC LIMIT ?`,
    values,
  );
}


// ─── Realtime analytics ──────────────────────────────────────────────────────

export async function getRealtimeStats(filter: AnalyticsFilter): Promise<{
  activeViewers: number;
  viewsLastHour: number;
  arLaunchesLastHour: number;
  screenshotsLastHour: number;
  sharesLastHour: number;
  recentEvents: AnalyticsEventRow[];
}> {
  const conditions: string[] = ["e.created_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)"];
  const values: QueryValue[] = [];

  if (filter.customerUid) { conditions.push("e.customer_uid = ?"); values.push(filter.customerUid); }
  if (filter.productUid) { conditions.push("e.product_uid = ?"); values.push(filter.productUid); }

  const fiveMinuteWhere = `WHERE ${conditions.join(" AND ")}`;

  const hourConditions: string[] = ["e.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)"];
  const hourValues: QueryValue[] = [];
  if (filter.customerUid) { hourConditions.push("e.customer_uid = ?"); hourValues.push(filter.customerUid); }
  if (filter.productUid) { hourConditions.push("e.product_uid = ?"); hourValues.push(filter.productUid); }
  const hourWhere = `WHERE ${hourConditions.join(" AND ")}`;

  const [activeRows, hourRows, recentEvents] = await Promise.all([
    query<{ total: number }>(
      `SELECT COUNT(DISTINCT session_id) AS total FROM analytics_events e ${fiveMinuteWhere}`,
      values,
    ),
    query<{
      viewsLastHour: number;
      arLaunchesLastHour: number;
      screenshotsLastHour: number;
      sharesLastHour: number;
    }>(
      `SELECT
         SUM(event = 'viewer_open') AS viewsLastHour,
         SUM(event IN ('ar_launch_success','ar_button_click')) AS arLaunchesLastHour,
         SUM(event = 'screenshot') AS screenshotsLastHour,
         SUM(event IN ('share_native','copy_link')) AS sharesLastHour
       FROM analytics_events e ${hourWhere}`,
      hourValues,
    ),
    query<AnalyticsEventRow>(
      `SELECT * FROM analytics_events e ${hourWhere} ORDER BY created_at DESC LIMIT 50`,
      hourValues,
    ),
  ]);

  const hour = hourRows[0] || {} as any;
  return {
    activeViewers: Number(activeRows[0]?.total ?? 0),
    viewsLastHour: Number(hour.viewsLastHour ?? 0),
    arLaunchesLastHour: Number(hour.arLaunchesLastHour ?? 0),
    screenshotsLastHour: Number(hour.screenshotsLastHour ?? 0),
    sharesLastHour: Number(hour.sharesLastHour ?? 0),
    recentEvents,
  };
}

// ─── Analytics cleanup ───────────────────────────────────────────────────────

export async function cleanupOldAnalytics(customerUid: string, daysToKeep = 180): Promise<{
  deletedEvents: number;
  deletedSessions: number;
}> {
  const safeDays = Math.max(30, Math.min(730, Number(daysToKeep) || 180));

  const eventResult = await query<any>(
    `DELETE FROM analytics_events
     WHERE customer_uid = ? AND created_at < DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)`,
    [customerUid],
  );

  const sessionResult = await query<any>(
    `DELETE FROM analytics_sessions
     WHERE customer_uid = ? AND started_at < DATE_SUB(NOW(), INTERVAL ${safeDays} DAY)`,
    [customerUid],
  );

  const eventMeta = Array.isArray(eventResult) ? eventResult[0] : eventResult;
  const sessionMeta = Array.isArray(sessionResult) ? sessionResult[0] : sessionResult;

  return {
    deletedEvents: Number(eventMeta?.affectedRows ?? 0),
    deletedSessions: Number(sessionMeta?.affectedRows ?? 0),
  };
}
