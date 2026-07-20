import { query } from "@/lib/db";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import type { CustomerNotificationCategory } from "@/lib/notifications/policy";

export type CustomerNotification = {
  id: string;
  category: CustomerNotificationCategory;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

type Row = {
  notification_uid: string;
  category: CustomerNotificationCategory;
  title: string;
  body: string;
  href: string | null;
  is_read: 0 | 1 | boolean;
  created_at: string;
};

function mapRow(row: Row): CustomerNotification {
  return {
    id: row.notification_uid,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

export async function listCustomerNotifications(customerUid: string, limit = 20) {
  await ensureUserPanelSchema();
  const rows = await query<Row>(
    `SELECT notification_uid, category, title, body, href, is_read, created_at
     FROM customer_notifications
     WHERE customer_uid = ?
     ORDER BY is_read ASC, created_at DESC
     LIMIT ?`,
    [customerUid, Math.min(Math.max(limit, 1), 50)],
  );
  return rows.map(mapRow);
}

export async function countUnreadCustomerNotifications(customerUid: string) {
  await ensureUserPanelSchema();
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM customer_notifications
     WHERE customer_uid = ? AND is_read = FALSE`,
    [customerUid],
  );
  return Number(rows[0]?.total || 0);
}

export async function markCustomerNotificationsRead(
  customerUid: string,
  ids: string[],
  markAll = false,
) {
  await ensureUserPanelSchema();
  if (markAll) {
    await query(
      `UPDATE customer_notifications SET is_read = TRUE, read_at = NOW()
       WHERE customer_uid = ? AND is_read = FALSE`,
      [customerUid],
    );
    return;
  }
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  await query(
    `UPDATE customer_notifications SET is_read = TRUE, read_at = NOW()
     WHERE customer_uid = ? AND notification_uid IN (${placeholders})`,
    [customerUid, ...ids],
  );
}

export async function clearCustomerNotifications(customerUid: string) {
  await ensureUserPanelSchema();
  await query(`DELETE FROM customer_notifications WHERE customer_uid = ?`, [customerUid]);
}

export async function deleteCustomerNotifications(customerUid: string, ids: string[]) {
  await ensureUserPanelSchema();
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  await query(
    `DELETE FROM customer_notifications
     WHERE customer_uid = ? AND notification_uid IN (${placeholders})`,
    [customerUid, ...ids],
  );
}
