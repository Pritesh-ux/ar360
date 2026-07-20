import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { ensureEnterpriseInstallmentSchema } from "@/lib/enterprise-sales/repository";
import { formatPaise } from "@/lib/billing/subscription-presentation";

const DAY_MS = 24 * 60 * 60 * 1000;

type DueInstallment = {
  payment_uid: string;
  request_uid: string;
  contact_name: string;
  business_email: string;
  amount_paise: number;
  due_at: string | Date;
  installment_label: string | null;
  reminder_sent_for_days: number | null;
};

type RenewalCandidate = {
  customer_uid: string;
  email: string;
  contact_name: string;
  plan_id: string;
  current_period_end: string | Date;
  request_uid: string | null;
};

function daysUntil(date: Date, now: Date) {
  const remainingMs = date.getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);
}

export async function runEnterpriseInstallmentReminders(now = new Date()) {
  await ensureEnterpriseInstallmentSchema();
  const rows = await query<DueInstallment>(
    `SELECT p.payment_uid, r.request_uid, r.contact_name, r.business_email,
            p.amount_paise, p.due_at, p.installment_label, p.reminder_sent_for_days
       FROM enterprise_payments p
       JOIN enterprise_requests r ON r.id = p.request_id
      WHERE p.status = 'pending'
        AND p.due_at IS NOT NULL
        AND p.due_at <= DATE_ADD(?, INTERVAL 7 DAY)
      ORDER BY p.due_at ASC
      LIMIT 200`,
    [now],
  ).catch(() => []);

  let reminded = 0;
  for (const row of rows) {
    const due = new Date(row.due_at);
    if (Number.isNaN(due.getTime())) continue;
    const days = daysUntil(due, now);
    if (![7, 3, 1, 0].includes(days)) continue;
    if (row.reminder_sent_for_days === days) continue;

    const label = row.installment_label || "Installment";
    const amount = formatPaise(row.amount_paise);
    try {
      await sendEmail({
        to: row.business_email,
        subject: days === 0
          ? `AR360 payment due today — ${label}`
          : `AR360 payment due in ${days} day${days === 1 ? "" : "s"} — ${label}`,
        text: `Hello ${row.contact_name},\n\nYour AR360 Enterprise ${label} of ${amount} is due ${days === 0 ? "today" : `in ${days} day(s)`} (${due.toISOString().slice(0, 10)}).\n\nPlease complete payment to keep your plan in good standing.\n\nRegards,\nAR360 Team`,
        html: `<p>Hello ${row.contact_name},</p><p>Your AR360 Enterprise <strong>${label}</strong> of <strong>${amount}</strong> is due ${days === 0 ? "today" : `in ${days} day(s)`} (${due.toISOString().slice(0, 10)}).</p><p>Please complete payment to keep your plan in good standing.</p><p>Regards,<br>AR360 Team</p>`,
        template: "enterprise-installment-due",
      });
      await query(
        "UPDATE enterprise_payments SET reminder_sent_for_days = ? WHERE payment_uid = ?",
        [days, row.payment_uid],
      );
      reminded += 1;
    } catch {
      // best-effort reminders
    }
  }
  return { reminded, scanned: rows.length };
}

export async function runEnterpriseRenewalReminders(now = new Date()) {
  const rows = await query<RenewalCandidate>(
    `SELECT s.customer_uid, COALESCE(c.email, u.email) AS email,
            COALESCE(c.contact_name, u.name) AS contact_name,
            s.plan_id, s.current_period_end, er.request_uid
       FROM customer_subscriptions s
       JOIN customers c ON c.customer_uid = s.customer_uid
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN enterprise_contracts ec ON ec.subscription_id = s.id AND ec.status = 'active'
       LEFT JOIN enterprise_requests er ON er.id = ec.request_id
      WHERE s.provider = 'manual_enterprise'
        AND s.status IN ('active', 'paused')
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end <= DATE_ADD(?, INTERVAL 14 DAY)
      ORDER BY s.current_period_end ASC
      LIMIT 200`,
    [now],
  ).catch(() => []);

  let reminded = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const ends = new Date(row.current_period_end);
    if (Number.isNaN(ends.getTime())) continue;
    const days = daysUntil(ends, now);
    if (![14, 7, 3, 1, 0].includes(days)) continue;

    const dedupeKey = `enterprise-renewal:${row.customer_uid}:${ends.toISOString().slice(0, 10)}:${days}`;
    const existing = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM billing_history
        WHERE customer_uid = ? AND event_type = 'enterprise_renewal_reminder' AND dedupe_key = ?`,
      [row.customer_uid, dedupeKey],
    ).catch(() => []);
    if (Number(existing[0]?.total || 0) > 0) continue;

    try {
      await sendEmail({
        to: row.email,
        subject: days === 0
          ? "Your AR360 Enterprise plan renews today"
          : `AR360 Enterprise renewal in ${days} day${days === 1 ? "" : "s"}`,
        text: `Hello ${row.contact_name},\n\nYour AR360 Enterprise plan is due for renewal ${days === 0 ? "today" : `in ${days} day(s)`} (${ends.toISOString().slice(0, 10)}).\n\nPlease contact your account manager or complete the renewal payment so access stays uninterrupted.\n\nRegards,\nAR360 Team`,
        html: `<p>Hello ${row.contact_name},</p><p>Your AR360 Enterprise plan is due for renewal ${days === 0 ? "today" : `in ${days} day(s)`} (<strong>${ends.toISOString().slice(0, 10)}</strong>).</p><p>Please complete renewal payment so upload, AR, and QR access stay active.</p><p>Regards,<br>AR360 Team</p>`,
        template: "enterprise-renewal-reminder",
      });
      await query(
        `INSERT INTO billing_history
          (customer_uid, event_type, title, description, dedupe_key, meta)
         VALUES (?, 'enterprise_renewal_reminder', ?, ?, ?, ?)`,
        [
          row.customer_uid,
          "Enterprise renewal reminder",
          `Renewal reminder sent (${days} day(s) remaining).`,
          dedupeKey,
          JSON.stringify({ requestUid: row.request_uid, daysRemaining: days }),
        ],
      ).catch(() => undefined);
      reminded += 1;
    } catch {
      // best-effort
    }
  }
  return { reminded, scanned: rows.length };
}
