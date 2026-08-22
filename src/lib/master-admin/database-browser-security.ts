/**
 * Master Admin database browser — table/column safety helpers.
 * Sensitive fields are excluded server-side before SQL is built / responses returned.
 */

/** Curated tables exposed in the browse UI (not raw information_schema dump). */
export const DATABASE_BROWSER_TABLE_GROUPS: Record<string, readonly string[]> = {
  Core: ["customers", "users", "master_admins", "admin_roles", "admin_permissions", "admin_role_permissions"],
  Products: [
    "products",
    "product_versions",
    "product_assets",
    "product_edit_log",
    "product_qr_codes",
    "product_embed_configs",
  ],
  Analytics: ["analytics_events", "analytics_sessions", "analytics_daily"],
  Billing: [
    "billing_plans",
    "billing_orders",
    "billing_payments",
    "billing_invoices",
    "billing_history",
    "billing_profiles",
    "billing_webhook_events",
    "billing_refunds",
    "billing_checkout_sessions",
    "billing_plan_price_versions",
    "billing_reconciliation_issues",
    "billing_audit_log",
    "billing_scheduled_changes",
    "billing_reconciliation_runs",
    "billing_renewal_events",
    "billing_credit_notes",
    "billing_admin_alerts",
    "billing_provider_health",
    "billing_notification_outbox",
  ],
  Payments: ["payments", "payment_methods", "plans", "customer_subscriptions", "coupons", "coupon_redemptions"],
  Sharing: ["share_links", "share_events", "qr_scan_events", "embed_view_events"],
  Support: ["support_tickets", "support_ticket_messages"],
  Enterprise: [
    "workspaces",
    "workspace_members",
    "workspace_invites",
    "enterprise_requests",
    "custom_domains",
    "api_keys",
    "api_key_logs",
    "webhooks",
    "webhook_deliveries",
    "usage_counters",
    "usage_daily",
  ],
  Auth: [
    "auth_login_logs",
    "login_logs",
    "password_reset_tokens",
    "customer_sessions",
    "customer_activity_logs",
    "admin_notifications",
  ],
  Notifications: ["customer_notifications", "user_preferences"],
  Settings: ["platform_settings", "storage_usage_snapshots"],
  Account: ["data_export_requests", "account_deletion_requests"],
};

const ALLOWED_TABLES = new Set(
  Object.values(DATABASE_BROWSER_TABLE_GROUPS).flatMap((names) => [...names]),
);

/** Exact column names that must never appear in browser SELECT / column metadata. */
export const SENSITIVE_COLUMN_EXACT = new Set(
  [
    "password_hash",
    "password",
    "passwd",
    "secret_hash",
    "secret",
    "token_hash",
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "session_token",
    "api_key",
    "api_key_hash",
    "key_hash",
    "key_secret",
    "client_secret",
    "webhook_secret",
    "private_key",
    "encryption_key",
    "signing_key",
    "two_factor_code_hash",
    "two_factor_secret",
    "mfa_secret",
    "otp_secret",
    "verification_token",
    "invite_token",
    "reset_token",
    "lease_token",
    "lock_token",
    "razorpay_signature",
    "provider_signature",
    "smtp_password",
    "setting_value", // platform_settings may hold encrypted Razorpay/SMTP secrets
    "raw_payload", // webhook bodies can contain secrets
    "payload_headers",
  ].map((c) => c.toLowerCase()),
);

/** Substring / pattern matches on column names (case-insensitive). */
const SENSITIVE_COLUMN_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token_hash/i,
  /_token$/i,
  /^token_/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /encryption/i,
  /webhook[_-]?secret/i,
  /signing[_-]?key/i,
  /client[_-]?secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /two_factor_code/i,
  /mfa[_-]?secret/i,
  /otp[_-]?secret/i,
  /razorpay[_-]?signature/i,
  /provider[_-]?signature/i,
];

export const DATABASE_BROWSER_MAX_PAGE_SIZE = 50;
export const DATABASE_BROWSER_DEFAULT_PAGE_SIZE = 25;
export const DATABASE_BROWSER_MAX_SEARCH_LENGTH = 200;

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isAllowedBrowserTable(tableName: string): boolean {
  return ALLOWED_TABLES.has(tableName);
}

export function listAllowedBrowserTables(): string[] {
  return [...ALLOWED_TABLES].sort();
}

export function isSafeSqlIdentifier(name: string): boolean {
  return SAFE_IDENT.test(name) && name.length <= 64;
}

export function quoteIdent(name: string): string {
  if (!isSafeSqlIdentifier(name)) {
    throw new Error("Unsafe SQL identifier.");
  }
  return `\`${name}\``;
}

export function isSensitiveBrowserColumn(columnName: string): boolean {
  const name = String(columnName || "").trim();
  if (!name) return true;
  const lower = name.toLowerCase();
  if (SENSITIVE_COLUMN_EXACT.has(lower)) return true;
  return SENSITIVE_COLUMN_PATTERNS.some((re) => re.test(name));
}

export function filterSafeBrowserColumns(columnNames: string[]): string[] {
  return columnNames.filter((name) => isSafeSqlIdentifier(name) && !isSensitiveBrowserColumn(name));
}

export type BrowserPagination = {
  page: number;
  pageSize: number;
  offset: number;
};

/**
 * Clamp pagination. Oversized pageSize is capped (not expanded unbounded).
 */
export function normalizeBrowserPagination(input: {
  page?: number | string | null;
  pageSize?: number | string | null;
}): BrowserPagination {
  const pageRaw = Number(input.page ?? 1);
  const sizeRaw = Number(input.pageSize ?? DATABASE_BROWSER_DEFAULT_PAGE_SIZE);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  let pageSize = Number.isFinite(sizeRaw) ? Math.floor(sizeRaw) : DATABASE_BROWSER_DEFAULT_PAGE_SIZE;
  if (pageSize < 1) pageSize = 1;
  if (pageSize > DATABASE_BROWSER_MAX_PAGE_SIZE) pageSize = DATABASE_BROWSER_MAX_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export type BuildRowsQueryInput = {
  tableName: string;
  safeColumns: string[];
  searchableColumns: string[];
  search?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
  /** Optional sort — must already be in safeColumns. */
  orderBy?: string | null;
  orderDir?: string | null;
};

export type BuildRowsQueryResult =
  | {
      ok: true;
      countSql: string;
      rowsSql: string;
      values: (string | number)[];
      pagination: BrowserPagination;
      selectColumns: string[];
    }
  | { ok: false; error: string; status: number };

/**
 * Build parameterized COUNT + SELECT for the database browser.
 * Never uses SELECT *. Never concatenates user-provided identifiers.
 */
export function buildDatabaseBrowserRowsQuery(input: BuildRowsQueryInput): BuildRowsQueryResult {
  const tableName = String(input.tableName || "").trim();
  if (!isAllowedBrowserTable(tableName) || !isSafeSqlIdentifier(tableName)) {
    return { ok: false, error: "Table is not allowed.", status: 400 };
  }

  const selectColumns = filterSafeBrowserColumns(input.safeColumns);
  if (!selectColumns.length) {
    return { ok: false, error: "No browsable columns for this table.", status: 400 };
  }

  const pagination = normalizeBrowserPagination({
    page: input.page,
    pageSize: input.pageSize,
  });

  let where = "";
  const values: (string | number)[] = [];
  const search = String(input.search || "").trim().slice(0, DATABASE_BROWSER_MAX_SEARCH_LENGTH);
  if (search) {
    const searchable = filterSafeBrowserColumns(input.searchableColumns).filter((c) =>
      selectColumns.includes(c),
    );
    if (searchable.length > 0) {
      const conditions = searchable.map((c) => `CAST(${quoteIdent(c)} AS CHAR) LIKE ?`);
      where = `WHERE ${conditions.join(" OR ")}`;
      for (let i = 0; i < searchable.length; i++) values.push(`%${search}%`);
    }
  }

  let orderSql = "";
  const orderBy = input.orderBy ? String(input.orderBy).trim() : "";
  if (orderBy) {
    if (!isSafeSqlIdentifier(orderBy) || !selectColumns.includes(orderBy)) {
      return { ok: false, error: "Invalid sort column.", status: 400 };
    }
    const dir = String(input.orderDir || "ASC").trim().toUpperCase();
    if (dir !== "ASC" && dir !== "DESC") {
      return { ok: false, error: "Invalid sort direction.", status: 400 };
    }
    orderSql = ` ORDER BY ${quoteIdent(orderBy)} ${dir}`;
  }

  const tableSql = quoteIdent(tableName);
  const colSql = selectColumns.map(quoteIdent).join(", ");
  const countSql = `SELECT COUNT(*) AS total FROM ${tableSql} ${where}`;
  const rowsSql =
    `SELECT ${colSql} FROM ${tableSql} ${where}${orderSql}` +
    ` LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;

  return {
    ok: true,
    countSql,
    rowsSql,
    values,
    pagination,
    selectColumns,
  };
}

/** Strip sensitive keys from an already-fetched row (e.g. ad-hoc query results). */
export function redactSensitiveRowFields<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSensitiveBrowserColumn(key)) continue;
    out[key] = value;
  }
  return out as T;
}
