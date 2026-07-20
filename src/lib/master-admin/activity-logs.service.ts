import { query, type QueryValue } from "@/lib/db";
import { paginationMeta } from "@/lib/master-admin/pagination";

export type ActivityLogFilters = {
  search?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

const ACTIVITY_UNION = `
  SELECT CONCAT('product-', p.id) AS id,
    COALESCE(c.company_name, c.contact_name, c.email, 'Unknown') AS customer,
    COALESCE(c.email, '') AS email,
    'Product' AS type,
    CASE WHEN p.status = 'published' THEN 'Product Published' ELSE 'Product Updated' END AS action,
    CONCAT(p.title, ' (', COALESCE(p.file_name, 'model'), ')') AS details,
    'Customer' AS actor,
    '' AS ip,
    p.updated_at AS occurred_at,
    'Success' AS status
  FROM products p
  LEFT JOIN customers c ON c.customer_uid = p.customer_uid

  UNION ALL

  SELECT CONCAT('payment-', bp.payment_uid),
    COALESCE(c.company_name, c.contact_name, c.email, 'Unknown'),
    COALESCE(c.email, ''),
    'Payment',
    CONCAT('Payment ', CASE bp.status
      WHEN 'captured' THEN 'Paid'
      WHEN 'failed' THEN 'Failed'
      WHEN 'refunded' THEN 'Refunded'
      ELSE 'Pending'
    END),
    CONCAT(COALESCE(bi.invoice_uid, bp.payment_uid), ' · ', COALESCE(bo.plan_id, '')),
    'System',
    'Razorpay',
    bp.updated_at,
    CASE WHEN bp.status = 'captured' THEN 'Success'
         WHEN bp.status = 'failed' THEN 'Failed'
         ELSE 'Warning'
    END
  FROM billing_payments bp
  LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
  LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
  LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
`;

function buildActivityWhere(filters: ActivityLogFilters) {
  const clauses: string[] = ["1=1"];
  const values: QueryValue[] = [];

  const search = (filters.search || "").trim();
  if (search) {
    clauses.push(`(
      t.customer LIKE ? OR t.email LIKE ? OR t.type LIKE ?
      OR t.action LIKE ? OR t.details LIKE ? OR t.actor LIKE ?
    )`);
    const like = `%${search}%`;
    values.push(like, like, like, like, like, like);
  }

  if (filters.type && filters.type !== "all") {
    clauses.push("t.type = ?");
    values.push(filters.type);
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("t.status = ?");
    values.push(filters.status);
  }

  if (filters.dateFrom) {
    clauses.push("DATE(t.occurred_at) >= ?");
    values.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push("DATE(t.occurred_at) <= ?");
    values.push(filters.dateTo);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, values };
}

export async function listActivityLogs(filters: ActivityLogFilters = {}) {
  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 15)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildActivityWhere(filters);

  const fromClause = `FROM (${ACTIVITY_UNION}) t`;

  const [countRows, rows, summaryRows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total ${fromClause} ${where}`, values),
    query<{
      id: string;
      customer: string;
      email: string;
      type: string;
      action: string;
      details: string;
      actor: string;
      ip: string;
      occurred_at: string;
      status: string;
    }>(`
      SELECT t.id, t.customer, t.email, t.type, t.action, t.details, t.actor, t.ip, t.occurred_at, t.status
      ${fromClause}
      ${where}
      ORDER BY t.occurred_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

    query<any>(`
      SELECT
        COUNT(*) AS total,
        SUM(t.type = 'Product') AS productCount,
        SUM(t.type = 'Payment') AS paymentCount,
        SUM(t.status = 'Failed') AS failedCount,
        SUM(CASE WHEN DATE(t.occurred_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCount
      ${fromClause}
      ${where}
    `, values),
  ]);

  const summaryRow = summaryRows[0] || {};

  return {
    logs: rows.map((row) => ({
      id: row.id,
      customer: row.customer,
      email: row.email,
      type: row.type,
      action: row.action,
      details: row.details,
      actor: row.actor,
      ip: row.ip,
      time: row.occurred_at,
      status: row.status,
    })),
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
    summary: {
      total: Number(summaryRow.total || 0),
      productCount: Number(summaryRow.productCount || 0),
      paymentCount: Number(summaryRow.paymentCount || 0),
      failedCount: Number(summaryRow.failedCount || 0),
      today: Number(summaryRow.todayCount || 0),
    },
  };
}

export async function exportActivityLogsCsv(filters: ActivityLogFilters = {}) {
  const { where, values } = buildActivityWhere(filters);
  const fromClause = `FROM (${ACTIVITY_UNION}) t`;

  const rows = await query<{
    customer: string;
    email: string;
    type: string;
    action: string;
    details: string;
    actor: string;
    ip: string;
    occurred_at: string;
    status: string;
  }>(`
    SELECT t.customer, t.email, t.type, t.action, t.details, t.actor, t.ip, t.occurred_at, t.status
    ${fromClause}
    ${where}
    ORDER BY t.occurred_at DESC
    LIMIT 5000
  `, values);

  const header = ["Customer", "Email", "Type", "Action", "Details", "Actor", "IP", "Time", "Status"];
  const lines = rows.map((row) => [
    row.customer,
    row.email,
    row.type,
    row.action,
    row.details,
    row.actor,
    row.ip,
    row.occurred_at,
    row.status,
  ]);

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
