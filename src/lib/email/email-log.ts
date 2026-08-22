import { query } from "@/lib/db";

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

let ensureEmailLogsSchemaPromise: Promise<void> | null = null;

export type EmailLogStatus = "sent" | "failed" | "console" | "skipped";

export type EmailLogInput = {
  recipient: string;
  subject: string;
  template?: string;
  status: EmailLogStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export async function ensureEmailLogsSchema() {
  if (shouldSkipRuntimeDdl()) return;
  if (ensureEmailLogsSchemaPromise) return ensureEmailLogsSchemaPromise;
  ensureEmailLogsSchemaPromise = (async () => {
    await query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      recipient VARCHAR(191) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      template VARCHAR(120) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'sent',
      provider_message_id VARCHAR(191) NULL,
      error_message TEXT NULL,
      metadata JSON NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_email_logs_recipient (recipient),
      INDEX idx_email_logs_status (status),
      INDEX idx_email_logs_created (created_at),
      INDEX idx_email_logs_template (template)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  })().catch((error) => {
    ensureEmailLogsSchemaPromise = null;
    throw error;
  });
  return ensureEmailLogsSchemaPromise;
}

export async function writeEmailLog(input: EmailLogInput) {
  try {
    await ensureEmailLogsSchema();
    await query(
      `INSERT INTO email_logs (recipient, subject, template, status, provider_message_id, error_message, metadata, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.recipient,
        input.subject,
        input.template || null,
        input.status,
        input.providerMessageId || null,
        input.errorMessage || null,
        JSON.stringify(input.metadata || {}),
        input.status === "sent" || input.status === "console" ? new Date() : null,
      ],
    );
  } catch (error) {
    console.warn("[email_log insert skipped]", error);
  }
}

export type EmailLogFilters = {
  search?: string;
  status?: string;
  template?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export function buildEmailLogWhere(params: EmailLogFilters) {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  const search = (params.search || "").trim().toLowerCase();

  if (search) {
    conditions.push("(LOWER(recipient) LIKE ? OR LOWER(subject) LIKE ? OR LOWER(COALESCE(template, '')) LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like);
  }
  if (params.status && params.status !== "all") {
    conditions.push("status = ?");
    values.push(params.status);
  }
  if (params.template && params.template !== "all") {
    conditions.push("template = ?");
    values.push(params.template);
  }
  if (params.dateFrom) {
    conditions.push("DATE(created_at) >= ?");
    values.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push("DATE(created_at) <= ?");
    values.push(params.dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}
