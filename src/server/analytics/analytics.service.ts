import {
  getBounceRate,
  getBrowserBreakdown,
  getDailySeries,
  getDeviceBreakdown,
  getOSBreakdown,
  getRawEvents,
  getRawSessions,
  getReferrerBreakdown,
  getRealtimeStats,
  cleanupOldAnalytics,
  getReturningVisitors,
  getSummaryCounts,
  getTopCountries,
  getTopProducts,
  getAvgSessionDuration,
  insertEvent,
  upsertDailyStats,
  upsertSession,
  type InsertEventParams,
} from "./analytics.repository";
import {
  classifyReferrer,
  buildDateRange,
  extractIp,
  hashIp,
  parseBrowser,
  parseDevice,
  parseOS,
} from "./analytics.middleware";
import type {
  AnalyticsEventPayload,
  AnalyticsFilter,
  DashboardData,
  ExportFormat,
} from "./analytics.types";

// ─── Track a single event ─────────────────────────────────────────────────────

export async function trackEvent(
  payload: AnalyticsEventPayload,
  request: Request,
): Promise<void> {
  const ua = request.headers.get("user-agent") ?? "";
  const rawIp = extractIp(request);

  const params: InsertEventParams = {
    customerUid: payload.customerUid ?? "anonymous",
    productUid: payload.productUid,
    sessionId: payload.sessionId,
    event: payload.event,
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOS(ua),
    country: request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? "",
    city: request.headers.get("x-vercel-ip-city") ?? request.headers.get("cf-ipcity") ?? "",
    language: payload.language ?? request.headers.get("accept-language")?.split(",")[0] ?? "",
    screenWidth: payload.screenWidth ?? 0,
    screenHeight: payload.screenHeight ?? 0,
    referrer: classifyReferrer(payload.referrer ?? "", payload.url ?? ""),
    url: payload.url ?? "",
    ipHash: hashIp(rawIp),
    meta: JSON.stringify(payload.meta ?? {}),
  };

  // Fire both writes concurrently — session upsert is idempotent
  await Promise.all([
    insertEvent(params),
    upsertSession(
      payload.sessionId,
      params.customerUid,
      payload.productUid,
      params.device,
      params.browser,
      params.os,
      params.country,
      params.city,
    ),
    upsertDailyStats(params.customerUid, payload.productUid, payload.event),
  ]);
}

// ─── Build full dashboard payload ─────────────────────────────────────────────

export async function getDashboardData(filter: AnalyticsFilter): Promise<DashboardData> {
  const { fromDate, toDate } = buildDateRange(filter.from, filter.to);
  const resolvedFilter: AnalyticsFilter = { ...filter, from: fromDate, to: toDate };

  const [
    counts,
    returningVisitors,
    avgSessionDuration,
    bounceRate,
    daily,
    topProducts,
    topCountries,
    devices,
    browsers,
    operatingSystems,
    referrers,
  ] = await Promise.all([
    getSummaryCounts(resolvedFilter),
    getReturningVisitors(resolvedFilter),
    getAvgSessionDuration(resolvedFilter),
    getBounceRate(resolvedFilter),
    getDailySeries(resolvedFilter),
    getTopProducts(resolvedFilter),
    getTopCountries(resolvedFilter),
    getDeviceBreakdown(resolvedFilter),
    getBrowserBreakdown(resolvedFilter),
    getOSBreakdown(resolvedFilter),
    getReferrerBreakdown(resolvedFilter),
  ]);

  return {
    summary: {
      ...counts,
      returningVisitors,
      avgSessionDuration,
      bounceRate,
    },
    daily,
    topProducts,
    topCountries,
    devices,
    browsers,
    operatingSystems,
    referrers,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportAnalytics(
  filter: AnalyticsFilter,
  format: ExportFormat,
): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
  const { fromDate, toDate } = buildDateRange(filter.from, filter.to);
  const resolvedFilter: AnalyticsFilter = { ...filter, from: fromDate, to: toDate };

  const events = await getRawEvents(resolvedFilter);

  if (format === "json") {
    return {
      data: JSON.stringify(events, null, 2),
      contentType: "application/json",
      filename: `analytics-${fromDate}-${toDate}.json`,
    };
  }

  // CSV (also used as base for Excel — real Excel would need a library)
  const headers = [
    "id", "customer_uid", "product_uid", "session_id", "event",
    "device", "browser", "os", "country", "city", "language",
    "screen_width", "screen_height", "referrer", "url", "created_at",
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = events.map((e) =>
    headers.map((h) => escape(e[h as keyof typeof e])).join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");

  if (format === "excel") {
    // Return CSV with Excel-friendly BOM so Excel opens it correctly
    const bom = "\uFEFF";
    return {
      data: bom + csv,
      contentType: "application/vnd.ms-excel",
      filename: `analytics-${fromDate}-${toDate}.csv`,
    };
  }

  return {
    data: csv,
    contentType: "text/csv",
    filename: `analytics-${fromDate}-${toDate}.csv`,
  };
}


// ─── Realtime dashboard payload ──────────────────────────────────────────────

export async function getRealtimeAnalytics(filter: AnalyticsFilter) {
  return getRealtimeStats(filter);
}

// ─── Cleanup old analytics data ──────────────────────────────────────────────

export async function cleanupAnalyticsData(customerUid: string, daysToKeep = 180) {
  return cleanupOldAnalytics(customerUid, daysToKeep);
}
