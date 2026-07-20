import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { ensureAccountSchema } from "@/lib/account/schema";
import { createUid } from "@/lib/account/account.service";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerNotification } from "@/lib/account/notify.service";

const COOLING_DAYS = 7;

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
