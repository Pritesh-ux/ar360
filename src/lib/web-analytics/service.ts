import {
  extractIp,
  hashIp,
  parseBrowser,
  parseDevice,
  parseOS,
  classifyReferrer,
} from "@/server/analytics/analytics.middleware";
import { resolveRequestGeoDetailed } from "@/lib/geo/resolve-request-geo";
import {
  closeOpenPageView,
  endSiteSession,
  getActiveSessions,
  insertSiteEvent,
  insertSitePageView,
  touchSiteSession,
  upsertSiteSession,
  upsertSiteVisitor,
} from "./repository";
import {
  allowSiteEvent,
  isMasterAdminPath,
  parseUtm,
  presenceStatus,
  sanitizePath,
  sanitizeText,
  todayBounds,
  visitorLabel,
  webAnalyticsIdleSec,
} from "./helpers";
import type { ActivityFeedItem, LiveVisitorRow, WebAnalyticsClientPayload } from "./types";
import { query } from "@/lib/db";

const heartbeatThrottle = new Map<string, number>();

async function geoFromRequest(request: Request) {
  return resolveRequestGeoDetailed(request);
}

function deviceFromRequest(request: Request, body: WebAnalyticsClientPayload) {
  const ua = request.headers.get("user-agent") ?? "";
  return {
    deviceType: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOS(ua),
    screenWidth: Math.max(0, Math.min(10000, Number(body.screenWidth || 0) || 0)),
    screenHeight: Math.max(0, Math.min(10000, Number(body.screenHeight || 0) || 0)),
  };
}

function idsOrThrow(body: WebAnalyticsClientPayload) {
  const visitorId = sanitizeText(body.visitorId, 64);
  const sessionId = sanitizeText(body.sessionId, 64);
  if (!visitorId || !sessionId) throw new Error("visitorId and sessionId required");
  if (!/^[a-zA-Z0-9_-]+$/.test(visitorId) || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error("Invalid id format");
  }
  return { visitorId, sessionId };
}

export async function startWebSession(body: WebAnalyticsClientPayload, request: Request) {
  const { visitorId, sessionId } = idsOrThrow(body);
  const path = sanitizePath(body.path || "/");
  if (isMasterAdminPath(path)) return { ok: true, skipped: true };

  const geo = await geoFromRequest(request);
  const device = deviceFromRequest(request, body);
  const utm = parseUtm(body.path || body.referrer || "");
  const referrer = classifyReferrer(body.referrer || "", body.path || "");
  const ipHash = hashIp(extractIp(request));
  const customerUid = body.customerUid ? sanitizeText(body.customerUid, 40) : null;

  await upsertSiteVisitor({
    visitorId,
    customerUid,
    ...geo,
    ...device,
    ipHash,
  });
  await upsertSiteSession({
    sessionId,
    visitorId,
    customerUid,
    landingPage: path,
    referrer: sanitizeText(referrer, 255),
    utmSource: body.utmSource || utm.utmSource,
    utmMedium: body.utmMedium || utm.utmMedium,
    utmCampaign: body.utmCampaign || utm.utmCampaign,
    utmTerm: body.utmTerm || utm.utmTerm,
    utmContent: body.utmContent || utm.utmContent,
    ...device,
    ...geo,
  });
  await insertSiteEvent({
    sessionId,
    visitorId,
    customerUid,
    event: "session_start",
    path,
  });
  return { ok: true };
}

export async function recordWebPageView(body: WebAnalyticsClientPayload, request: Request) {
  const { visitorId, sessionId } = idsOrThrow(body);
  const path = sanitizePath(body.path || "/");
  if (isMasterAdminPath(path)) return { ok: true, skipped: true };

  const businessEvent = allowSiteEvent(body.event);
  const isBusinessOnly = businessEvent === "login" || businessEvent === "signup";

  const geo = await geoFromRequest(request);
  const device = deviceFromRequest(request, body);
  const utm = parseUtm(typeof body.path === "string" && body.path.includes("?") ? body.path : path);
  const referrer = classifyReferrer(body.referrer || "", path);
  const customerUid = body.customerUid ? sanitizeText(body.customerUid, 40) : null;
  const ipHash = hashIp(extractIp(request));
  const title = sanitizeText(body.pageTitle, 255);

  await upsertSiteVisitor({
    visitorId,
    customerUid,
    ...geo,
    ...device,
    ipHash,
  });
  await upsertSiteSession({
    sessionId,
    visitorId,
    customerUid,
    landingPage: path,
    referrer: sanitizeText(referrer, 255),
    utmSource: body.utmSource || utm.utmSource,
    utmMedium: body.utmMedium || utm.utmMedium,
    utmCampaign: body.utmCampaign || utm.utmCampaign,
    utmTerm: body.utmTerm || utm.utmTerm,
    utmContent: body.utmContent || utm.utmContent,
    ...device,
    ...geo,
  });

  if (isBusinessOnly && businessEvent) {
    await insertSiteEvent({
      sessionId,
      visitorId,
      customerUid,
      event: businessEvent,
      path,
    });
    return { ok: true, event: businessEvent };
  }

  await insertSitePageView({
    sessionId,
    visitorId,
    customerUid,
    path,
    pageTitle: title,
    referrer: sanitizeText(referrer, 255),
    utmSource: body.utmSource || utm.utmSource,
    utmMedium: body.utmMedium || utm.utmMedium,
    utmCampaign: body.utmCampaign || utm.utmCampaign,
  });
  const eventName =
    businessEvent && businessEvent !== "page_view" && businessEvent !== "heartbeat"
      ? businessEvent
      : path.startsWith("/pricing")
        ? "pricing_view"
        : "page_view";
  await insertSiteEvent({
    sessionId,
    visitorId,
    customerUid,
    event: eventName,
    path,
    meta: { title },
  });
  return { ok: true };
}

export async function heartbeatWebSession(body: WebAnalyticsClientPayload, request: Request) {
  const { visitorId, sessionId } = idsOrThrow(body);
  const path = sanitizePath(body.path || "/");
  if (isMasterAdminPath(path)) return { ok: true, skipped: true };

  const now = Date.now();
  const last = heartbeatThrottle.get(sessionId) || 0;
  if (now - last < 15_000) return { ok: true, throttled: true };
  heartbeatThrottle.set(sessionId, now);
  if (heartbeatThrottle.size > 5000) {
    for (const [key, ts] of heartbeatThrottle) {
      if (now - ts > 120_000) heartbeatThrottle.delete(key);
    }
  }

  await touchSiteSession(sessionId, path);
  // Backfill city/region if earlier offline lookup only had country (common on mobile IPs).
  const geo = await geoFromRequest(request);
  if (geo.city || geo.region || geo.country) {
    await query(
      `UPDATE site_sessions
          SET country = IF(? <> '', ?, country),
              region = IF(? <> '', ?, region),
              city = IF(? <> '', ?, city)
        WHERE session_id = ?`,
      [geo.country, geo.country, geo.region, geo.region, geo.city, geo.city, sessionId],
    );
    await query(
      `UPDATE site_visitors
          SET last_seen_at = NOW(),
              country = IF(? <> '', ?, country),
              region = IF(? <> '', ?, region),
              city = IF(? <> '', ?, city)
        WHERE visitor_id = ?`,
      [geo.country, geo.country, geo.region, geo.region, geo.city, geo.city, visitorId],
    );
  } else {
    await query(`UPDATE site_visitors SET last_seen_at = NOW() WHERE visitor_id = ?`, [visitorId]);
  }
  // heartbeat intentionally not inserted into site_events
  return { ok: true };
}

export async function endWebSession(body: WebAnalyticsClientPayload) {
  const { visitorId, sessionId } = idsOrThrow(body);
  const path = sanitizePath(body.path || "/");
  if (isMasterAdminPath(path)) return { ok: true, skipped: true };

  const duration = Number(body.durationSeconds || 0);
  if (Number.isFinite(duration) && duration > 0) {
    await closeOpenPageView(sessionId, path, duration).catch(() => {});
  }

  const isPageLeave = body.event === "page_leave";
  if (!isPageLeave) {
    await endSiteSession(sessionId, path);
  } else {
    await touchSiteSession(sessionId, path).catch(() => {});
  }

  await insertSiteEvent({
    sessionId,
    visitorId,
    customerUid: body.customerUid ? sanitizeText(body.customerUid, 40) : null,
    event: isPageLeave ? "page_leave" : "session_end",
    path,
  });
  return { ok: true };
}

export async function emitBusinessSiteEvent(input: {
  visitorId?: string | null;
  sessionId?: string | null;
  customerUid?: string | null;
  event: string;
  path?: string;
}) {
  const event = allowSiteEvent(input.event);
  if (!event) return;
  const visitorId = sanitizeText(input.visitorId || "", 64);
  const sessionId = sanitizeText(input.sessionId || "", 64);
  if (!visitorId || !sessionId) return;
  await insertSiteEvent({
    sessionId,
    visitorId,
    customerUid: input.customerUid || null,
    event,
    path: sanitizePath(input.path || "/"),
  });
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(value);
}

export async function getLiveWebAnalytics(filters?: {
  device?: string;
  country?: string;
  browser?: string;
  os?: string;
  status?: string;
  search?: string;
  visitorType?: string;
  source?: string;
}) {
  const since = new Date(Date.now() - webAnalyticsIdleSec() * 1000);
  const sinceSql = since.toISOString().slice(0, 19).replace("T", " ");
  const sessions = await getActiveSessions(sinceSql);
  const now = new Date();

  let rows: LiveVisitorRow[] = sessions.map((s) => {
    const status = presenceStatus(s.last_activity_at, now);
    const city = s.city || "";
    const country = s.country || "";
    const region = String((s as { region?: string }).region || "");
    const place = city || region;
    return {
      visitorId: s.visitor_id,
      label: visitorLabel(s.visitor_id),
      sessionId: s.session_id,
      location: [place, country].filter(Boolean).join(", ") || "Unknown",
      country,
      city: city || region,
      device: s.device_type || "unknown",
      browser: s.browser || "unknown",
      os: s.os || "unknown",
      currentPage: sanitizePath(s.current_path || s.exit_page || s.landing_page || "/"),
      startedAt: toIso(s.started_at),
      lastActiveAt: toIso(s.last_activity_at),
      status,
      referrer: String((s as { referrer?: string }).referrer || ""),
    };
  });

  if (filters?.device && filters.device !== "all") {
    rows = rows.filter((r) => r.device.toLowerCase() === filters.device!.toLowerCase());
  }
  if (filters?.country && filters.country !== "all") {
    rows = rows.filter((r) => r.country.toLowerCase() === filters.country!.toLowerCase());
  }
  if (filters?.browser && filters.browser !== "all") {
    rows = rows.filter((r) => r.browser.toLowerCase() === filters.browser!.toLowerCase());
  }
  if (filters?.os && filters.os !== "all") {
    rows = rows.filter((r) => r.os.toLowerCase() === filters.os!.toLowerCase());
  }
  if (filters?.status === "live" || filters?.status === "idle") {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters?.source && filters.source !== "all") {
    const want = filters.source.toLowerCase();
    rows = rows.filter((r) => {
      const ref = (r.referrer || "").toLowerCase();
      if (want === "direct") return !ref || ref === "direct";
      if (want === "google" || want === "search") return ref.includes("google") || ref === "search";
      if (want === "social") return ref.includes("instagram") || ref.includes("facebook") || ref === "social";
      if (want === "referral") return Boolean(ref) && ref !== "direct" && !ref.includes("google");
      return true;
    });
  }
  if (filters?.visitorType === "new" || filters?.visitorType === "returning") {
    const ids = [...new Set(rows.map((r) => r.visitorId))];
    if (ids.length) {
      const firstSeen = await query<{ visitor_id: string; first_seen_at: Date | string }>(
        `SELECT visitor_id, first_seen_at FROM site_visitors
          WHERE visitor_id IN (${ids.map(() => "?").join(",")})`,
        ids,
      ).catch(() => [] as { visitor_id: string; first_seen_at: Date | string }[]);
      const map = new Map<string, number>(
        firstSeen.map((r) => [r.visitor_id, new Date(r.first_seen_at).getTime()] as const),
      );
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const cut = dayStart.getTime();
      rows = rows.filter((r) => {
        const first = map.get(r.visitorId) ?? 0;
        const isNew = first >= cut;
        return filters.visitorType === "new" ? isNew : !isNew;
      });
    }
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.visitorId.toLowerCase().includes(q) ||
        r.sessionId.toLowerCase().includes(q) ||
        r.currentPage.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.country.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q),
    );
  }

  const feedRows = await query<{
    id: number;
    event: string;
    visitor_id: string;
    path: string;
    created_at: Date | string;
  }>(
    `SELECT id, event, visitor_id, path, created_at
       FROM site_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        AND event <> 'heartbeat'
      ORDER BY created_at DESC
      LIMIT 40`,
  ).catch(() => []);

  const feed: ActivityFeedItem[] = feedRows.map((e) => ({
    id: Number(e.id),
    event: e.event,
    visitorId: e.visitor_id,
    label: visitorLabel(e.visitor_id),
    path: sanitizePath(e.path),
    createdAt: toIso(e.created_at),
    summary: summarizeEvent(e.event, sanitizePath(e.path)),
  }));

  return {
    liveCount: rows.filter((r) => r.status === "live").length,
    idleCount: rows.filter((r) => r.status === "idle").length,
    visitors: rows,
    feed,
  };
}

function summarizeEvent(event: string, path: string) {
  if (event === "session_start") return `entered ${path}`;
  if (event === "page_view" || event === "pricing_view") return `viewed ${path}`;
  if (event === "page_leave") return `left ${path}`;
  if (event === "session_end") return "left the website";
  if (event === "login") return "logged in";
  if (event === "signup") return "signed up";
  return event;
}

export async function getWebAnalyticsOverview() {
  const { from, to } = todayBounds();
  const live = await getLiveWebAnalytics();

  const [visitorRows, sessionRows, viewRows, returningRows] = await Promise.all([
    query<{ c: number }>(
      `SELECT COUNT(DISTINCT visitor_id) AS c FROM site_sessions
        WHERE started_at >= ? AND started_at <= ?`,
      [from, to],
    ),
    query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM site_sessions WHERE started_at >= ? AND started_at <= ?`,
      [from, to],
    ),
    query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM site_page_views WHERE viewed_at >= ? AND viewed_at <= ?`,
      [from, to],
    ),
    query<{ c: number }>(
      `SELECT COUNT(DISTINCT s.visitor_id) AS c
         FROM site_sessions s
         INNER JOIN site_visitors v ON v.visitor_id = s.visitor_id
        WHERE s.started_at >= ? AND s.started_at <= ?
          AND v.first_seen_at < ?`,
      [from, to, from],
    ),
  ]);

  const todayVisitors = Number(visitorRows[0]?.c || 0);
  const returning = Number(returningRows[0]?.c || 0);
  const neo = Math.max(0, todayVisitors - returning);

  return {
    liveNow: live.liveCount,
    todayVisitors,
    todaySessions: Number(sessionRows[0]?.c || 0),
    todayPageViews: Number(viewRows[0]?.c || 0),
    newVisitors: neo,
    returningVisitors: returning,
  };
}

export async function getWebAnalyticsTimeseries(range: string) {
  const days = range === "1" || range === "today" ? 1 : range === "7" ? 7 : range === "30" ? 30 : 7;
  const rows = await query<{ day: string | Date; visitors: number; sessions: number; views: number }>(
    `SELECT DATE(s.started_at) AS day,
            COUNT(DISTINCT s.visitor_id) AS visitors,
            COUNT(*) AS sessions,
            COALESCE((
              SELECT COUNT(*) FROM site_page_views pv
               WHERE DATE(pv.viewed_at) = DATE(s.started_at)
            ), 0) AS views
       FROM site_sessions s
      WHERE s.started_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(s.started_at)
      ORDER BY day ASC`,
    [days - 1],
  ).catch(() => []);

  return rows.map((r) => ({
    day:
      r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day).slice(0, 10),
    visitors: Number(r.visitors || 0),
    sessions: Number(r.sessions || 0),
    views: Number(r.views || 0),
  }));
}

export async function getWebAnalyticsHourlyToday() {
  const rows = await query<{ hour: number; visitors: number }>(
    `SELECT HOUR(started_at) AS hour, COUNT(DISTINCT visitor_id) AS visitors
       FROM site_sessions
      WHERE started_at >= CURDATE()
      GROUP BY HOUR(started_at)
      ORDER BY hour ASC`,
  ).catch(() => []);
  const map = Object.fromEntries(rows.map((r) => [Number(r.hour), Number(r.visitors || 0)]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, visitors: map[hour] || 0 }));
}

export async function getWebAnalyticsPages(from: string, to: string) {
  const rows = await query<{
    path: string;
    views: number;
    uniques: number;
    avg_seconds: number;
  }>(
    `SELECT path,
            COUNT(*) AS views,
            COUNT(DISTINCT visitor_id) AS uniques,
            ROUND(AVG(COALESCE(duration_seconds, 0))) AS avg_seconds
       FROM site_page_views
      WHERE viewed_at >= ? AND viewed_at <= ?
      GROUP BY path
      ORDER BY views DESC
      LIMIT 50`,
    [from, to],
  );
  return rows.map((r) => ({
    path: r.path,
    views: Number(r.views || 0),
    uniqueVisitors: Number(r.uniques || 0),
    avgSeconds: Number(r.avg_seconds || 0),
  }));
}

export async function getWebAnalyticsSources(from: string, to: string) {
  const rows = await query<{ referrer: string; c: number }>(
    `SELECT src AS referrer, COUNT(*) AS c FROM (
        SELECT CASE
                 WHEN referrer = '' OR referrer = 'direct' THEN 'Direct'
                 WHEN referrer = 'search' OR referrer LIKE '%google%' THEN 'Google'
                 WHEN referrer = 'social' OR referrer LIKE '%instagram%' OR referrer LIKE '%facebook%' THEN 'Social'
                 ELSE 'Other'
               END AS src
          FROM site_sessions
         WHERE started_at >= ? AND started_at <= ?
      ) t
      GROUP BY src
      ORDER BY c DESC
      LIMIT 20`,
    [from, to],
  );
  const total = rows.reduce((s, r) => s + Number(r.c || 0), 0) || 1;
  return rows.map((r) => ({
    source: r.referrer,
    sessions: Number(r.c || 0),
    percent: Math.round((Number(r.c || 0) / total) * 1000) / 10,
  }));
}

export async function getWebAnalyticsDevices(from: string, to: string) {
  const [devices, browsers, oses] = await Promise.all([
    query<{ label: string; c: number }>(
      `SELECT device_type AS label, COUNT(*) AS c FROM site_sessions
        WHERE started_at >= ? AND started_at <= ? GROUP BY device_type ORDER BY c DESC`,
      [from, to],
    ),
    query<{ label: string; c: number }>(
      `SELECT browser AS label, COUNT(*) AS c FROM site_sessions
        WHERE started_at >= ? AND started_at <= ? GROUP BY browser ORDER BY c DESC LIMIT 10`,
      [from, to],
    ),
    query<{ label: string; c: number }>(
      `SELECT os AS label, COUNT(*) AS c FROM site_sessions
        WHERE started_at >= ? AND started_at <= ? GROUP BY os ORDER BY c DESC LIMIT 10`,
      [from, to],
    ),
  ]);
  const withPct = (rows: { label: string; c: number }[]) => {
    const total = rows.reduce((s, r) => s + Number(r.c || 0), 0) || 1;
    return rows.map((r) => ({
      label: r.label || "unknown",
      count: Number(r.c || 0),
      percent: Math.round((Number(r.c || 0) / total) * 1000) / 10,
    }));
  };
  return {
    devices: withPct(devices),
    browsers: withPct(browsers),
    os: withPct(oses),
  };
}

export async function getWebAnalyticsLocations(from: string, to: string) {
  const [countries, cities] = await Promise.all([
    query<{ country: string; c: number }>(
      `SELECT COALESCE(NULLIF(country,''), 'Unknown') AS country, COUNT(*) AS c
         FROM site_sessions
        WHERE started_at >= ? AND started_at <= ?
        GROUP BY country
        ORDER BY c DESC
        LIMIT 20`,
      [from, to],
    ),
    query<{ city: string; country: string; c: number }>(
      `SELECT COALESCE(NULLIF(city,''), 'Unknown') AS city,
              COALESCE(NULLIF(country,''), 'Unknown') AS country,
              COUNT(*) AS c
         FROM site_sessions
        WHERE started_at >= ? AND started_at <= ?
        GROUP BY city, country
        ORDER BY c DESC
        LIMIT 30`,
      [from, to],
    ),
  ]);
  const countryTotal = countries.reduce((s, r) => s + Number(r.c || 0), 0) || 1;
  const cityTotal = cities.reduce((s, r) => s + Number(r.c || 0), 0) || 1;
  return {
    countries: countries.map((r) => ({
      country: r.country,
      sessions: Number(r.c || 0),
      percent: Math.round((Number(r.c || 0) / countryTotal) * 1000) / 10,
    })),
    cities: cities.map((r) => ({
      city: r.city,
      country: r.country,
      label:
        r.city === "Unknown"
          ? r.country === "Unknown"
            ? "Unknown"
            : `Unknown · ${r.country}`
          : r.country && r.country !== "Unknown"
            ? `${r.city}, ${r.country}`
            : r.city,
      sessions: Number(r.c || 0),
      percent: Math.round((Number(r.c || 0) / cityTotal) * 1000) / 10,
    })),
  };
}

export async function getWebVisitorDetail(visitorId: string) {
  const id = sanitizeText(visitorId, 64);
  const visitors = await query<Record<string, unknown>>(
    `SELECT * FROM site_visitors WHERE visitor_id = ? LIMIT 1`,
    [id],
  );
  if (!visitors[0]) return null;

  const pages = await query<{ path: string; page_title: string; viewed_at: Date | string; duration_seconds: number | null }>(
    `SELECT path, page_title, viewed_at, duration_seconds
       FROM site_page_views
      WHERE visitor_id = ?
      ORDER BY viewed_at DESC
      LIMIT 100`,
    [id],
  );

  const v = visitors[0];
  return {
    visitorId: id,
    label: visitorLabel(id),
    firstSeenAt: toIso(v.first_seen_at as Date | string),
    lastActiveAt: toIso(v.last_seen_at as Date | string),
    location: [v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown",
    device: String(v.device_type || "unknown"),
    browser: String(v.browser || "unknown"),
    os: String(v.os || "unknown"),
    pages: pages.map((p) => ({
      path: p.path,
      title: p.page_title,
      viewedAt: toIso(p.viewed_at),
      durationSeconds: p.duration_seconds == null ? null : Number(p.duration_seconds),
    })),
  };
}

export async function cleanupWebAnalytics(retentionDays?: number) {
  const days = Math.min(
    730,
    Math.max(30, Number(retentionDays || process.env.WEB_ANALYTICS_RETENTION_DAYS || 90) || 90),
  );
  const sessionDays = Math.min(730, Math.max(days, 180));
  await query(`DELETE FROM site_page_views WHERE viewed_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
  await query(`DELETE FROM site_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
  await query(
    `DELETE FROM site_sessions WHERE started_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [sessionDays],
  );
  await query(
    `DELETE FROM site_visitors WHERE last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [sessionDays],
  );
  return { ok: true, retentionDays: days, sessionRetentionDays: sessionDays };
}
