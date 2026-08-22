import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import {
  renderCustomerLifecycleEmail,
  type CustomerEmailContent,
} from "@/lib/email/templates/customer-lifecycle";
import {
  getNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/account/notify.service";
import { secureEmailActionUrl } from "@/lib/auth/email-action-token";

export type CustomerEmailCategory = keyof NotificationPreferences;

type RecipientRow = {
  user_id: number | null;
  email: string;
  contact_name: string | null;
};

let deliverySchemaReady: Promise<boolean> | null = null;

async function ensureDeliverySchema() {
  if (!deliverySchemaReady) {
    deliverySchemaReady = query(
      `CREATE TABLE IF NOT EXISTS customer_email_deliveries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        customer_uid VARCHAR(64) NOT NULL,
        dedupe_key VARCHAR(191) NOT NULL,
        template_id VARCHAR(80) NOT NULL,
        recipient VARCHAR(255) NOT NULL,
        status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
        attempts INT UNSIGNED NOT NULL DEFAULT 1,
        provider_message_id VARCHAR(255) NULL,
        error_message VARCHAR(1000) NULL,
        sent_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_customer_email_delivery (customer_uid, dedupe_key),
        KEY idx_customer_email_status (status, updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    )
      .then(() => true)
      .catch((error) => {
        console.warn("[customer-email] delivery tracking unavailable", error);
        return false;
      });
  }
  return deliverySchemaReady;
}

async function resolveRecipient(customerUid: string) {
  const rows = await query<RecipientRow>(
    `SELECT c.user_id, c.email, c.contact_name
       FROM customers c
      WHERE c.customer_uid = ? AND c.status != 'Deleted'
      LIMIT 1`,
    [customerUid],
  );
  return rows[0] || null;
}

async function claimDelivery(input: {
  customerUid: string;
  dedupeKey: string;
  templateId: string;
  recipient: string;
}) {
  if (!(await ensureDeliverySchema())) return true;

  const rows = await query<{ status: "pending" | "sent" | "failed" | "skipped" }>(
    `SELECT status FROM customer_email_deliveries
      WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,
    [input.customerUid, input.dedupeKey],
  );
  const existing = rows[0]?.status;
  if (existing === "sent" || existing === "skipped") return false;

  // Stale pending rows (crashed send) or previous failures are retryable.
  if (existing === "pending") {
    const stale = await query<{ stale: number }>(
      `SELECT CASE WHEN updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 1 ELSE 0 END AS stale
         FROM customer_email_deliveries
        WHERE customer_uid = ? AND dedupe_key = ? LIMIT 1`,
      [input.customerUid, input.dedupeKey],
    );
    if (!Number(stale[0]?.stale || 0)) return false;
  }

  if (existing === "failed" || existing === "pending") {
    await query(
      `UPDATE customer_email_deliveries
          SET status = 'pending', attempts = attempts + 1, error_message = NULL
        WHERE customer_uid = ? AND dedupe_key = ?`,
      [input.customerUid, input.dedupeKey],
    );
    return true;
  }

  try {
    await query(
      `INSERT INTO customer_email_deliveries
        (customer_uid, dedupe_key, template_id, recipient, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [input.customerUid, input.dedupeKey, input.templateId, input.recipient],
    );
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

async function finishDelivery(
  customerUid: string,
  dedupeKey: string,
  result: {
    status: "sent" | "failed" | "skipped";
    messageId?: string;
    error?: string;
  },
) {
  if (!(await ensureDeliverySchema())) return;
  await query(
    `UPDATE customer_email_deliveries
        SET status = ?, provider_message_id = ?, error_message = ?,
            sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
      WHERE customer_uid = ? AND dedupe_key = ?`,
    [
      result.status,
      result.messageId || null,
      result.error?.slice(0, 1000) || null,
      result.status,
      customerUid,
      dedupeKey,
    ],
  ).catch(() => undefined);
}

export async function sendCustomerLifecycleEmail(input: {
  customerUid: string;
  category: CustomerEmailCategory;
  templateId: string;
  dedupeKey: string;
  content: CustomerEmailContent;
  respectPreferences?: boolean;
  metadata?: Record<string, unknown>;
  /** When set, used instead of the standard lifecycle HTML shell (e.g. full invoice). */
  htmlOverride?: string | null;
  textOverride?: string | null;
}) {
  const recipient = await resolveRecipient(input.customerUid);
  if (!recipient?.email?.trim()) return { delivered: false, skipped: true, reason: "missing_recipient" };

  if (input.respectPreferences !== false && recipient.user_id) {
    const preferences = await getNotificationPreferences(recipient.user_id);
    if (!preferences[input.category].email) {
      const claimed = await claimDelivery({
        customerUid: input.customerUid,
        dedupeKey: input.dedupeKey,
        templateId: input.templateId,
        recipient: recipient.email,
      });
      if (claimed) {
        await finishDelivery(input.customerUid, input.dedupeKey, { status: "skipped" });
      }
      return { delivered: false, skipped: true, reason: "preference_disabled" };
    }
  }

  const claimed = await claimDelivery({
    customerUid: input.customerUid,
    dedupeKey: input.dedupeKey,
    templateId: input.templateId,
    recipient: recipient.email,
  });
  if (!claimed) return { delivered: false, skipped: true, reason: "duplicate" };

  let content = input.content;
  let htmlOverride = input.htmlOverride;
  let textOverride = input.textOverride;
  if (content.actionUrl) {
    const insecureUrl = content.actionUrl;
    const secureUrl = await secureEmailActionUrl({
      customerUid: input.customerUid,
      userId: recipient.user_id,
      email: recipient.email,
      destinationUrlOrPath: insecureUrl,
    });
    content = { ...content, actionUrl: secureUrl };
    if (htmlOverride && htmlOverride.includes(insecureUrl)) {
      htmlOverride = htmlOverride.split(insecureUrl).join(secureUrl);
    }
    if (textOverride && textOverride.includes(insecureUrl)) {
      textOverride = textOverride.split(insecureUrl).join(secureUrl);
    }
  }

  const rendered = htmlOverride
    ? {
        subject: content.subject,
        text:
          textOverride ||
          [
            `Hi ${recipient.contact_name || "there"},`,
            "",
            content.title,
            "",
            content.intro,
            content.actionUrl
              ? `${content.actionLabel || "Open AR360"}: ${content.actionUrl}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        html: htmlOverride,
      }
    : renderCustomerLifecycleEmail(recipient.contact_name || "", content);
  try {
    const result = await sendEmail({
      to: recipient.email,
      ...rendered,
      template: input.templateId,
      metadata: {
        customerUid: input.customerUid,
        dedupeKey: input.dedupeKey,
        content: {
          title: content.title,
          intro: content.intro,
          lines: content.lines || [],
          details: content.details || [],
          actionLabel: content.actionLabel || null,
          actionUrl: content.actionUrl || null,
        },
        ...(input.metadata || {}),
      },
    });
    await finishDelivery(input.customerUid, input.dedupeKey, {
      status: result.delivered ? "sent" : result.mode === "skipped" ? "skipped" : "failed",
      messageId: result.messageId,
      error: result.delivered ? undefined : `Delivery unavailable (${result.mode})`,
    });
    return { ...result, skipped: !result.delivered };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    await finishDelivery(input.customerUid, input.dedupeKey, {
      status: "failed",
      error: message,
    });
    console.error("[customer-email] send failed", {
      customerUid: input.customerUid,
      templateId: input.templateId,
      error: message,
    });
    return { delivered: false, skipped: false, error: message };
  }
}
