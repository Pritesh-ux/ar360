import {
  getBounceRate,
  getBrowserBreakdown,
  getDailySeries,
  getDeviceBreakdown,
  getOSBreakdown,
  getRawEvents,
  getReferrerBreakdown,
  getRealtimeStats,
  cleanupOldAnalytics,
  getReturningVisitors,
  getSummaryCounts,
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
import { canonicalizeAnalyticsEvent } from "./analytics.events";
import { getTopCities, getTopCountries } from "./analytics.locations";
import { resolveProduct } from "@/server/products/product-resolver";
import { resolveRequestGeoDetailed } from "@/lib/geo/resolve-request-geo";

// ─── Track a single event ─────────────────────────────────────────────────────

export async function trackEvent(
  payload: AnalyticsEventPayload,
  request: Request,
): Promise<void> {
  const ua = request.headers.get("user-agent") ?? "";
  const rawIp = extractIp(request);
  const event = canonicalizeAnalyticsEvent(payload.event);

  // Always persist internal products.id so reads joining on products.id stay correct.
  const resolved = await resolveProduct(payload.productUid).catch(() => null);
  const productUid = resolved?.productId ?? payload.productUid;
  const customerUid =
    resolved?.customerUid ?? payload.customerUid ?? "anonymous";

  const geo = await resolveRequestGeoDetailed(request);

  const params: InsertEventParams = {
    customerUid,
    productUid,
    sessionId: payload.sessionId,
    event,
    device: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOS(ua),
    country: geo.country,
    city: geo.city,
    language: payload.language ?? request.headers.get("accept-language")?.split(",")[0] ?? "",
    screenWidth: payload.screenWidth ?? 0,
    screenHeight: payload.screenHeight ?? 0,
    referrer: classifyReferrer(payload.referrer ?? "", payload.url ?? ""),
    url: payload.url ?? "",
    ipHash: hashIp(rawIp),
    meta: JSON.stringify(payload.meta ?? {}),
  };

  await Promise.all([
    insertEvent(params),
    upsertSession(
      payload.sessionId,
      params.customerUid,
      productUid,
      params.device,
      params.browser,
      params.os,
      params.country,
      params.city,
    ),
    upsertDailyStats(params.customerUid, productUid, event),
  ]);
}

// ─── Build full dashboard payload ─────────────────────────────────────────────

export async function getDashboardData(filter: AnalyticsFilter): Promise<DashboardData> {
  const { fromDate, toDate } = buildDateRange(filter.from, filter.to);

  // If a legacy public_id/slug is passed as productUid, resolve to internal id.
  let productUid = filter.productUid;
  if (productUid) {
    const resolved = await resolveProduct(productUid).catch(() => null);
    if (resolved) productUid = resolved.productId;
  }

  const resolvedFilter: AnalyticsFilter = {
    ...filter,
    productUid,
    from: fromDate,
    to: toDate,
  };

  const [
    counts,
    returningVisitors,
    avgSessionDuration,
    bounceRate,
    daily,
    topProducts,
    topCountries,
    topCities,
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
    getTopCities(resolvedFilter),
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
    topCities,
    devices,
    browsers,
    operatingSystems,
    referrers,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportAnalytics(
  filter: AnalyticsFilter,
  _format: ExportFormat = "excel",
): Promise<{ data: string | Buffer; contentType: string; filename: string }> {
  const { fromDate, toDate } = buildDateRange(filter.from, filter.to);
  let productUid = filter.productUid;
  if (productUid) {
    const resolved = await resolveProduct(productUid).catch(() => null);
    if (resolved) productUid = resolved.productId;
  }
  const resolvedFilter: AnalyticsFilter = {
    ...filter,
    productUid,
    from: fromDate,
    to: toDate,
  };

  const events = await getRawEvents(resolvedFilter);

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

  return {
    data: `\uFEFF${[headers.join(","), ...rows].join("\n")}`,
    contentType: "application/vnd.ms-excel; charset=utf-8",
    filename: `analytics-${fromDate}-${toDate}.xls`,
  };
}

export async function getRealtimeAnalytics(filter: AnalyticsFilter) {
  let productUid = filter.productUid;
  if (productUid) {
    const resolved = await resolveProduct(productUid).catch(() => null);
    if (resolved) productUid = resolved.productId;
  }
  return getRealtimeStats({ ...filter, productUid });
}

export async function cleanupAnalyticsData(customerUid: string, daysToKeep = 180) {
  return cleanupOldAnalytics(customerUid, daysToKeep);
}

/** Named SSoT readers used by dashboard / analytics / admin surfaces. */
export const getAnalyticsSummary = getSummaryCounts;
export async function getAnalyticsSeries(filter: AnalyticsFilter) {
  const { fromDate, toDate } = buildDateRange(filter.from, filter.to);
  return getDailySeries({ ...filter, from: fromDate, to: toDate });
}
export const getAnalyticsTopProducts = getTopProducts;
