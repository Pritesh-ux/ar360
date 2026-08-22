import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE_GROUPS: Record<string, string[]> = {
  Core: ["customers", "users", "master_admins", "admin_roles", "admin_permissions", "admin_role_permissions"],
  Products: ["products", "product_versions", "product_assets", "product_edit_log", "product_qr_codes", "product_embed_configs"],
  Analytics: ["analytics_events", "analytics_sessions", "analytics_daily"],
  Billing: ["billing_plans", "billing_orders", "billing_payments", "billing_invoices", "billing_history", "billing_profiles", "billing_webhook_events", "billing_refunds", "billing_checkout_sessions", "billing_plan_price_versions", "billing_reconciliation_issues", "billing_audit_log", "billing_scheduled_changes", "billing_reconciliation_runs", "billing_renewal_events", "billing_credit_notes", "billing_admin_alerts", "billing_provider_health", "billing_notification_outbox"],
  Payments: ["payments", "payment_methods", "plans", "customer_subscriptions", "coupons", "coupon_redemptions"],
  Sharing: ["share_links", "share_events", "qr_scan_events", "embed_view_events"],
  Support: ["support_tickets", "support_ticket_messages"],
  Enterprise: ["workspaces", "workspace_members", "workspace_invites", "enterprise_requests", "custom_domains", "api_keys", "api_key_logs", "webhooks", "webhook_deliveries", "usage_counters", "usage_daily"],
  Auth: ["auth_login_logs", "login_logs", "password_reset_tokens", "customer_sessions", "customer_activity_logs", "admin_notifications"],
  Notifications: ["customer_notifications", "user_preferences"],
  Settings: ["platform_settings", "storage_usage_snapshots"],
  Account: ["data_export_requests", "account_deletion_requests"],
};

function pickField<T extends Record<string, unknown>>(row: T, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
    const upper = key.toUpperCase();
    if (row[upper] !== undefined && row[upper] !== null) return row[upper];
    const lower = key.toLowerCase();
    if (row[lower] !== undefined && row[lower] !== null) return row[lower];
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("customers.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureAppSchema().catch((error) => {
      console.error("[master-admin/database] ensureAppSchema skipped", error);
    });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "tables";

    if (action === "tables") {
      let tableRows: Record<string, unknown>[] = [];
      try {
        tableRows = await query<Record<string, unknown>>(
          `SELECT TABLE_NAME AS table_name, TABLE_ROWS AS row_count
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = DATABASE()
           ORDER BY TABLE_NAME ASC`,
        );
      } catch (error) {
        console.error("[master-admin/database] information_schema failed", error);
        const shown = await query<Record<string, unknown>>("SHOW TABLES");
        tableRows = shown.map((row) => {
          const name = String(Object.values(row)[0] || "");
          return { table_name: name, row_count: 0 };
        });
      }

      const rowMap = new Map<string, number>();
      for (const row of tableRows) {
        const name = String(pickField(row, "table_name", "TABLE_NAME") || "").trim();
        if (!name) continue;
        rowMap.set(name, Number(pickField(row, "row_count", "TABLE_ROWS", "table_rows") || 0));
      }

      const tables = Object.entries(TABLE_GROUPS)
        .map(([group, names]) => ({
          group,
          tables: names
            .filter((name) => rowMap.has(name))
            .map((name) => ({ name, rows: rowMap.get(name) ?? 0 })),
        }))
        .filter((group) => group.tables.length > 0);

      // Any live tables not in the curated groups (so nothing "vanishes").
      const known = new Set(Object.values(TABLE_GROUPS).flat());
      const other = [...rowMap.keys()]
        .filter((name) => !known.has(name))
        .sort()
        .map((name) => ({ name, rows: rowMap.get(name) ?? 0 }));
      if (other.length) {
        tables.push({ group: "Other", tables: other });
      }

      const allTables = tables.flatMap((g) => g.tables);
      return NextResponse.json({ tables, totalTables: allTables.length });
    }

    if (action === "columns") {
      const tableName = searchParams.get("table");
      if (!tableName || !/^[a-z0-9_]+$/i.test(tableName)) {
        return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
      }
      const rawColumns = await query<Record<string, unknown>>(
        `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
                COLUMN_DEFAULT AS column_default, COLUMN_KEY AS column_key
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION ASC`,
        [tableName],
      );
      const columns = rawColumns.map((row) => ({
        column_name: String(pickField(row, "column_name", "COLUMN_NAME") || ""),
        data_type: String(pickField(row, "data_type", "DATA_TYPE") || ""),
        is_nullable: String(pickField(row, "is_nullable", "IS_NULLABLE") || ""),
        column_default: (pickField(row, "column_default", "COLUMN_DEFAULT") as string | null) ?? null,
        column_key: String(pickField(row, "column_key", "COLUMN_KEY") || ""),
      }));
      return NextResponse.json({ columns });
    }

    if (action === "rows") {
      const tableName = searchParams.get("table");
      if (!tableName || !/^[a-z0-9_]+$/i.test(tableName)) {
        return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
      }
      const page = Math.max(1, Number(searchParams.get("page") || "1"));
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || "25")));
      const search = searchParams.get("search") || "";
      const offset = (page - 1) * pageSize;

      let where = "";
      const values: (string | number)[] = [];

      if (search) {
        const rawColumns = await query<Record<string, unknown>>(
          `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [tableName],
        );
        const searchable = rawColumns
          .map((row) => ({
            column_name: String(pickField(row, "column_name", "COLUMN_NAME") || ""),
            data_type: String(pickField(row, "data_type", "DATA_TYPE") || "").toLowerCase(),
          }))
          .filter((c) =>
            ["varchar", "text", "char", "enum", "longtext", "mediumtext"].includes(c.data_type),
          );
        if (searchable.length > 0) {
          const conditions = searchable.map((c) => `CAST(\`${c.column_name}\` AS CHAR) LIKE ?`);
          where = `WHERE ${conditions.join(" OR ")}`;
          searchable.forEach(() => values.push(`%${search}%`));
        }
      }

      // Inline LIMIT/OFFSET as safe integers (avoids prepared-statement edge cases).
      const safeLimit = Math.floor(pageSize);
      const safeOffset = Math.floor(offset);

      const [countResult, rows] = await Promise.all([
        query<{ total: number }>(`SELECT COUNT(*) AS total FROM \`${tableName}\` ${where}`, values),
        query<Record<string, unknown>>(
          `SELECT * FROM \`${tableName}\` ${where} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          values,
        ),
      ]);

      const total = Number(countResult[0]?.total || 0);
      return NextResponse.json({
        rows,
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[master-admin/database GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database manager failed." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("database.query", { request: req });
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const body = await req.json() as { sql?: string };
  const sql = (body.sql || "").trim();

  if (!sql) {
    return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
  }

  if (sql.length > 4000) {
    return NextResponse.json({ error: "Query too long." }, { status: 400 });
  }

  // Single statement only — no stacked queries.
  if (sql.includes(";")) {
    return NextResponse.json({ error: "Multiple statements are not allowed." }, { status: 403 });
  }

  const upper = sql.replace(/\s+/g, " ").trim().toUpperCase();

  if (!upper.startsWith("SELECT ") && !upper.startsWith("(SELECT ") && !upper.startsWith("SHOW ") && !upper.startsWith("DESCRIBE ") && !upper.startsWith("DESC ") && !upper.startsWith("EXPLAIN ")) {
    return NextResponse.json({ error: "Only read-only SELECT/SHOW/DESCRIBE/EXPLAIN queries are permitted." }, { status: 403 });
  }

  const blocked = [
    "INTO OUTFILE",
    "INTO DUMPFILE",
    "LOAD_FILE",
    "SLEEP(",
    "BENCHMARK(",
    "WAITFOR",
    "EXEC ",
    "EXECUTE ",
    "CALL ",
    "FOR UPDATE",
    "LOCK IN SHARE MODE",
    "INTO @",
    "GET_LOCK",
    "RELEASE_LOCK",
    "INFORMATION_SCHEMA.PROCESSLIST",
    "MYSQL.USER",
    "PERFORMANCE_SCHEMA",
  ];
  for (const pattern of blocked) {
    if (upper.includes(pattern)) {
      return NextResponse.json({ error: "Query contains forbidden pattern." }, { status: 403 });
    }
  }

  // Cap result size unless caller already limited.
  const limitedSql = /\bLIMIT\b/i.test(sql) ? sql : `${sql} LIMIT 200`;

  try {
    const startTime = Date.now();
    const rows = await query<Record<string, unknown>>(limitedSql);
    const elapsed = Date.now() - startTime;

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    await logAdminAudit(auth.admin, "database.query", "database", null, {
      rowCount: rows.length,
      elapsed,
      preview: sql.slice(0, 200),
    });
    return NextResponse.json({ rows, columns, rowCount: rows.length, elapsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
