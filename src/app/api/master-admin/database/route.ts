import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import {
  DATABASE_BROWSER_TABLE_GROUPS,
  buildDatabaseBrowserRowsQuery,
  filterSafeBrowserColumns,
  isAllowedBrowserTable,
  isSafeSqlIdentifier,
  isSensitiveBrowserColumn,
  redactSensitiveRowFields,
} from "@/lib/master-admin/database-browser-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function loadTableColumnMeta(tableName: string) {
  const rawColumns = await query<Record<string, unknown>>(
    `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable,
            COLUMN_DEFAULT AS column_default, COLUMN_KEY AS column_key
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION ASC`,
    [tableName],
  );
  return rawColumns.map((row) => ({
    column_name: String(pickField(row, "column_name", "COLUMN_NAME") || ""),
    data_type: String(pickField(row, "data_type", "DATA_TYPE") || ""),
    is_nullable: String(pickField(row, "is_nullable", "IS_NULLABLE") || ""),
    column_default: (pickField(row, "column_default", "COLUMN_DEFAULT") as string | null) ?? null,
    column_key: String(pickField(row, "column_key", "COLUMN_KEY") || ""),
  }));
}

export async function GET(req: NextRequest) {
  // Least privilege: same capability as the read-only SQL console (not customers.read).
  const auth = await guardAdminPermission("database.query", { request: req });
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

      // Only curated allowlist — do not expose arbitrary live tables.
      const tables = Object.entries(DATABASE_BROWSER_TABLE_GROUPS)
        .map(([group, names]) => ({
          group,
          tables: names
            .filter((name) => rowMap.has(name))
            .map((name) => ({ name, rows: rowMap.get(name) ?? 0 })),
        }))
        .filter((group) => group.tables.length > 0);

      const allTables = tables.flatMap((g) => g.tables);
      return NextResponse.json({ tables, totalTables: allTables.length });
    }

    if (action === "columns") {
      const tableName = searchParams.get("table") || "";
      if (!isAllowedBrowserTable(tableName) || !isSafeSqlIdentifier(tableName)) {
        return NextResponse.json({ error: "Table is not allowed." }, { status: 400 });
      }
      const rawColumns = await loadTableColumnMeta(tableName);
      const columns = rawColumns.filter(
        (c) => c.column_name && !isSensitiveBrowserColumn(c.column_name) && isSafeSqlIdentifier(c.column_name),
      );
      return NextResponse.json({ columns });
    }

    if (action === "rows") {
      const tableName = searchParams.get("table") || "";
      if (!isAllowedBrowserTable(tableName) || !isSafeSqlIdentifier(tableName)) {
        return NextResponse.json({ error: "Table is not allowed." }, { status: 400 });
      }

      // Reject arbitrary client ORDER BY SQL fragments unless validated by builder.
      const orderBy = searchParams.get("orderBy");
      const orderDir = searchParams.get("orderDir");

      const meta = await loadTableColumnMeta(tableName);
      const allNames = meta.map((c) => c.column_name).filter(Boolean);
      const safeColumns = filterSafeBrowserColumns(allNames);
      const searchableColumns = meta
        .filter((c) =>
          ["varchar", "text", "char", "enum", "longtext", "mediumtext"].includes(
            c.data_type.toLowerCase(),
          ),
        )
        .map((c) => c.column_name);

      const built = buildDatabaseBrowserRowsQuery({
        tableName,
        safeColumns,
        searchableColumns,
        search: searchParams.get("search"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize"),
        orderBy,
        orderDir,
      });
      if (built.ok === false) {
        return NextResponse.json({ error: built.error }, { status: built.status });
      }

      const [countResult, rows] = await Promise.all([
        query<{ total: number }>(built.countSql, built.values),
        query<Record<string, unknown>>(built.rowsSql, built.values),
      ]);

      // Defense in depth: never return sensitive keys even if schema drifts.
      const safeRows = rows.map((row) => redactSensitiveRowFields(row));

      const total = Number(countResult[0]?.total || 0);
      const { page, pageSize } = built.pagination;
      return NextResponse.json({
        rows: safeRows,
        columns: built.selectColumns,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[master-admin/database GET]", error);
    return NextResponse.json(
      { error: "Database manager failed." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("database.query", { request: req });
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const body = (await req.json()) as { sql?: string };
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

  if (
    !upper.startsWith("SELECT ") &&
    !upper.startsWith("(SELECT ") &&
    !upper.startsWith("SHOW ") &&
    !upper.startsWith("DESCRIBE ") &&
    !upper.startsWith("DESC ") &&
    !upper.startsWith("EXPLAIN ")
  ) {
    return NextResponse.json(
      { error: "Only read-only SELECT/SHOW/DESCRIBE/EXPLAIN queries are permitted." },
      { status: 403 },
    );
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

    // Redact secret-bearing columns from ad-hoc query results (server-side).
    const safeRows = rows.map((row) => redactSensitiveRowFields(row));
    const columns = safeRows.length > 0 ? Object.keys(safeRows[0]!) : [];
    await logAdminAudit(auth.admin, "database.query", "database", null, {
      rowCount: safeRows.length,
      elapsed,
      preview: sql.slice(0, 200),
    });
    return NextResponse.json({ rows: safeRows, columns, rowCount: safeRows.length, elapsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
