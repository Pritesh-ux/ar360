import { query, type QueryValue } from "@/lib/db";
import { paginationMeta } from "@/lib/master-admin/pagination";

export type AuditLogFilters = {
  search?: string;
  action?: string;
  entityType?: string;
  adminId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

async function ensureAuditLogsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS master_admin_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_id VARCHAR(128) NULL,
      action VARCHAR(120) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(120) NULL,
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_master_admin_audit_entity (entity_type, entity_id),
      INDEX idx_master_admin_audit_action (action),
      INDEX idx_master_admin_audit_created (created_at),
      INDEX idx_master_admin_audit_admin (admin_id, created_at)
    )
  `);
}

function buildAuditWhere(filters: AuditLogFilters) {
  const clauses: string[] = ["1=1"];
  const values: QueryValue[] = [];

  const search = (filters.search || "").trim();
  if (search) {
    clauses.push(`(
      a.action LIKE ? OR a.entity_type LIKE ? OR a.entity_id LIKE ?
      OR ma.name LIKE ? OR ma.email LIKE ?
      OR CAST(a.metadata AS CHAR) LIKE ?
    )`);
    const like = `%${search}%`;
    values.push(like, like, like, like, like, like);
  }

  if (filters.action && filters.action !== "all") {
    clauses.push("a.action = ?");
    values.push(filters.action);
  }

  if (filters.entityType && filters.entityType !== "all") {
    clauses.push("a.entity_type = ?");
    values.push(filters.entityType);
  }

  if (filters.adminId && filters.adminId !== "all") {
    clauses.push("(a.admin_id = ? OR ma.id = ?)");
    values.push(filters.adminId, Number(filters.adminId) || 0);
  }

  if (filters.dateFrom) {
    clauses.push("DATE(a.created_at) >= ?");
    values.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push("DATE(a.created_at) <= ?");
    values.push(filters.dateTo);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, values };
}

const ADMIN_JOIN = `
  FROM master_admin_audit_logs a
  LEFT JOIN master_admins ma ON ma.id = a.admin_id OR ma.admin_uid = a.admin_id
`;

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  await ensureAuditLogsSchema();

  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 15)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildAuditWhere(filters);

  const [countRows, rows, summaryRows, actionRows, entityRows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total ${ADMIN_JOIN} ${where}`, values),
    query<{
      id: number;
      admin_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      metadata: string | null;
      created_at: string;
      admin_name: string | null;
      admin_email: string | null;
    }>(`
      SELECT a.id, a.admin_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
        ma.name AS admin_name, ma.email AS admin_email
      ${ADMIN_JOIN}
      ${where}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

    query<any>(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT a.admin_id) AS uniqueAdmins,
        SUM(CASE WHEN DATE(a.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCount,
        SUM(CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS last7Days
      ${ADMIN_JOIN}
      ${where}
    `, values),

    query<{ action: string; count: number }>(`
      SELECT a.action, COUNT(*) AS count
      ${ADMIN_JOIN}
      ${where}
      GROUP BY a.action
      ORDER BY count DESC
      LIMIT 10
    `, values),

    query<{ entity_type: string; count: number }>(`
      SELECT a.entity_type, COUNT(*) AS count
      ${ADMIN_JOIN}
      ${where}
      GROUP BY a.entity_type
      ORDER BY count DESC
      LIMIT 10
    `, values),
  ]);

  const summaryRow = summaryRows[0] || {};

  return {
    logs: rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminName: row.admin_name || "System",
      adminEmail: row.admin_email || "",
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: parseMetadata(row.metadata),
      createdAt: row.created_at,
    })),
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
    summary: {
      total: Number(summaryRow.total || 0),
      uniqueAdmins: Number(summaryRow.uniqueAdmins || 0),
      today: Number(summaryRow.todayCount || 0),
      last7Days: Number(summaryRow.last7Days || 0),
    },
    actionBreakdown: actionRows.map((row) => ({
      action: row.action,
      count: Number(row.count || 0),
    })),
    entityBreakdown: entityRows.map((row) => ({
      entityType: row.entity_type,
      count: Number(row.count || 0),
    })),
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return {};
  }
}

export async function exportAuditLogsCsv(filters: AuditLogFilters = {}) {
  await ensureAuditLogsSchema();
  const { where, values } = buildAuditWhere(filters);

  const rows = await query<{
    admin_name: string | null;
    admin_email: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: string | null;
    created_at: string;
  }>(`
    SELECT ma.name AS admin_name, ma.email AS admin_email,
      a.action, a.entity_type, a.entity_id, a.metadata, a.created_at
    ${ADMIN_JOIN}
    ${where}
    ORDER BY a.created_at DESC
    LIMIT 5000
  `, values);

  const header = ["Admin", "Email", "Action", "Entity Type", "Entity ID", "Metadata", "Created At"];
  const lines = rows.map((row) => [
    row.admin_name || "System",
    row.admin_email || "",
    row.action,
    row.entity_type,
    row.entity_id || "",
    row.metadata || "",
    row.created_at,
  ]);

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
