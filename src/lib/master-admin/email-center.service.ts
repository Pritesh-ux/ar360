import { query } from "@/lib/db";
import { buildEmailLogWhere, ensureEmailLogsSchema } from "@/lib/email/email-log";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { paginationMeta } from "@/lib/master-admin/pagination";
import { sanitizeUrl } from "@/lib/url";

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
  { id: "invoice_ready", label: "Invoice ready" },
  { id: "plan_activated", label: "Plan activated" },
  { id: "customer_welcome", label: "Customer welcome" },
  { id: "subscription_reminder", label: "Subscription reminder" },
];

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function extractInvoiceRef(subject: string, metadata: Record<string, unknown>) {
  const fromMeta =
    (typeof metadata.invoiceUid === "string" && metadata.invoiceUid) ||
    (typeof metadata.invoiceNumber === "string" && metadata.invoiceNumber) ||
    null;
  if (fromMeta) return fromMeta.trim();
  const match = subject.match(/Your AR360 invoice\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function resolveInvoiceForEmail(subject: string, template: string, metadata: Record<string, unknown>) {
  const invoiceLike =
    template === "invoice_ready" ||
    template === "invoice_email" ||
    Boolean(metadata.invoiceUid) ||
    Boolean(metadata.invoiceNumber) ||
    /Your AR360 invoice/i.test(subject);
  if (!invoiceLike) return null;

  const ref = extractInvoiceRef(subject, metadata);
  if (!ref) return null;

  const rows = await query<{
    invoice_uid: string;
    invoice_number: string | null;
    customer_uid: string;
    buyer_name: string | null;
    buyer_email: string | null;
    plan_id: string | null;
    status: string | null;
    total_paise: number | null;
    paid_at: string | null;
    created_at: string | null;
  }>(
    `SELECT invoice_uid, invoice_number, customer_uid, buyer_name, buyer_email, plan_id, status, total_paise, paid_at, created_at
     FROM billing_invoices
     WHERE invoice_uid = ? OR invoice_number = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [ref, ref],
  ).catch(() => []);

  const invoice = rows[0];
  if (!invoice) return null;

  return {
    invoiceUid: invoice.invoice_uid,
    invoiceNumber: invoice.invoice_number || invoice.invoice_uid,
    customerUid: invoice.customer_uid,
    buyerName: invoice.buyer_name,
    buyerEmail: invoice.buyer_email,
    planId: invoice.plan_id,
    status: invoice.status,
    totalPaise: invoice.total_paise == null ? null : Number(invoice.total_paise),
    issuedAt: invoice.paid_at || invoice.created_at,
    viewUrl: `/api/master-admin/billing/invoices/${encodeURIComponent(invoice.invoice_uid)}/download`,
    downloadUrl: `/api/master-admin/billing/invoices/${encodeURIComponent(invoice.invoice_uid)}/download?format=pdf`,
  };
}

export async function getEmailLogDetail(logId: number) {
  await ensureEmailLogsSchema();
  const rows = await query<{
    id: number;
    recipient: string;
    subject: string;
    template: string | null;
    status: string;
    provider_message_id: string | null;
    error_message: string | null;
    metadata: unknown;
    sent_at: string | null;
    created_at: string;
  }>(
    `SELECT id, recipient, subject, template, status, provider_message_id, error_message, metadata, sent_at, created_at
     FROM email_logs
     WHERE id = ?
     LIMIT 1`,
    [logId],
  );
  const row = rows[0];
  if (!row) throw new Error("Email log not found");

  const metadata = parseJsonObject(row.metadata);
  const template = row.template || "custom";
  const rawContent =
    metadata.content && typeof metadata.content === "object" && !Array.isArray(metadata.content)
      ? (metadata.content as {
          title?: string;
          intro?: string;
          lines?: string[];
          details?: Array<{ label: string; value: string }>;
          actionLabel?: string | null;
          actionUrl?: string | null;
        })
      : null;
  // Older logs may have been stored with localhost from a mis-set APP_URL.
  const content = rawContent
    ? {
        ...rawContent,
        actionUrl: rawContent.actionUrl ? sanitizeUrl(rawContent.actionUrl) : rawContent.actionUrl,
      }
    : null;
  const invoice = await resolveInvoiceForEmail(row.subject, template, metadata);

  return {
    id: row.id,
    recipient: row.recipient,
    subject: row.subject,
    template,
    templateLabel: EMAIL_TEMPLATES.find((t) => t.id === template)?.label || template,
    status: row.status,
    messageId: row.provider_message_id,
    errorMessage: row.error_message,
    sentAt: row.sent_at || row.created_at,
    createdAt: row.created_at,
    deliveryMode: typeof metadata.mode === "string" ? metadata.mode : null,
    bodyPreview: typeof metadata.bodyPreview === "string" ? metadata.bodyPreview : null,
    content,
    invoice,
    customerUid: typeof metadata.customerUid === "string" ? metadata.customerUid : invoice?.customerUid || null,
  };
}

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
