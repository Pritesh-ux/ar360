import { query } from "@/lib/db";

export type SiteVisitorRow = {
  visitor_id: string;
  customer_uid: string | null;
  first_seen_at: Date | string;
  last_seen_at: Date | string;
  country: string;
  region: string;
  city: string;
  device_type: string;
  browser: string;
  os: string;
  screen_width: number;
  screen_height: number;
};

export type SiteSessionRow = {
  session_id: string;
  visitor_id: string;
  customer_uid: string | null;
  started_at: Date | string;
  last_activity_at: Date | string;
  ended_at: Date | string | null;
  landing_page: string;
  exit_page: string | null;
  referrer: string;
  device_type: string;
  browser: string;
  os: string;
  country: string;
  region: string;
  city: string;
  page_view_count: number;
  current_path?: string;
};

export async function upsertSiteVisitor(input: {
  visitorId: string;
  customerUid?: string | null;
  country: string;
  region: string;
  city: string;
  deviceType: string;
  browser: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  ipHash: string;
}) {
  await query(
    `INSERT INTO site_visitors (
       visitor_id, customer_uid, first_seen_at, last_seen_at,
       country, region, city, device_type, browser, os,
       screen_width, screen_height, ip_hash
     ) VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_seen_at = NOW(),
       customer_uid = COALESCE(VALUES(customer_uid), customer_uid),
       country = IF(VALUES(country) <> '', VALUES(country), country),
       region = IF(VALUES(region) <> '', VALUES(region), region),
       city = IF(VALUES(city) <> '', VALUES(city), city),
       device_type = VALUES(device_type),
       browser = VALUES(browser),
       os = VALUES(os),
       screen_width = VALUES(screen_width),
       screen_height = VALUES(screen_height),
       ip_hash = IF(VALUES(ip_hash) <> '', VALUES(ip_hash), ip_hash)`,
    [
      input.visitorId,
      input.customerUid || null,
      input.country,
      input.region,
      input.city,
      input.deviceType,
      input.browser,
      input.os,
      input.screenWidth,
      input.screenHeight,
      input.ipHash,
    ],
  );
}

export async function upsertSiteSession(input: {
  sessionId: string;
  visitorId: string;
  customerUid?: string | null;
  landingPage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  deviceType: string;
  browser: string;
  os: string;
  country: string;
  region: string;
  city: string;
}) {
  await query(
    `INSERT INTO site_sessions (
       session_id, visitor_id, customer_uid, started_at, last_activity_at,
       landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       device_type, browser, os, country, region, city, page_view_count
     ) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       last_activity_at = NOW(),
       ended_at = NULL,
       customer_uid = COALESCE(VALUES(customer_uid), customer_uid),
       device_type = VALUES(device_type),
       browser = VALUES(browser),
       os = VALUES(os),
       country = IF(VALUES(country) <> '', VALUES(country), country),
       region = IF(VALUES(region) <> '', VALUES(region), region),
       city = IF(VALUES(city) <> '', VALUES(city), city)`,
    [
      input.sessionId,
      input.visitorId,
      input.customerUid || null,
      input.landingPage,
      input.referrer,
      input.utmSource,
      input.utmMedium,
      input.utmCampaign,
      input.utmTerm,
      input.utmContent,
      input.deviceType,
      input.browser,
      input.os,
      input.country,
      input.region,
      input.city,
    ],
  );
}

export async function touchSiteSession(sessionId: string, exitPage?: string) {
  if (exitPage) {
    await query(
      `UPDATE site_sessions
          SET last_activity_at = NOW(), ended_at = NULL, exit_page = ?
        WHERE session_id = ?`,
      [exitPage, sessionId],
    );
    return;
  }
  await query(
    `UPDATE site_sessions SET last_activity_at = NOW(), ended_at = NULL WHERE session_id = ?`,
    [sessionId],
  );
}

export async function endSiteSession(sessionId: string, exitPage?: string) {
  await query(
    `UPDATE site_sessions
        SET ended_at = NOW(),
            last_activity_at = NOW(),
            exit_page = COALESCE(?, exit_page)
      WHERE session_id = ?`,
    [exitPage || null, sessionId],
  );
}

export async function insertSitePageView(input: {
  sessionId: string;
  visitorId: string;
  customerUid?: string | null;
  path: string;
  pageTitle: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}) {
  await query(
    `INSERT INTO site_page_views (
       session_id, visitor_id, customer_uid, path, page_title, referrer,
       viewed_at, utm_source, utm_medium, utm_campaign
     ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [
      input.sessionId,
      input.visitorId,
      input.customerUid || null,
      input.path,
      input.pageTitle,
      input.referrer,
      input.utmSource,
      input.utmMedium,
      input.utmCampaign,
    ],
  );
  await query(
    `UPDATE site_sessions
        SET page_view_count = page_view_count + 1,
            last_activity_at = NOW(),
            exit_page = ?,
            ended_at = NULL
      WHERE session_id = ?`,
    [input.path, input.sessionId],
  );
}

export async function closeOpenPageView(sessionId: string, path: string, durationSeconds: number) {
  await query(
    `UPDATE site_page_views
        SET duration_seconds = ?
      WHERE id = (
        SELECT id FROM (
          SELECT id FROM site_page_views
           WHERE session_id = ? AND path = ? AND duration_seconds IS NULL
           ORDER BY viewed_at DESC LIMIT 1
        ) t
      )`,
    [Math.max(0, Math.min(86400, Math.round(durationSeconds))), sessionId, path],
  );
}

export async function insertSiteEvent(input: {
  sessionId: string;
  visitorId: string;
  customerUid?: string | null;
  event: string;
  path: string;
  meta?: Record<string, unknown>;
}) {
  if (input.event === "heartbeat") return;
  await query(
    `INSERT INTO site_events (session_id, visitor_id, customer_uid, event, path, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [
      input.sessionId,
      input.visitorId,
      input.customerUid || null,
      input.event,
      input.path,
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
}

export async function getActiveSessions(sinceSql: string) {
  return query<SiteSessionRow & { current_path: string }>(
    `SELECT s.*,
            COALESCE(
              (SELECT pv.path FROM site_page_views pv
                WHERE pv.session_id = s.session_id
                ORDER BY pv.viewed_at DESC LIMIT 1),
              s.exit_page,
              s.landing_page
            ) AS current_path
       FROM site_sessions s
      WHERE s.last_activity_at >= ?
        AND (s.ended_at IS NULL OR s.ended_at >= ?)
      ORDER BY s.last_activity_at DESC
      LIMIT 200`,
    [sinceSql, sinceSql],
  );
}
