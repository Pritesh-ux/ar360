import { query } from "@/lib/db";
import { buildEmailLogWhere, ensureEmailLogsSchema } from "@/lib/email/email-log";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { paginationMeta } from "@/lib/master-admin/pagination";

export type EmailCenterFilters = {
  search?: string;
  status?: string;
  template?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

const EMAIL_TEMPLATES = [
  { id: "custom", label: "Custom message" },
  { id: "support_ticket_reply", label: "Support ticket reply" },
  { id: "payment_reminder", label: "Payment reminder" },
  { id: "invoice_email", label: "Invoice email" },
  { id: "subscription_reminder", label: "Subscription reminder" },
];

export async function listEmailLogs(params: EmailCenterFilters = {}) {
  await ensureEmailLogsSchema();

  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 15)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildEmailLogWhere(params);

  const [countRows, rows, summaryRows, templateRows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM email_logs ${where}`, values),
    query<{
      id: number;
      recipient: string;
      subject: string;
      template: string | null;
      status: string;
      provider_message_id: string | null;
      error_message: string | null;
      sent_at: string | null;
      created_at: string;
    }>(`
      SELECT id, recipient, subject, template, status, provider_message_id, error_message, sent_at, created_at
      FROM email_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

    query<any>(`
      SELECT
        SUM(status = 'sent') AS sentCount,
        SUM(status = 'failed') AS failedCount,
        SUM(status = 'console') AS consoleCount,
        COUNT(*) AS totalCount,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCount
      FROM email_logs
      ${where}
    `, values),

    query<{ template: string | null; count: number }>(`
      SELECT template, COUNT(*) AS count
      FROM email_logs
      ${where}
      GROUP BY template
      ORDER BY count DESC
      LIMIT 8
    `, values),
  ]);

  const summaryRow = summaryRows[0] || {};
  const logs = rows.map((row) => ({
    id: row.id,
    recipient: row.recipient,
    subject: row.subject,
    template: row.template || "custom",
    templateLabel:
      EMAIL_TEMPLATES.find((t) => t.id === row.template)?.label || row.template || "Custom",
    status: row.status,
    messageId: row.provider_message_id,
    errorMessage: row.error_message,
    sentAt: row.sent_at || row.created_at,
    createdAt: row.created_at,
  }));

  return {
    logs,
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
    summary: {
      sent: Number(summaryRow.sentCount || 0),
      failed: Number(summaryRow.failedCount || 0),
      console: Number(summaryRow.consoleCount || 0),
      total: Number(summaryRow.totalCount || 0),
      today: Number(summaryRow.todayCount || 0),
    },
    templates: EMAIL_TEMPLATES,
    templateBreakdown: templateRows.map((row) => ({
      template: row.template || "custom",
      label: EMAIL_TEMPLATES.find((t) => t.id === row.template)?.label || row.template || "Custom",
      count: Number(row.count || 0),
    })),
  };
}

export async function exportEmailLogsCsv(params: EmailCenterFilters = {}) {
  await ensureEmailLogsSchema();
  const { where, values } = buildEmailLogWhere(params);
  const rows = await query<{
    recipient: string;
    subject: string;
    template: string | null;
    status: string;
    error_message: string | null;
    sent_at: string | null;
    created_at: string;
  }>(`
    SELECT recipient, subject, template, status, error_message, sent_at, created_at
    FROM email_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT 5000
  `, values);

  const header = ["Recipient", "Subject", "Template", "Status", "Sent At", "Error"];
  const lines = rows.map((row) => [
    row.recipient,
    row.subject,
    row.template || "custom",
    row.status,
    row.sent_at || row.created_at,
    row.error_message || "",
  ]);

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function sendAdminEmail(input: {
  to: string;
  subject: string;
  body: string;
  template?: string;
  adminId?: number;
}) {
  const to = input.to.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!to) throw new Error("Recipient email is required");
  if (!subject) throw new Error("Subject is required");
  if (!body) throw new Error("Message body is required");

  const result = await sendEmail({
    to,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
    template: input.template || "custom",
  });

  await writeMasterAdminAudit({
    adminId: input.adminId,
    action: "email.send",
    entityType: "email",
    entityId: to,
    metadata: { subject, template: input.template || "custom", mode: result.mode },
  });

  return result;
}

export async function retryEmailLog(logId: number, adminId?: number) {
  await ensureEmailLogsSchema();
  const rows = await query<{
    id: number;
    recipient: string;
    subject: string;
    template: string | null;
    error_message: string | null;
  }>(
    `SELECT id, recipient, subject, template, error_message FROM email_logs WHERE id = ? LIMIT 1`,
    [logId],
  );
  const row = rows[0];
  if (!row) throw new Error("Email log not found");
  if (row.template === "custom") {
    throw new Error("Only system-templated emails can be retried from logs. Send a new message instead.");
  }

  const result = await sendEmail({
    to: row.recipient,
    subject: row.subject,
    text: `Retry delivery for: ${row.subject}`,
    template: row.template || undefined,
  });

  await writeMasterAdminAudit({
    adminId,
    action: "email.retry",
    entityType: "email_log",
    entityId: String(logId),
    metadata: { recipient: row.recipient, mode: result.mode },
  });

  return result;
}
