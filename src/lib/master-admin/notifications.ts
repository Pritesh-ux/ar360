import { query } from "@/lib/db";

export type AdminNotificationCategory =
  | "billing"
  | "support"
  | "customer"
  | "product"
  | "system"
  | "security";

export type AdminNotificationRow = {
  notification_uid: string;
  category: AdminNotificationCategory;
  title: string;
  body: string;
  href: string | null;
  is_read: 0 | 1 | boolean;
  created_at: string;
};

export type AdminNotification = {
  id: string;
  category: AdminNotificationCategory;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

function mapNotification(row: AdminNotificationRow): AdminNotification {
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

type DerivedNotification = {
  notificationUid: string;
  category: AdminNotificationCategory;
  title: string;
  body: string;
  href: string | null;
};

async function upsertDerivedNotification(item: DerivedNotification) {
  await query(
    `INSERT INTO admin_notifications (notification_uid, admin_id, category, title, body, href, is_read)
     VALUES (?, NULL, ?, ?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       title = VALUES(title),
       body = VALUES(body),
       href = VALUES(href)`,
    [item.notificationUid, item.category, item.title, item.body, item.href],
  );
}

/** Real-time admin alert for a specific platform event (e.g. new support ticket). */
export async function createAdminNotification(input: {
  notificationUid: string;
  category: AdminNotificationCategory;
  title: string;
  body: string;
  href?: string | null;
}) {
  const { ensureAdminNotificationsSchema } = await import("@/lib/db");
  await ensureAdminNotificationsSchema();

  const body = input.body.trim().slice(0, 512);
  const title = input.title.trim().slice(0, 255);

  await query(
    `INSERT INTO admin_notifications (notification_uid, admin_id, category, title, body, href, is_read)
     VALUES (?, NULL, ?, ?, ?, ?, FALSE)
     ON DUPLICATE KEY UPDATE
       category = VALUES(category),
       title = VALUES(title),
       body = VALUES(body),
       href = VALUES(href),
       is_read = FALSE,
       read_at = NULL,
       dismissed_at = NULL,
       created_at = CURRENT_TIMESTAMP`,
    [input.notificationUid, input.category, title, body, input.href ?? null],
  );
}

async function removeDerivedNotification(notificationUid: string) {
  await query(
    `DELETE FROM admin_notifications
     WHERE admin_id IS NULL AND notification_uid = ?`,
    [notificationUid],
  );
}

async function purgeLegacyDemoNotifications() {
  await query(
    `DELETE FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL
       AND category = 'system'
       AND title = 'Master Admin shell ready'`,
  );
}

/** Sync platform-derived alerts into admin_notifications (idempotent). */
export async function syncAdminNotifications() {
  await purgeLegacyDemoNotifications();

  const [failedPayments, openHighTickets, pendingPayments, recentCustomers, recentEnterpriseRequests, captureOps] =
    await Promise.all([
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM billing_payments
       WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    ).catch(() => [{ total: 0 }]),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM support_tickets
       WHERE status IN ('open','pending') AND priority = 'high'`,
    ).catch(() => [{ total: 0 }]),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM billing_payments
       WHERE status NOT IN ('captured','failed','refunded')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    ).catch(() => [{ total: 0 }]),
    query<{
      customer_uid: string;
      contact_name: string;
      email: string;
      company_name: string | null;
    }>(
      `SELECT customer_uid, contact_name, email, company_name
         FROM customers
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        ORDER BY created_at DESC
        LIMIT 50`,
    ).catch(() => []),
    query<{
      request_uid: string;
      company_name: string;
      contact_name: string;
      business_email: string;
      country: string;
      state: string | null;
    }>(
      `SELECT request_uid, company_name, contact_name, business_email, country, state
         FROM enterprise_requests
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY created_at DESC
        LIMIT 50`,
    ).catch(() => []),
    query<{ queued: number; stale: number; oldestAge: number }>(
      `SELECT SUM(status='queued') queued,
       SUM(status='processing' AND lease_expires_at<NOW()) stale,
       COALESCE(MAX(IF(status='queued',TIMESTAMPDIFF(SECOND,created_at,NOW()),0)),0) oldestAge
       FROM object_capture_jobs`,
    ).catch(() => [{ queued: 0, stale: 0, oldestAge: 0 }]),
  ]);

  const failed = Number(failedPayments[0]?.total || 0);
  if (failed > 0) {
    await upsertDerivedNotification({
      notificationUid: "derived:failed-payments-7d",
      category: "billing",
      title: `${failed} failed payment${failed === 1 ? "" : "s"} this week`,
      body: "Review failed transactions and retry or contact customers.",
      href: "/master-admin/billing?status=Failed",
    });
  } else {
    await removeDerivedNotification("derived:failed-payments-7d");
  }

  const tickets = Number(openHighTickets[0]?.total || 0);
  if (tickets > 0) {
    await upsertDerivedNotification({
      notificationUid: "derived:open-high-tickets",
      category: "support",
      title: `${tickets} high-priority ticket${tickets === 1 ? "" : "s"} open`,
      body: "Support queue needs attention.",
      href: "/master-admin/support-tickets?priority=high",
    });
  } else {
    await removeDerivedNotification("derived:open-high-tickets");
  }

  for (const customer of recentCustomers) {
    await upsertDerivedNotification({
      notificationUid: `customer-signup:${customer.customer_uid}`,
      category: "customer",
      title: "New customer signup",
      body: `${customer.contact_name} (${customer.email})${customer.company_name ? ` — ${customer.company_name}` : ""}`,
      href: `/master-admin/customers?search=${encodeURIComponent(customer.email)}`,
    });
  }

  for (const request of recentEnterpriseRequests) {
    await upsertDerivedNotification({
      notificationUid: `enterprise-request:${request.request_uid}`,
      category: "customer",
      title: "New Enterprise quote request",
      body: `${request.company_name} · ${request.contact_name} (${request.business_email}) · ${request.country}${request.state ? `, ${request.state}` : ""}`,
      href: `/master-admin/enterprise-requests/${request.request_uid}`,
    });
  }

  // Remove the old aggregate alert so each unread badge maps to a real customer.
  await removeDerivedNotification("derived:new-customers-24h");

  const pending = Number(pendingPayments[0]?.total || 0);
  if (pending > 0) {
    await upsertDerivedNotification({
      notificationUid: "derived:pending-payments",
      category: "billing",
      title: `${pending} pending payment${pending === 1 ? "" : "s"}`,
      body: "Payments awaiting capture or confirmation.",
      href: "/master-admin/billing?status=Pending",
    });
  } else {
    await removeDerivedNotification("derived:pending-payments");
  }

  const stale = Number(captureOps[0]?.stale || 0);
  if (stale > 0) {
    await upsertDerivedNotification({
      notificationUid: "derived:oc-stale-leases",
      category: "system",
      title: `${stale} stale Object Capture lease${stale === 1 ? "" : "s"}`,
      body: "Worker leases expired and require recovery or worker investigation.",
      href: "/master-admin/system-health",
    });
  } else await removeDerivedNotification("derived:oc-stale-leases");

  const queued = Number(captureOps[0]?.queued || 0);
  const oldestAge = Number(captureOps[0]?.oldestAge || 0);
  const backlogThreshold = Number(process.env.OC_BACKLOG_WARNING_JOBS || 10);
  const ageThreshold = Number(process.env.OC_QUEUE_AGE_WARNING_SECONDS || 1800);
  if (queued >= backlogThreshold || oldestAge >= ageThreshold) {
    await upsertDerivedNotification({
      notificationUid: "derived:oc-backlog",
      category: "system",
      title: `Object Capture backlog: ${queued} queued`,
      body: `Oldest queued job is ${Math.round(oldestAge / 60)} minutes old. Check worker capacity.`,
      href: "/master-admin/object-capture?status=queued",
    });
  } else await removeDerivedNotification("derived:oc-backlog");
}

export async function listAdminNotifications(limit = 20) {
  const rows = await query<AdminNotificationRow>(
    `SELECT notification_uid, category, title, body, href, is_read, created_at
     FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL
     ORDER BY is_read ASC, created_at DESC
     LIMIT ?`,
    [Math.min(Math.max(limit, 1), 50)],
  );

  return rows.map(mapNotification);
}

export async function countUnreadAdminNotifications() {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM admin_notifications
     WHERE admin_id IS NULL AND dismissed_at IS NULL AND is_read = FALSE`,
  );
  return Number(rows[0]?.total || 0);
}

export async function markAdminNotificationsRead(ids: string[], markAll = false) {
  if (markAll) {
    await query(
      `UPDATE admin_notifications SET is_read = TRUE, read_at = NOW()
       WHERE admin_id IS NULL AND dismissed_at IS NULL AND is_read = FALSE`,
    );
    return;
  }

  if (!ids.length) return;

  const placeholders = ids.map(() => "?").join(",");
  await query(
    `UPDATE admin_notifications SET is_read = TRUE, read_at = NOW()
     WHERE admin_id IS NULL AND dismissed_at IS NULL AND notification_uid IN (${placeholders})`,
    ids,
  );
}

export async function deleteAdminNotifications(ids: string[], clearAll = false) {
  if (clearAll) {
    await query(
      `UPDATE admin_notifications
       SET dismissed_at = NOW(), is_read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE admin_id IS NULL AND dismissed_at IS NULL`,
    );
    return;
  }
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  await query(
    `UPDATE admin_notifications
     SET dismissed_at = NOW(), is_read = TRUE, read_at = COALESCE(read_at, NOW())
     WHERE admin_id IS NULL AND dismissed_at IS NULL
       AND notification_uid IN (${placeholders})`,
    ids,
  );
}

export async function getAdminNotificationsFeed(
  limit = 20,
  options: { sync?: boolean } = {},
) {
  if (options.sync !== false) await syncAdminNotifications();
  const [notifications, unreadCount] = await Promise.all([
    listAdminNotifications(limit),
    countUnreadAdminNotifications(),
  ]);
  return { notifications, unreadCount };
}

