import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { ensureAccountSchema } from "@/lib/account/schema";
import { parseBrowser, parseDevice } from "@/server/analytics/analytics.middleware";
import { createHmac } from "crypto";

function hashIp(ip?: string | null) {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET || "dev-only-change-this-auth-secret";
  if (!ip) return "";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 64);
}

function maskIp(ipHash: string) {
  if (!ipHash) return "—";
  return `${ipHash.slice(0, 6)}…${ipHash.slice(-4)}`;
}

export type CustomerSessionRecord = {
  sessionUid: string;
  device: string;
  browser: string;
  country: string;
  ipMasked: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
};

export async function createCustomerSessionRecord(input: {
  userId: number;
  customerUid: string;
  request?: Request;
}) {
  await ensureAccountSchema();
  const sessionUid = `sess-${randomBytes(12).toString("hex")}`;
  const ua = input.request?.headers.get("user-agent") ?? "";
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);
  const country =
    input.request?.headers.get("x-vercel-ip-country") ??
    input.request?.headers.get("cf-ipcountry") ??
    "";
  const forwarded = input.request?.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || input.request?.headers.get("x-real-ip") || "";

  await query(
    `INSERT INTO customer_sessions (session_uid, user_id, customer_uid, device, browser, country, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionUid, input.userId, input.customerUid, device, browser, country, hashIp(ip), ua.slice(0, 255)],
  );

  return sessionUid;
}

export async function touchCustomerSession(sessionUid: string) {
  await query("UPDATE customer_sessions SET last_active_at = NOW() WHERE session_uid = ? AND revoked_at IS NULL", [
    sessionUid,
  ]);
}

export async function getUserSessionVersion(userId: number) {
  await ensureAccountSchema();
  const rows = await query<{ session_version: number }>(
    "SELECT session_version FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  return Number(rows[0]?.session_version || 1);
}

export async function isSessionValid(input: { userId: number; sessionUid?: string; sessionVersion?: number }) {
  await ensureAccountSchema();
  const version = await getUserSessionVersion(input.userId);
  if (input.sessionVersion !== undefined && input.sessionVersion !== version) return false;
  if (!input.sessionUid) return true;

  const rows = await query<{ id: number }>(
    `SELECT id FROM customer_sessions WHERE session_uid = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1`,
    [input.sessionUid, input.userId],
  );
  return rows.length > 0;
}

export async function listCustomerSessions(input: {
  userId: number;
  customerUid: string;
  currentSessionUid?: string;
}) {
  await ensureAccountSchema();
  const rows = await query<{
    session_uid: string;
    device: string;
    browser: string;
    country: string;
    ip_hash: string;
    last_active_at: string;
    created_at: string;
  }>(
    `SELECT session_uid, device, browser, country, ip_hash, last_active_at, created_at
     FROM customer_sessions
     WHERE user_id = ? AND customer_uid = ? AND revoked_at IS NULL
     ORDER BY last_active_at DESC
     LIMIT 20`,
    [input.userId, input.customerUid],
  );

  return rows.map(
    (row) =>
      ({
        sessionUid: row.session_uid,
        device: row.device,
        browser: row.browser,
        country: row.country || "—",
        ipMasked: maskIp(row.ip_hash),
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
        isCurrent: row.session_uid === input.currentSessionUid,
      }) satisfies CustomerSessionRecord,
  );
}

export async function revokeCustomerSession(input: {
  userId: number;
  customerUid: string;
  sessionUid: string;
}) {
  await ensureAccountSchema();
  const result = await query(
    `UPDATE customer_sessions SET revoked_at = NOW()
     WHERE session_uid = ? AND user_id = ? AND customer_uid = ? AND revoked_at IS NULL`,
    [input.sessionUid, input.userId, input.customerUid],
  );
  return (result as { affectedRows?: number }).affectedRows !== 0;
}

export async function revokeAllOtherSessions(input: {
  userId: number;
  customerUid: string;
  keepSessionUid?: string;
}) {
  await ensureAccountSchema();
  if (input.keepSessionUid) {
    await query(
      `UPDATE customer_sessions SET revoked_at = NOW()
       WHERE user_id = ? AND customer_uid = ? AND session_uid <> ? AND revoked_at IS NULL`,
      [input.userId, input.customerUid, input.keepSessionUid],
    );
  } else {
    await query(
      `UPDATE customer_sessions SET revoked_at = NOW()
       WHERE user_id = ? AND customer_uid = ? AND revoked_at IS NULL`,
      [input.userId, input.customerUid],
    );
  }
  await query("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [input.userId]);
  return getUserSessionVersion(input.userId);
}

export async function bumpSessionVersion(userId: number) {
  await query("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [userId]);
  return getUserSessionVersion(userId);
}
