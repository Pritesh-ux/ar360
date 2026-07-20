import { randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensureProductSchema, query, type QueryValue } from "@/lib/db";
import { checkShareLinkLimit } from "@/lib/billing/limit-enforcement";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";

export type ShareLinkType = "public" | "embed" | "email";
export type ShareLifecycleStatus = "active" | "expired" | "archived" | "disabled";
export type ShareStatusFilter = "active" | "expired" | "archived" | "all";

export type ShareLinkRecord = {
  id: number;
  shareUid: string;
  publicId: string;
  token: string;
  customerUid: string;
  productId: string;
  linkType: ShareLinkType;
  slug: string | null;
  label: string;
  destinationUrl: string;
  shareUrl: string;
  embedCode: string | null;
  status: ShareLifecycleStatus;
  effectiveStatus: ShareLifecycleStatus;
  expiresAt: string | null;
  hasPassword: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  poster: string;
  productStatus: string;
};

export type ShareListFilters = {
  customerUid: string;
  userId: number;
  origin: string;
  q?: string;
  status?: ShareStatusFilter;
  linkType?: ShareLinkType | "all";
  productId?: string;
  page?: number;
  pageSize?: number;
};

export type ShareListResult = {
  shareLinks: ShareLinkRecord[];
  stats: {
    total: number;
    totalViews: number;
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

type ShareRow = {
  id: number;
  share_uid: string;
  public_id: string;
  customer_uid: string;
  token: string;
  product_id: string;
  link_type: ShareLinkType;
  slug: string | null;
  destination_url: string;
  status: string;
  expires_at: string | null;
  password_hash: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  title: string;
  poster: string | null;
  thumbnail_url: string | null;
  product_status: string;
};

export function makeShareUid() {
  return `share_${randomBytes(8).toString("hex")}`;
}

export function makeShareToken() {
  return randomBytes(16).toString("hex");
}

export function buildShareDestinationUrl(input: {
  origin: string;
  productId: string;
  token: string;
  linkType: ShareLinkType;
}) {
  const base =
    input.linkType === "embed"
      ? `${input.origin}/embed/${encodeURIComponent(input.productId)}`
      : `${input.origin}/viewer/${encodeURIComponent(input.productId)}`;
  const url = new URL(base);
  url.searchParams.set("share", input.token);
  if (input.linkType === "email") url.searchParams.set("source", "email");
  return url.toString();
}

export function buildSharePublicUrl(origin: string, token: string) {
  return `${origin}/s/${token}`;
}

export function buildEmbedIframeCode(origin: string, productId: string) {
  const src = `${origin}/embed/${encodeURIComponent(productId)}`;
  return `<iframe src="${src}" title="AR360 3D Viewer" width="100%" height="480" style="border:0;border-radius:16px;" allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"></iframe>`;
}

export function resolveEffectiveShareStatus(row: {
  status?: string | null;
  expires_at?: string | null;
  deleted_at?: string | null;
}): ShareLifecycleStatus {
  if (row.deleted_at) return "archived";
  const base = String(row.status || "active").toLowerCase();
  if (base === "archived" || base === "disabled") return base as ShareLifecycleStatus;
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (Number.isFinite(exp) && Date.now() > exp) return "expired";
  }
  if (base === "expired") return "expired";
  return "active";
}

function mapRow(row: ShareRow, origin: string): ShareLinkRecord {
  const effectiveStatus = resolveEffectiveShareStatus(row);
  const linkType = row.link_type || "public";
  return {
    id: row.id,
    shareUid: row.share_uid,
    publicId: row.public_id,
    token: row.token,
    customerUid: row.customer_uid,
    productId: row.product_id,
    linkType,
    slug: row.slug,
    label: row.slug || `${linkType} · ${row.title}`,
    destinationUrl: row.destination_url,
    shareUrl: buildSharePublicUrl(origin, row.token),
    embedCode: linkType === "embed" ? buildEmbedIframeCode(origin, row.product_id) : null,
    status: (String(row.status || "active").toLowerCase() as ShareLifecycleStatus) || "active",
    effectiveStatus,
    expiresAt: row.expires_at,
    hasPassword: Boolean(row.password_hash),
    viewCount: Number(row.view_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    poster: row.poster ?? row.thumbnail_url ?? "",
    productStatus: row.product_status,
  };
}

function statusWhereClause(filter: ShareStatusFilter) {
  if (filter === "archived") {
    return "(s.deleted_at IS NOT NULL OR s.status IN ('archived','disabled'))";
  }
  if (filter === "expired") {
    return "(s.deleted_at IS NULL AND (s.status = 'expired' OR (s.expires_at IS NOT NULL AND s.expires_at <= NOW())))";
  }
  if (filter === "active") {
    return "(s.deleted_at IS NULL AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW()))";
  }
  return "1=1";
}

export async function listCustomerShareLinks(filters: ShareListFilters): Promise<ShareListResult> {
  await ensureProductSchema();
  await ensureUserPanelSchema();

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 12));
  const offset = (page - 1) * pageSize;
  const statusFilter = filters.status || "all";

  const where: string[] = [
    "s.customer_uid = ?",
    "(s.user_id = ? OR s.user_id IS NULL)",
    statusWhereClause(statusFilter),
  ];
  const params: QueryValue[] = [filters.customerUid, filters.userId];

  if (filters.productId) {
    where.push("s.product_id = ?");
    params.push(filters.productId);
  }

  if (filters.linkType && filters.linkType !== "all") {
    where.push("s.link_type = ?");
    params.push(filters.linkType);
  }

  const q = filters.q?.trim();
  if (q) {
    where.push("(p.title LIKE ? OR s.product_id LIKE ? OR s.slug LIKE ? OR s.share_uid LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const whereSql = where.join(" AND ");

  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM share_links s
     INNER JOIN products p ON p.id = s.product_id
     WHERE ${whereSql}`,
    params,
  );

  const rows = await query<ShareRow>(
    `SELECT s.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status
     FROM share_links s
     INNER JOIN products p ON p.id = s.product_id
     WHERE ${whereSql}
     ORDER BY s.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const statsRows = await query<{
    total: number;
    total_views: number;
    active_count: number;
    expired_count: number;
    archived_count: number;
  }>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(s.view_count), 0) AS total_views,
       SUM(CASE WHEN s.deleted_at IS NULL AND s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW()) THEN 1 ELSE 0 END) AS active_count,
       SUM(CASE WHEN s.deleted_at IS NULL AND (s.status = 'expired' OR (s.expires_at IS NOT NULL AND s.expires_at <= NOW())) THEN 1 ELSE 0 END) AS expired_count,
       SUM(CASE WHEN s.deleted_at IS NOT NULL OR s.status IN ('archived','disabled') THEN 1 ELSE 0 END) AS archived_count
     FROM share_links s
     WHERE s.customer_uid = ? AND (s.user_id = ? OR s.user_id IS NULL)`,
    [filters.customerUid, filters.userId],
  );

  const stats = statsRows[0] || {
    total: 0,
    total_views: 0,
    active_count: 0,
    expired_count: 0,
    archived_count: 0,
  };

  const totalNum = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalNum / pageSize));

  return {
    shareLinks: rows.map((row) => mapRow(row, filters.origin)),
    stats: {
      total: Number(stats.total || 0),
      totalViews: Number(stats.total_views || 0),
      active: Number(stats.active_count || 0),
      expired: Number(stats.expired_count || 0),
      archived: Number(stats.archived_count || 0),
    },
    pagination: {
      page,
      pageSize,
      total: totalNum,
      totalPages,
      from: totalNum === 0 ? 0 : offset + 1,
      to: Math.min(offset + pageSize, totalNum),
    },
  };
}

export async function createCustomerShareLink(input: {
  customerUid: string;
  userId: number;
  productId: string;
  origin: string;
  linkType?: ShareLinkType;
  slug?: string | null;
  expiresAt?: string | null;
  password?: string | null;
}) {
  await ensureProductSchema();
  await ensureUserPanelSchema();

  const owns = await query<{ id: string }>(
    `SELECT id FROM products
     WHERE id = ? AND customer_uid = ? AND (user_id = ? OR user_id IS NULL)
     LIMIT 1`,
    [input.productId, input.customerUid, input.userId],
  );
  if (!owns.length) return { error: "Product not found." as const };

  const limitCheck = await checkShareLinkLimit(input.customerUid);
  if (limitCheck.ok === false) {
    return { error: limitCheck.message, code: limitCheck.code } as const;
  }

  const linkType = input.linkType || "public";
  const shareUid = makeShareUid();
  const token = makeShareToken();
  const publicId = shareUid;

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) return { error: "Invalid expiry date." as const };
  }

  const passwordHash = input.password?.trim() ? hashPassword(input.password.trim()) : null;
  const destinationUrl = buildShareDestinationUrl({
    origin: input.origin,
    productId: input.productId,
    token,
    linkType,
  });

  await query(
    `INSERT INTO share_links
      (share_uid, public_id, customer_uid, user_id, product_id, link_type, slug, token, destination_url, expires_at, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      shareUid,
      publicId,
      input.customerUid,
      input.userId,
      input.productId,
      linkType,
      input.slug?.trim().slice(0, 120) || null,
      token,
      destinationUrl,
      expiresAt ? expiresAt.toISOString().slice(0, 19).replace("T", " ") : null,
      passwordHash,
    ],
  );

  const rows = await query<ShareRow>(
    `SELECT s.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status
     FROM share_links s
     INNER JOIN products p ON p.id = s.product_id
     WHERE s.token = ? LIMIT 1`,
    [token],
  );
  if (!rows.length) return { error: "Failed to create share link." as const };
  return { shareLink: mapRow(rows[0], input.origin) };
}

export type ShareUpdateInput = {
  slug?: string | null;
  linkType?: ShareLinkType;
  expiresAt?: string | null;
  password?: string | null;
  clearPassword?: boolean;
  status?: "active" | "archived";
};

export async function updateCustomerShareLink(input: {
  customerUid: string;
  userId: number;
  id: number;
  origin: string;
  patch: ShareUpdateInput;
}) {
  await ensureUserPanelSchema();

  const rows = await query<ShareRow>(
    `SELECT s.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status
     FROM share_links s
     INNER JOIN products p ON p.id = s.product_id
     WHERE s.id = ? AND s.customer_uid = ? AND (s.user_id = ? OR s.user_id IS NULL)
     LIMIT 1`,
    [input.id, input.customerUid, input.userId],
  );
  if (!rows.length) return { error: "Share link not found." as const };

  const current = rows[0];
  const sets: string[] = [];
  const params: QueryValue[] = [];

  if (input.patch.slug !== undefined) {
    sets.push("slug = ?");
    params.push(input.patch.slug?.trim().slice(0, 120) || null);
  }

  let linkType = current.link_type;
  if (input.patch.linkType) {
    linkType = input.patch.linkType;
    sets.push("link_type = ?");
    params.push(linkType);
  }

  if (input.patch.linkType) {
    sets.push("destination_url = ?");
    params.push(
      buildShareDestinationUrl({
        origin: input.origin,
        productId: current.product_id,
        token: current.token,
        linkType,
      }),
    );
  }

  if (input.patch.expiresAt !== undefined) {
    if (input.patch.expiresAt === null || input.patch.expiresAt === "") {
      sets.push("expires_at = NULL");
    } else {
      const exp = new Date(input.patch.expiresAt);
      if (!Number.isFinite(exp.getTime())) return { error: "Invalid expiry date." as const };
      sets.push("expires_at = ?");
      params.push(exp.toISOString().slice(0, 19).replace("T", " "));
    }
  }

  if (input.patch.clearPassword) {
    sets.push("password_hash = NULL");
  } else if (input.patch.password?.trim()) {
    sets.push("password_hash = ?");
    params.push(hashPassword(input.patch.password.trim()));
  }

  if (input.patch.status === "archived") {
    sets.push("status = 'archived'", "deleted_at = NOW()");
  } else if (input.patch.status === "active") {
    sets.push("status = 'active'", "deleted_at = NULL");
  }

  if (!sets.length) return { ok: true as const };

  await query(`UPDATE share_links SET ${sets.join(", ")} WHERE id = ?`, [...params, input.id]);
  return { ok: true as const };
}

export async function getShareLinkByToken(token: string, origin: string) {
  await ensureUserPanelSchema();
  const rows = await query<ShareRow>(
    `SELECT s.*, p.title, p.poster, p.thumbnail_url, p.status AS product_status
     FROM share_links s
     INNER JOIN products p ON p.id = s.product_id
     WHERE s.token = ? OR s.public_id = ? OR s.share_uid = ?
     LIMIT 1`,
    [token, token, token],
  );
  if (!rows.length) return null;
  return mapRow(rows[0], origin);
}

export async function resolveShareLinkAccess(input: {
  token: string;
  origin: string;
  password?: string | null;
}) {
  const link = await getShareLinkByToken(input.token, input.origin);
  if (!link) return { ok: false as const, reason: "not-found" as const };

  if (String(link.productStatus || "").toLowerCase() !== "published" && String(link.productStatus || "").toLowerCase() !== "active") {
    return { ok: false as const, reason: "unpublished" as const };
  }

  if (link.effectiveStatus !== "active") {
    return { ok: false as const, reason: link.effectiveStatus };
  }

  const rows = await query<{ password_hash: string | null }>(
    "SELECT password_hash FROM share_links WHERE id = ? LIMIT 1",
    [link.id],
  );
  const hash = rows[0]?.password_hash;
  if (hash) {
    if (!input.password || !verifyPassword(input.password, hash)) {
      return { ok: false as const, reason: "password" as const, link };
    }
  }

  return { ok: true as const, link };
}

export async function recordShareLinkView(link: ShareLinkRecord, referrer = "", request?: Request) {
  await query("UPDATE share_links SET view_count = view_count + 1 WHERE id = ?", [link.id]).catch(() => {});

  let device = "unknown";
  let browser = "unknown";
  let country = "";
  if (request) {
    const ua = request.headers.get("user-agent") ?? "";
    const { parseBrowser, parseDevice } = await import("@/server/analytics/analytics.middleware");
    device = parseDevice(ua);
    browser = parseBrowser(ua);
    country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? "";
  }

  await query(
    `INSERT INTO share_events
      (share_link_id, share_uid, customer_uid, product_id, event_type, referrer, device, browser, country)
     VALUES (?, ?, ?, ?, 'view', ?, ?, ?, ?)`,
    [link.id, link.shareUid, link.customerUid, link.productId, referrer, device, browser, country],
  ).catch(() => {});
}
