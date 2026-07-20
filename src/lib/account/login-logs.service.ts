import { query } from "@/lib/db";
import { ensureAuthSchema } from "@/lib/db";

function maskIpHash(hash: string) {
  if (!hash) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export async function listCustomerLoginLogs(input: {
  userId: number;
  email: string;
  page?: number;
  pageSize?: number;
}) {
  await ensureAuthSchema();
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 20));
  const offset = (page - 1) * pageSize;
  const normalizedEmail = input.email.toLowerCase();

  const [rows, countRows] = await Promise.all([
    query<{
      status: string;
      reason: string;
      ip_hash: string;
      user_agent: string;
      created_at: string;
    }>(
      `SELECT status, reason, ip_hash, user_agent, created_at
       FROM auth_login_logs
       WHERE actor_type = 'customer' AND (actor_id = ? OR email = ?)
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [input.userId, normalizedEmail, pageSize, offset],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM auth_login_logs
       WHERE actor_type = 'customer' AND (actor_id = ? OR email = ?)`,
      [input.userId, normalizedEmail],
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);

  return {
    items: rows.map((row) => ({
      status: row.status,
      reason: row.reason || "",
      ipMasked: maskIpHash(row.ip_hash),
      userAgent: row.user_agent || "Unknown",
      createdAt: row.created_at,
      device: parseDeviceFromUa(row.user_agent),
      browser: parseBrowserFromUa(row.user_agent),
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

function parseDeviceFromUa(ua: string) {
  const lower = ua.toLowerCase();
  if (/mobile|android|iphone/.test(lower)) return "mobile";
  if (/ipad|tablet/.test(lower)) return "tablet";
  if (ua) return "desktop";
  return "unknown";
}

function parseBrowserFromUa(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  return "Other";
}
