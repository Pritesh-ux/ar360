import { query, type QueryValue } from "@/lib/db";
import { ensureProductSchema, ensureQrSchema } from "@/lib/db";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import { saveQrPng } from "@/lib/localCustomerStorage";
import { parseBrowser, parseDevice } from "@/server/analytics/analytics.middleware";
import { trackAnalyticsFromServer } from "@/lib/growth/analytics-track";

export type QrLifecycleStatus = "active" | "expired" | "archived" | "processing";
export type QrStatusFilter = "active" | "expired" | "archived" | "all";

export type QrCodeRecord = {
  id: number;
  qrCode: string;
  qrUid: string;
  productId: string;
  publicId: string;
  name: string;
  destinationUrl: string;
  qrLinkUrl: string;
  foregroundColor: string;
  backgroundColor: string;
  patternStyle: string;
  cornerStyle: string;
  logoUrl: string;
  logoSize: number;
  frameEnabled: boolean;
  frameStyle: string;
  frameColor: string;
  frameText: string;
  scans: number;
  uniqueScans: number;
  arLaunches: number;
  lastScanAt: string | null;
  status: QrLifecycleStatus;
  effectiveStatus: QrLifecycleStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  poster: string;
  productStatus: string;
  productPublicId: string | null;
  hasPngAsset: boolean;
};

export type QrListFilters = {
  customerUid: string;
  userId: number;
  q?: string;
  status?: QrStatusFilter;
  productId?: string;
  page?: number;
  pageSize?: number;
  origin: string;
};

export type QrListResult = {
  qrCodes: QrCodeRecord[];
  stats: {
    total: number;
    totalScans: number;
    uniqueScans: number;
    monthScans: number;
    active: number;
    expired: number;
    archived: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    from: number;
    to: number;
  };
};

type QrRow = {
  id: number;
  product_id: string;
  public_id: string;
  qr_code: string | null;
  qr_uid: string | null;
  name: string | null;
  destination_url: string;
  foreground_color: string;
  background_color: string;
  pattern_style: string;
  corner_style: string;
  logo_url: string | null;
  logo_size: number;
  frame_enabled: number;
  frame_style: string;
  frame_color: string;
  frame_text: string;
  scans: number;
  unique_scans: number;
  ar_launches: number;
  last_scan_at: string | null;
  status: string;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  poster: string | null;
  thumbnail_url: string | null;
  product_status: string;
  product_public_id: string | null;
  qr_url: string | null;
};

export function resolveEffectiveQrStatus(row: {
  status?: string | null;
  expires_at?: string | null;
  deleted_at?: string | null;
}): QrLifecycleStatus {
  if (row.deleted_at) return "archived";
  const base = String(row.status || "active").toLowerCase();
  if (base === "archived") return "archived";
  if (base === "processing") return "processing";
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (Number.isFinite(exp) && Date.now() > exp) return "expired";
  }
  if (base === "expired") return "expired";
  return "active";
}

function buildQrLinkUrl(origin: string, qrCode: string) {
  return `${origin}/qr/${encodeURIComponent(qrCode)}`;
}

function mapRow(row: QrRow, origin: string): QrCodeRecord {
  const effectiveStatus = resolveEffectiveQrStatus(row);
  const qrCode = row.qr_code || row.qr_uid || row.public_id;
  return {
    id: row.id,
    qrCode,
    qrUid: row.qr_uid || qrCode,
    productId: row.product_id,
    publicId: row.public_id,
    name: row.name || "Permanent QR",
    destinationUrl: row.destination_url,
    qrLinkUrl: origin ? buildQrLinkUrl(origin, qrCode) : `/qr/${qrCode}`,
    foregroundColor: row.foreground_color,
    backgroundColor: row.background_color,
    patternStyle: row.pattern_style,
    cornerStyle: row.corner_style,
    logoUrl: row.logo_url ?? "",
    logoSize: Number(row.logo_size || 20),
    frameEnabled: Boolean(row.frame_enabled),
    frameStyle: row.frame_style,
    frameColor: row.frame_color,
    frameText: row.frame_text,
    scans: Number(row.scans || 0),
    uniqueScans: Number(row.unique_scans || 0),
    arLaunches: Number(row.ar_launches || 0),
    lastScanAt: row.last_scan_at,
    status: (String(row.status || "active").toLowerCase() as QrLifecycleStatus) || "active",
    effectiveStatus,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    poster: row.poster ?? row.thumbnail_url ?? "",
    productStatus: row.product_status,
    productPublicId: row.product_public_id,
    hasPngAsset: Boolean(row.qr_url),
  };
}

function statusWhereClause(filter: QrStatusFilter) {
  if (filter === "archived") return "(q.deleted_at IS NOT NULL OR q.status = 'archived')";
  if (filter === "expired") {
    return "(q.deleted_at IS NULL AND (q.status = 'expired' OR (q.expires_at IS NOT NULL AND q.expires_at <= NOW())))";
  }
  if (filter === "active") {
    return "(q.deleted_at IS NULL AND q.status = 'active' AND (q.expires_at IS NULL OR q.expires_at > NOW()))";
  }
  return "1=1";
}

export async function allocatePermanentQrCode(): Promise<string> {
  await ensureQrSchema();
  await query(
    `INSERT INTO qr_code_sequence (id, next_val) VALUES (1, 1)
     ON DUPLICATE KEY UPDATE next_val = LAST_INSERT_ID(next_val + 1)`,
  );
  const rows = await query<{ code: number }>(`SELECT LAST_INSERT_ID() AS code`);
  const n = Number(rows[0]?.code || 1);
  return `QR-${String(n).padStart(6, "0")}`;
}

export async function ensurePermanentProductQr(input: {
  customerUid: string;
  userId: number;
  productId: string;
  publicId: string;
  origin: string;
}) {
  await ensureProductSchema();
  await ensureQrSchema();
  await ensureUserPanelSchema();

  const existing = await query<QrRow>(
    `SELECT q.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status,
            p.public_id AS product_public_id, p.qr_url
     FROM product_qr_codes q
     INNER JOIN products p ON p.id = q.product_id
     WHERE q.product_id = ? AND q.customer_uid = ? AND q.deleted_at IS NULL
     LIMIT 1`,
    [input.productId, input.customerUid],
  );

  const viewerUrl = `${input.origin}/viewer/${encodeURIComponent(input.publicId)}`;

  if (existing.length) {
    const row = existing[0];
    const qrCode = row.qr_code || row.qr_uid || row.public_id;
    const qrLink = buildQrLinkUrl(input.origin, qrCode);
    await query(`UPDATE product_qr_codes SET destination_url = ?, status = 'active', updated_at = NOW() WHERE id = ?`, [
      viewerUrl,
      row.id,
    ]);
    await saveQrPng({ customerUid: input.customerUid, productUid: input.productId, destination: qrLink }).catch(
      () => undefined,
    );
    return { qrCode, qrLinkUrl: qrLink, created: false };
  }

  const qrCode = await allocatePermanentQrCode();
  const qrLink = buildQrLinkUrl(input.origin, qrCode);

  await query(
    `INSERT INTO product_qr_codes
      (customer_uid, user_id, product_id, public_id, qr_code, qr_uid, destination_url, name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Permanent QR', 'active')`,
    [input.customerUid, input.userId, input.productId, qrCode, qrCode, qrCode, viewerUrl],
  );

  await saveQrPng({ customerUid: input.customerUid, productUid: input.productId, destination: qrLink }).catch(
    () => undefined,
  );

  return { qrCode, qrLinkUrl: qrLink, created: true };
}

export async function regenerateQrAsset(input: {
  customerUid: string;
  userId: number;
  qrId: number;
  origin: string;
}) {
  const qr = await getQrCodeById(input.qrId, input.customerUid, input.userId, input.origin);
  if (!qr) return { error: "QR not found." as const };
  const qrLink = qr.qrLinkUrl;
  await saveQrPng({ customerUid: input.customerUid, productUid: qr.productId, destination: qrLink });
  return { success: true as const, qrLinkUrl: qrLink };
}

export async function listCustomerQrCodes(filters: QrListFilters): Promise<QrListResult> {
  await ensureProductSchema();
  await ensureQrSchema();
  await ensureUserPanelSchema();

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 12));
  const offset = (page - 1) * pageSize;
  const statusFilter = filters.status || "all";

  const where: string[] = [
    "q.customer_uid = ?",
    "(q.user_id = ? OR q.user_id IS NULL)",
    "q.deleted_at IS NULL",
    "LOWER(p.status) IN ('published', 'active')",
    statusWhereClause(statusFilter),
  ];
  const params: QueryValue[] = [filters.customerUid, filters.userId];

  if (filters.productId) {
    where.push("q.product_id = ?");
    params.push(filters.productId);
  }

  const q = filters.q?.trim();
  if (q) {
    where.push("(p.title LIKE ? OR q.product_id LIKE ? OR q.qr_code LIKE ? OR q.name LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.join(" AND ");

  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM product_qr_codes q INNER JOIN products p ON p.id = q.product_id WHERE ${whereSql}`,
    params,
  );

  const rows = await query<QrRow>(
    `SELECT q.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status,
            p.public_id AS product_public_id, p.qr_url
     FROM product_qr_codes q INNER JOIN products p ON p.id = q.product_id
     WHERE ${whereSql} ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const statsRows = await query<{
    total: number;
    total_scans: number;
    unique_scans: number;
    month_scans: number;
    active_count: number;
    expired_count: number;
    archived_count: number;
  }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(q.scans),0) AS total_scans,
            COALESCE(SUM(q.unique_scans),0) AS unique_scans,
            COALESCE(SUM(CASE WHEN q.last_scan_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN q.scans ELSE 0 END),0) AS month_scans,
            SUM(CASE WHEN q.deleted_at IS NULL AND q.status='active' THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN q.deleted_at IS NULL AND q.status='expired' THEN 1 ELSE 0 END) AS expired_count,
            SUM(CASE WHEN q.deleted_at IS NOT NULL OR q.status='archived' THEN 1 ELSE 0 END) AS archived_count
     FROM product_qr_codes q INNER JOIN products p ON p.id = q.product_id
     WHERE q.customer_uid = ? AND (q.user_id = ? OR q.user_id IS NULL) AND q.deleted_at IS NULL
       AND LOWER(p.status) IN ('published','active')`,
    [filters.customerUid, filters.userId],
  );

  const stats = statsRows[0] || { total: 0, total_scans: 0, unique_scans: 0, month_scans: 0, active_count: 0, expired_count: 0, archived_count: 0 };
  const totalNum = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalNum / pageSize));

  return {
    qrCodes: rows.map((row) => mapRow(row, filters.origin)),
    stats: {
      total: Number(stats.total || 0),
      totalScans: Number(stats.total_scans || 0),
      uniqueScans: Number(stats.unique_scans || 0),
      monthScans: Number(stats.month_scans || 0),
      active: Number(stats.active_count || 0),
      expired: Number(stats.expired_count || 0),
      archived: Number(stats.archived_count || 0),
    },
    pagination: { page, pageSize, total: totalNum, totalPages, from: totalNum === 0 ? 0 : offset + 1, to: Math.min(offset + pageSize, totalNum) },
  };
}

export type QrUpdateInput = {
  foregroundColor?: string;
  backgroundColor?: string;
  patternStyle?: string;
  cornerStyle?: string;
  logoUrl?: string | null;
  logoSize?: number;
  frameEnabled?: boolean;
  frameStyle?: string;
  frameColor?: string;
  frameText?: string;
};

export async function updateCustomerQrCode(input: {
  customerUid: string;
  userId: number;
  id: number;
  patch: QrUpdateInput;
}) {
  await ensureQrSchema();
  const rows = await query<{ id: number }>(
    `SELECT id FROM product_qr_codes WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL) AND deleted_at IS NULL LIMIT 1`,
    [input.id, input.customerUid, input.userId],
  );
  if (!rows.length) return { error: "QR code not found." as const };

  const sets: string[] = [];
  const params: QueryValue[] = [];
  const p = input.patch;
  if (p.foregroundColor !== undefined) { sets.push("foreground_color = ?"); params.push(p.foregroundColor); }
  if (p.backgroundColor !== undefined) { sets.push("background_color = ?"); params.push(p.backgroundColor); }
  if (p.patternStyle !== undefined) { sets.push("pattern_style = ?"); params.push(p.patternStyle); }
  if (p.cornerStyle !== undefined) { sets.push("corner_style = ?"); params.push(p.cornerStyle); }
  if (p.logoUrl !== undefined) { sets.push("logo_url = ?"); params.push(p.logoUrl); }
  if (p.logoSize !== undefined) { sets.push("logo_size = ?"); params.push(p.logoSize); }
  if (p.frameEnabled !== undefined) { sets.push("frame_enabled = ?"); params.push(p.frameEnabled ? 1 : 0); }
  if (p.frameStyle !== undefined) { sets.push("frame_style = ?"); params.push(p.frameStyle); }
  if (p.frameColor !== undefined) { sets.push("frame_color = ?"); params.push(p.frameColor); }
  if (p.frameText !== undefined) { sets.push("frame_text = ?"); params.push(p.frameText); }
  if (!sets.length) return { error: "No changes provided." as const };

  await query(`UPDATE product_qr_codes SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ?`, [...params, input.id]);
  return { success: true as const };
}

export async function getQrCodeByQrCode(qrCode: string) {
  await ensureQrSchema();
  const rows = await query<QrRow & { customer_uid: string }>(
    `SELECT q.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status,
            p.public_id AS product_public_id, p.qr_url
     FROM product_qr_codes q INNER JOIN products p ON p.id = q.product_id
     WHERE (q.qr_code = ? OR q.qr_uid = ? OR q.public_id = ?) AND q.deleted_at IS NULL LIMIT 1`,
    [qrCode, qrCode, qrCode],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return { ...mapRow(row, ""), qrCodeId: row.id, customerUid: row.customer_uid };
}

export async function getQrCodeByPublicId(publicId: string) {
  return getQrCodeByQrCode(publicId);
}

export async function getQrCodeById(id: number, customerUid: string, userId: number, origin = "") {
  await ensureQrSchema();
  const rows = await query<QrRow>(
    `SELECT q.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status,
            p.public_id AS product_public_id, p.qr_url
     FROM product_qr_codes q INNER JOIN products p ON p.id = q.product_id
     WHERE q.id = ? AND q.customer_uid = ? AND (q.user_id = ? OR q.user_id IS NULL) LIMIT 1`,
    [id, customerUid, userId],
  );
  if (!rows.length) return null;
  return mapRow(rows[0], origin);
}

export async function trackQrScan(input: {
  qrCodeId: number;
  qrCode: string;
  customerUid: string;
  productId: string;
  sessionId: string;
  request: Request;
}) {
  const ua = input.request.headers.get("user-agent") ?? "";
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);
  const country = input.request.headers.get("x-vercel-ip-country") ?? input.request.headers.get("cf-ipcountry") ?? "";
  const referrer = input.request.headers.get("referer") || "";

  const prior = await query<{ id: number }>(
    `SELECT id FROM qr_scan_events WHERE qr_code_id = ? AND anonymous_session_id = ? LIMIT 1`,
    [input.qrCodeId, input.sessionId],
  );
  const isUnique = prior.length === 0;

  await query(
    `UPDATE product_qr_codes SET scans = scans + 1, unique_scans = unique_scans + ?, last_scan_at = NOW() WHERE id = ?`,
    [isUnique ? 1 : 0, input.qrCodeId],
  );

  await query(
    `INSERT INTO qr_scan_events (qr_code_id, qr_uid, customer_uid, product_id, anonymous_session_id, device, browser, country, source, referrer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'qr', ?)`,
    [input.qrCodeId, input.qrCode, input.customerUid, input.productId, input.sessionId, device, browser, country, referrer],
  );

  const productPublic = await query<{ public_id: string | null }>(
    `SELECT public_id FROM products WHERE id = ? LIMIT 1`,
    [input.productId],
  );
  const publicId = productPublic[0]?.public_id || input.productId;

  await trackAnalyticsFromServer({
    event: "download_qr",
    customerUid: input.customerUid,
    productUid: publicId,
    sessionId: input.sessionId,
    request: input.request,
    meta: { source: "qr", qrCode: input.qrCode, trafficSource: "qr" },
  });
}

export type QrAnalytics = {
  totalScans: number;
  uniqueScans: number;
  arLaunches: number;
  lastScanAt: string | null;
  devices: Array<{ device: string; count: number }>;
  browsers: Array<{ browser: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
};

export async function getQrAnalytics(qrCodeId: number, customerUid: string): Promise<QrAnalytics | null> {
  const rows = await query<{ scans: number; unique_scans: number; ar_launches: number; last_scan_at: string | null }>(
    `SELECT scans, unique_scans, ar_launches, last_scan_at FROM product_qr_codes WHERE id = ? AND customer_uid = ? LIMIT 1`,
    [qrCodeId, customerUid],
  );
  if (!rows.length) return null;

  const [devices, browsers, countries] = await Promise.all([
    query<{ device: string; count: number }>(`SELECT device, COUNT(*) AS count FROM qr_scan_events WHERE qr_code_id = ? GROUP BY device ORDER BY count DESC LIMIT 10`, [qrCodeId]),
    query<{ browser: string; count: number }>(`SELECT browser, COUNT(*) AS count FROM qr_scan_events WHERE qr_code_id = ? GROUP BY browser ORDER BY count DESC LIMIT 10`, [qrCodeId]),
    query<{ country: string; count: number }>(`SELECT country, COUNT(*) AS count FROM qr_scan_events WHERE qr_code_id = ? AND country <> '' GROUP BY country ORDER BY count DESC LIMIT 10`, [qrCodeId]),
  ]);

  return {
    totalScans: Number(rows[0].scans || 0),
    uniqueScans: Number(rows[0].unique_scans || 0),
    arLaunches: Number(rows[0].ar_launches || 0),
    lastScanAt: rows[0].last_scan_at,
    devices,
    browsers,
    countries,
  };
}

export async function createCustomerQrCode() {
  return { error: "Permanent QR codes are created automatically when you publish a product.", code: "QR_PERMANENT_ONLY" } as const;
}
