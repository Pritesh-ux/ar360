import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { ensureAccountSchema } from "@/lib/account/schema";
import { createUid } from "@/lib/account/account.service";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { resolveStorageRoot } from "@/lib/storage/paths";

const COOLING_DAYS = 7;

const CUSTOMER_UID_TABLES = [
  "product_assets",
  "product_versions",
  "product_edit_log",
  "product_embed_configs",
  "product_qr_codes",
  "embed_view_events",
  "qr_scan_events",
  "share_events",
  "share_links",
  "analytics_events",
  "analytics_sessions",
  "analytics_daily",
  "object_capture_events",
  "object_capture_images",
  "object_capture_jobs",
  "object_capture_usage",
  "support_ticket_messages",
  "support_tickets",
  "customer_subscriptions",
  "customer_sessions",
  "customer_notifications",
  "customer_email_deliveries",
  "customer_onboarding",
  "customer_activity_logs",
  "billing_checkout_sessions",
  "billing_orders",
  "billing_payments",
  "billing_invoices",
  "billing_profiles",
  "billing_history",
  "billing_refunds",
  "billing_renewal_events",
  "billing_scheduled_changes",
  "billing_notification_outbox",
  "billing_reconciliation_issues",
  "billing_audit_log",
  "payment_methods",
  "payments",
  "coupon_redemptions",
  "bandwidth_usage_events",
  "usage_counters",
  "usage_daily",
  "api_key_logs",
  "api_keys",
  "webhook_deliveries",
  "webhooks",
  "workspace_invites",
  "workspace_members",
  "workspaces",
  "clients",
  "custom_domains",
  "data_export_requests",
  "email_action_tokens",
  "user_preferences",
  "login_logs",
  "products",
] as const;

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function safeDeleteByCustomerUid(table: string, customerUid: string) {
  if (!(await tableExists(table))) return;
  if (!(await tableHasColumn(table, "customer_uid"))) return;
  await query(`DELETE FROM \`${table.replace(/`/g, "")}\` WHERE customer_uid = ?`, [customerUid]).catch((err) => {
    console.warn(`[account-deletion] skip ${table}:`, err instanceof Error ? err.message : err);
  });
}

async function removeCustomerStorage(customerUid: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(customerUid)) return;
  const root = resolveStorageRoot();
  const folder = path.resolve(root, customerUid);
  if (!folder.startsWith(root + path.sep)) return;
  await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
}

/**
 * Hard-purge one customer after cool-off: sessions, products, billing PII rows, files.
 * Leaves anonymized billing ledgers only where FK retention is required — prefer delete.
 */
export async function purgeCustomerAccount(input: {
  customerUid: string;
  userId: number;
  requestUid?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { customerUid, userId } = input;

  const customerRows = await query<{ id: number; user_id: number; email: string }>(
    `SELECT id, user_id, email FROM customers WHERE customer_uid = ? LIMIT 1`,
    [customerUid],
  );
  const customer = customerRows[0];
  if (!customer) {
    if (input.requestUid) {
      await query(
        `UPDATE account_deletion_requests SET status = 'completed', completed_at = NOW() WHERE request_uid = ?`,
        [input.requestUid],
      ).catch(() => {});
    }
    return { success: true };
  }

  // Revoke sessions first
  await query(`DELETE FROM customer_sessions WHERE customer_uid = ?`, [customerUid]).catch(() => {});
  await query(`UPDATE users SET session_version = session_version + 1, status = 'Deleted' WHERE id = ?`, [userId]).catch(
    () => {},
  );

  for (const table of CUSTOMER_UID_TABLES) {
    await safeDeleteByCustomerUid(table, customerUid);
  }

  // Enterprise rows keyed by customer_id
  if (await tableExists("enterprise_requests") && (await tableHasColumn("enterprise_requests", "customer_id"))) {
    await query(`DELETE FROM enterprise_requests WHERE customer_id = ?`, [customer.id]).catch(() => {});
  }
  if (await tableExists("enterprise_contracts") && (await tableHasColumn("enterprise_contracts", "customer_id"))) {
    await query(`DELETE FROM enterprise_contracts WHERE customer_id = ?`, [customer.id]).catch(() => {});
  }

  await removeCustomerStorage(customerUid);

  await query(`DELETE FROM customers WHERE customer_uid = ?`, [customerUid]);
  await query(`DELETE FROM users WHERE id = ?`, [userId]).catch(() => {});

  if (input.requestUid) {
    await query(
      `UPDATE account_deletion_requests
       SET status = 'completed', completed_at = NOW()
       WHERE request_uid = ?`,
      [input.requestUid],
    ).catch(() => {});
  } else {
    await query(
      `UPDATE account_deletion_requests
       SET status = 'completed', completed_at = NOW()
       WHERE customer_uid = ? AND status = 'pending'`,
      [customerUid],
    ).catch(() => {});
  }

  return { success: true };
}

export async function requestAccountDeletion(input: {
  userId: number;
  customerUid: string;
  password: string;
  reason?: string;
}) {
  await ensureAccountSchema();

  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
    [input.userId],
  );
  if (!rows[0] || !verifyPassword(input.password, rows[0].password_hash)) {
    return { error: "Password is incorrect." as const };
  }

  const existing = await query<{ request_uid: string }>(
    `SELECT request_uid FROM account_deletion_requests
     WHERE customer_uid = ? AND status = 'pending' LIMIT 1`,
    [input.customerUid],
  );
  if (existing.length) {
    return { error: "A deletion request is already pending." as const, requestUid: existing[0].request_uid };
  }

  const requestUid = createUid("del");
  const scheduledFor = new Date(Date.now() + COOLING_DAYS * 86400000).toISOString().slice(0, 19).replace("T", " ");

  await query(
    `INSERT INTO account_deletion_requests (request_uid, customer_uid, user_id, status, reason, scheduled_for)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [requestUid, input.customerUid, input.userId, input.reason?.trim() || null, scheduledFor],
  );

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "deletion_requested",
    title: "Account deletion requested",
    detail: `Deletion scheduled after cooling period (${COOLING_DAYS} days).`,
  });

  await createCustomerNotification({
    customerUid: input.customerUid,
    userId: input.userId,
    category: "security",
    title: "Account deletion requested",
    body: `Your account deletion request was received. It will be processed after ${COOLING_DAYS} days unless cancelled.`,
    href: "/dashboard/settings?tab=danger",
    dedupeKey: `deletion-request:${input.customerUid}`,
  });

  return { success: true as const, requestUid, scheduledFor, coolingDays: COOLING_DAYS };
}

export async function cancelAccountDeletion(input: { userId: number; customerUid: string }) {
  await ensureAccountSchema();
  const result = await query(
    `UPDATE account_deletion_requests SET status = 'cancelled', cancelled_at = NOW()
     WHERE customer_uid = ? AND user_id = ? AND status = 'pending'`,
    [input.customerUid, input.userId],
  );
  const affected = (result as { affectedRows?: number }).affectedRows || 0;
  if (!affected) return { error: "No pending deletion request found." as const };

  await writeCustomerActivity({
    customerUid: input.customerUid,
    userId: input.userId,
    eventType: "deletion_cancelled",
    title: "Account deletion cancelled",
    detail: "Your account deletion request was cancelled.",
  });

  return { success: true as const };
}

export async function getPendingDeletionRequest(customerUid: string) {
  await ensureAccountSchema();
  const rows = await query<{
    request_uid: string;
    status: string;
    scheduled_for: string | null;
    created_at: string;
  }>(
    `SELECT request_uid, status, scheduled_for, created_at FROM account_deletion_requests
     WHERE customer_uid = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
    [customerUid],
  );
  return rows[0] || null;
}

/** Process due cool-off deletions. Called by lifecycle worker. */
export async function processDueAccountDeletions(limit = 25): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  await ensureAccountSchema();

  const due = await query<{
    request_uid: string;
    customer_uid: string;
    user_id: number;
  }>(
    `SELECT request_uid, customer_uid, user_id
     FROM account_deletion_requests
     WHERE status = 'pending'
       AND scheduled_for IS NOT NULL
       AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT ${Math.max(1, Math.min(100, Math.floor(limit)))}`,
  );

  let succeeded = 0;
  let failed = 0;

  for (const row of due) {
    try {
      const result = await purgeCustomerAccount({
        customerUid: row.customer_uid,
        userId: row.user_id,
        requestUid: row.request_uid,
      });
      if (result.success) succeeded += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[account-deletion] purge failed request=${row.request_uid} customer=${row.customer_uid}`,
        error,
      );
    }
  }

  return { processed: due.length, succeeded, failed };
}
