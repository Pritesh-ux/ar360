import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { ensureAccountSchema } from "@/lib/account/schema";

export async function writeCustomerActivity(input: {
  customerUid: string;
  userId?: number;
  eventType: string;
  title: string;
  detail?: string;
  meta?: Record<string, string | number | boolean>;
}) {
  await ensureAccountSchema();
  const uid = `act-${randomBytes(8).toString("hex")}`;
  await query(
    `INSERT INTO customer_activity_logs (activity_uid, customer_uid, user_id, event_type, title, detail, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      input.customerUid,
      input.userId ?? null,
      input.eventType,
      input.title,
      input.detail || "",
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
}

export async function listCustomerActivity(input: {
  customerUid: string;
  page?: number;
  pageSize?: number;
}) {
  await ensureAccountSchema();
  const page = Math.max(1, input.page || 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    query<{
      activity_uid: string;
      event_type: string;
      title: string;
      detail: string;
      created_at: string;
    }>(
      `SELECT activity_uid, event_type, title, detail, created_at
       FROM customer_activity_logs
       WHERE customer_uid = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [input.customerUid, pageSize, offset],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM customer_activity_logs WHERE customer_uid = ?`,
      [input.customerUid],
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    items: rows.map((r) => ({
      id: r.activity_uid,
      eventType: r.event_type,
      title: r.title,
      detail: r.detail,
      createdAt: r.created_at,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
