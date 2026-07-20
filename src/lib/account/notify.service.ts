import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { ensureUserPanelSchema } from "@/lib/user-panel/schema";
import type { CustomerNotificationCategory } from "@/lib/notifications/policy";

export type NotificationCategory = CustomerNotificationCategory;

export async function createCustomerNotification(input: {
  customerUid: string;
  userId?: number;
  category: NotificationCategory;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey?: string;
}) {
  await ensureUserPanelSchema();

  const uid = `ntf-${randomBytes(8).toString("hex")}`;
  const result = await query(
    `${input.dedupeKey ? "INSERT IGNORE" : "INSERT"} INTO customer_notifications
      (notification_uid, customer_uid, user_id, category, title, body, href, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      input.customerUid,
      input.userId ?? null,
      input.category,
      input.title,
      input.body,
      input.href ?? null,
      input.dedupeKey ?? null,
    ],
  );
  if (
    input.dedupeKey &&
    Number((result as unknown as { affectedRows?: number }).affectedRows || 0) === 0
  ) {
    const existing = await query<{ notification_uid: string }>(
      `SELECT notification_uid FROM customer_notifications
       WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,
      [input.customerUid, input.dedupeKey],
    );
    return { skipped: true as const, id: existing[0]?.notification_uid || uid };
  }

  return { created: true as const, id: uid };
}

export type NotificationPreferences = {
  product: { inApp: boolean; email: boolean };
  billing: { inApp: boolean; email: boolean };
  subscription: { inApp: boolean; email: boolean };
  usage: { inApp: boolean; email: boolean };
  support: { inApp: boolean; email: boolean };
  security: { inApp: boolean; email: boolean };
  marketing: { inApp: boolean; email: boolean };
};

const DEFAULT_PREFS: NotificationPreferences = {
  product: { inApp: true, email: true },
  billing: { inApp: true, email: true },
  subscription: { inApp: true, email: true },
  usage: { inApp: true, email: true },
  support: { inApp: true, email: true },
  security: { inApp: true, email: true },
  marketing: { inApp: false, email: false },
};

export async function getNotificationPreferences(userId: number) {
  await ensureUserPanelSchema();
  const rows = await query<{ email_notification_preferences_json: string | null }>(
    `SELECT email_notification_preferences_json FROM user_preferences WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  if (!rows[0]?.email_notification_preferences_json) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(rows[0].email_notification_preferences_json) as Partial<NotificationPreferences>;
    return {
      product: { ...DEFAULT_PREFS.product, ...parsed.product },
      billing: { ...DEFAULT_PREFS.billing, ...parsed.billing },
      subscription: { ...DEFAULT_PREFS.subscription, ...parsed.subscription },
      usage: { ...DEFAULT_PREFS.usage, ...parsed.usage },
      support: { ...DEFAULT_PREFS.support, ...parsed.support },
      security: { ...DEFAULT_PREFS.security, ...parsed.security },
      marketing: { ...DEFAULT_PREFS.marketing, ...parsed.marketing },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPreferences(
  userId: number,
  customerUid: string,
  prefs: NotificationPreferences,
) {
  await ensureUserPanelSchema();
  // Security notifications cannot be fully disabled
  const safe: NotificationPreferences = {
    ...prefs,
    security: { inApp: true, email: prefs.security.email },
  };

  const existing = await query<{ id: number }>(
    "SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1",
    [userId],
  );

  if (existing.length) {
    await query(
      `UPDATE user_preferences SET email_notification_preferences_json = ?, updated_at = NOW() WHERE user_id = ?`,
      [JSON.stringify(safe), userId],
    );
  } else {
    await query(
      `INSERT INTO user_preferences (user_id, customer_uid, email_notification_preferences_json)
       VALUES (?, ?, ?)`,
      [userId, customerUid, JSON.stringify(safe)],
    );
  }

  return safe;
}
