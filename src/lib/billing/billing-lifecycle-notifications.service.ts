import { query } from "@/lib/db";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { sendCustomerLifecycleEmail } from "@/lib/email/customer-delivery.service";
import { absoluteAppUrl } from "@/lib/email/templates/customer-lifecycle";

type OutboxRow = {
  id: number;
  customer_uid: string;
  channel: "in_app" | "email";
  notification_type: string;
  dedupe_key: string;
  payload: string | Record<string, unknown>;
};

const COPY: Record<string, { title: string; body: string; category: "billing" | "subscription" }> = {
  "subscription.authenticated": { title: "Payment mandate authorized", body: "Your recurring payment authorization is confirmed.", category: "billing" },
  "subscription.pending": { title: "Payment mandate pending", body: "Razorpay is still confirming your recurring payment authorization.", category: "billing" },
  "subscription.halted": { title: "Recurring billing halted", body: "Automatic renewal attempts have stopped. Please authorize payment again.", category: "billing" },
  "payment.failed": { title: "Renewal payment needs attention", body: "Your renewal debit failed. We will retry during the grace period.", category: "billing" },
  "payment.captured": { title: "Renewal payment received", body: "Your renewal was paid successfully and your invoice is ready.", category: "billing" },
  "subscription.charged": { title: "Renewal payment received", body: "Your recurring debit succeeded and your subscription remains active.", category: "billing" },
  "subscription.cancelled": { title: "Cancellation effective", body: "Your subscription cancellation is now effective.", category: "subscription" },
  "subscription.completed": { title: "Subscription completed", body: "Your recurring subscription term has completed.", category: "subscription" },
};

function eventCopy(type: string) {
  return COPY[type] || {
    title: type.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    body: "Your AR360 billing status was updated.",
    category: "billing" as const,
  };
}

export async function deliverBillingLifecycleEvent(input: {
  customerUid: string;
  type: string;
  eventKey: string;
  href?: string;
  channel?: "in_app" | "email" | "both";
  title?: string;
  body?: string;
}) {
  const copy = eventCopy(input.type);
  const title = input.title || copy.title;
  const body = input.body || copy.body;
  const href = input.href || "/dashboard/subscription";
  const channel = input.channel || "both";

  if (channel === "in_app" || channel === "both") {
    await createCustomerNotification({
      customerUid: input.customerUid,
      category: copy.category,
      title,
      body,
      href,
      dedupeKey: `billing:${input.eventKey}`,
    });
  }
  if (channel === "email" || channel === "both") {
    await sendCustomerLifecycleEmail({
      customerUid: input.customerUid,
      category: copy.category,
      templateId: `billing_${input.type.replaceAll(".", "_")}`,
      dedupeKey: `billing:${input.eventKey}`,
      content: {
        subject: `${title} — AR360`,
        title,
        intro: body,
        actionLabel: "Manage subscription",
        actionUrl: absoluteAppUrl(href),
      },
    });
  }
}

export async function processBillingNotificationOutbox(limit = 100) {
  const rows = await query<OutboxRow>(
    `SELECT id, customer_uid, channel, notification_type, dedupe_key, payload
       FROM billing_notification_outbox
      WHERE status IN ('pending','failed') AND available_at <= NOW()
        AND (locked_until IS NULL OR locked_until < NOW())
      ORDER BY id LIMIT ?`,
    [limit],
  );
  let delivered = 0;
  for (const row of rows) {
    await query(
      `UPDATE billing_notification_outbox SET status = 'delivering', attempt_count = attempt_count + 1,
          locked_until = DATE_ADD(NOW(), INTERVAL 2 MINUTE) WHERE id = ?`,
      [row.id],
    );
    try {
      const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      await deliverBillingLifecycleEvent({
        customerUid: row.customer_uid,
        type: row.notification_type,
        eventKey: row.dedupe_key,
        href: String(payload.href || "/dashboard/subscription"),
        channel: row.channel,
      });
      await query(
        "UPDATE billing_notification_outbox SET status = 'delivered', delivered_at = NOW(), locked_until = NULL, last_error = NULL WHERE id = ?",
        [row.id],
      );
      delivered += 1;
    } catch (error) {
      await query(
        `UPDATE billing_notification_outbox
            SET status = IF(attempt_count >= 8, 'dead', 'failed'),
                available_at = DATE_ADD(NOW(), INTERVAL LEAST(60, POW(2, attempt_count)) MINUTE),
                locked_until = NULL, last_error = ?
          WHERE id = ?`,
        [error instanceof Error ? error.message.slice(0, 1000) : "Delivery failed", row.id],
      );
    }
  }
  return { processed: rows.length, delivered };
}
