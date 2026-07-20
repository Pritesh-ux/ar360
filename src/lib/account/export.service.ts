import { query } from "@/lib/db";
import { ensureAccountSchema } from "@/lib/account/schema";
import { createUid } from "@/lib/account/account.service";
import { writeCustomerActivity } from "@/lib/account/activity.service";

export async function createDataExportRequest(input: { customerUid: string; userId: number }) {
  await ensureAccountSchema();

  const pending = await query<{ request_uid: string }>(
    `SELECT request_uid FROM data_export_requests
     WHERE customer_uid = ? AND status IN ('pending','processing','ready') AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`,
    [input.customerUid],
  );
  if (pending.length) {
    return { error: "An export request is already in progress." as const, requestUid: pending[0].request_uid };
  }

  const requestUid = createUid("exp");
  await query(
    `INSERT INTO data_export_requests (request_uid, customer_uid, user_id, status)
     VALUES (?, ?, ?, 'processing')`,
    [requestUid, input.customerUid, input.userId],
  );

  try {
    const payload = await buildExportPayload(input.customerUid, input.userId);
    await query(
      `UPDATE data_export_requests SET status = 'ready', completed_at = NOW(),
       expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE request_uid = ?`,
      [requestUid],
    );

    await writeCustomerActivity({
      customerUid: input.customerUid,
      userId: input.userId,
      eventType: "data_exported",
      title: "Data export requested",
      detail: "Your account data export was generated.",
    });

    return { success: true as const, requestUid, data: payload };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    await query(
      `UPDATE data_export_requests SET status = 'failed', error_message = ? WHERE request_uid = ?`,
      [message.slice(0, 255), requestUid],
    );
    return { error: "Export failed. Please try again later." as const };
  }
}

async function buildExportPayload(customerUid: string, userId: number) {
  const [userRows, customerRows, products, tickets, activity] = await Promise.all([
    query<{ name: string; email: string; created_at: string }>(
      "SELECT name, email, created_at FROM users WHERE id = ? LIMIT 1",
      [userId],
    ),
    query<Record<string, unknown>>(
      `SELECT company_name, business_type, website, phone, address_line1, city, state, postal_code, country, plan_id, status, created_at
       FROM customers WHERE customer_uid = ? LIMIT 1`,
      [customerUid],
    ),
    query<{ id: string; title: string; status: string; created_at: string }>(
      `SELECT id, title, status, created_at FROM products WHERE customer_uid = ? AND deleted_at IS NULL`,
      [customerUid],
    ),
    query<{ ticket_number: string; subject: string; status: string; created_at: string }>(
      `SELECT ticket_number, subject, status, created_at FROM support_tickets WHERE customer_uid = ?`,
      [customerUid],
    ),
    query<{ event_type: string; title: string; created_at: string }>(
      `SELECT event_type, title, created_at FROM customer_activity_logs WHERE customer_uid = ? ORDER BY created_at DESC LIMIT 100`,
      [customerUid],
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: userRows[0] || null,
    company: customerRows[0] || null,
    products: products.map((p) => ({ id: p.id, title: p.title, status: p.status, createdAt: p.created_at })),
    supportTickets: tickets,
    recentActivity: activity,
    note: "Password hashes, session tokens, and payment secrets are never included in exports.",
  };
}
