import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  DATABASE_BROWSER_MAX_PAGE_SIZE,
  buildDatabaseBrowserRowsQuery,
  filterSafeBrowserColumns,
  isAllowedBrowserTable,
  isSensitiveBrowserColumn,
  normalizeBrowserPagination,
  redactSensitiveRowFields,
} from "@/lib/master-admin/database-browser-security";
import {
  hasAdminPermission,
  ROLE_PERMISSION_FALLBACK,
} from "@/lib/permissions/admin-permissions";

describe("database browser table allowlist", () => {
  it("allows curated application tables", () => {
    assert.equal(isAllowedBrowserTable("users"), true);
    assert.equal(isAllowedBrowserTable("customers"), true);
    assert.equal(isAllowedBrowserTable("platform_settings"), true);
  });

  it("rejects arbitrary / unknown tables", () => {
    assert.equal(isAllowedBrowserTable("mysql.user"), false);
    assert.equal(isAllowedBrowserTable("users; DROP TABLE users"), false);
    assert.equal(isAllowedBrowserTable("not_a_real_table_xyz"), false);
    assert.equal(isAllowedBrowserTable(""), false);
  });
});

describe("database browser sensitive columns", () => {
  it("excludes password hashes, tokens, secrets, and settings values", () => {
    for (const col of [
      "password_hash",
      "two_factor_code_hash",
      "token",
      "token_hash",
      "secret_hash",
      "api_key",
      "key_hash",
      "webhook_secret",
      "razorpay_signature",
      "setting_value",
      "verification_token",
      "lease_token",
      "lock_token",
      "access_token",
      "smtp_password",
    ]) {
      assert.equal(isSensitiveBrowserColumn(col), true, col);
    }
  });

  it("keeps ordinary operational columns", () => {
    for (const col of ["id", "email", "customer_uid", "status", "created_at", "plan_id", "name"]) {
      assert.equal(isSensitiveBrowserColumn(col), false, col);
    }
  });

  it("filters safe column lists server-side", () => {
    const safe = filterSafeBrowserColumns([
      "id",
      "email",
      "password_hash",
      "token",
      "status",
      "setting_value",
    ]);
    assert.deepEqual(safe, ["id", "email", "status"]);
  });

  it("redacts sensitive keys from row objects", () => {
    const redacted = redactSensitiveRowFields({
      id: 1,
      email: "a@example.com",
      password_hash: "SHOULD_NOT_LEAK",
      token: "SHOULD_NOT_LEAK",
    });
    assert.equal(redacted.id, 1);
    assert.equal(redacted.email, "a@example.com");
    assert.equal("password_hash" in redacted, false);
    assert.equal("token" in redacted, false);
  });
});

describe("database browser SQL builder", () => {
  it("never emits SELECT * and only quotes allowlisted columns", () => {
    const built = buildDatabaseBrowserRowsQuery({
      tableName: "users",
      safeColumns: ["id", "email", "password_hash", "status"],
      searchableColumns: ["email", "password_hash"],
      search: "alice",
      page: 1,
      pageSize: 25,
    });
    assert.equal(built.ok, true);
    if (built.ok === false) return;
    assert.doesNotMatch(built.rowsSql, /SELECT \*/i);
    assert.match(built.rowsSql, /SELECT `id`, `email`, `status` FROM `users`/);
    assert.doesNotMatch(built.rowsSql, /password_hash/);
    assert.equal(built.values.length, 1); // email LIKE only (password_hash not searchable)
    assert.ok(built.values.every((v) => typeof v === "string" && v.includes("alice")));
  });

  it("rejects arbitrary table names", () => {
    const built = buildDatabaseBrowserRowsQuery({
      tableName: "evil_table",
      safeColumns: ["id"],
      searchableColumns: [],
    });
    assert.equal(built.ok, false);
  });

  it("rejects arbitrary order/column SQL", () => {
    const built = buildDatabaseBrowserRowsQuery({
      tableName: "users",
      safeColumns: ["id", "email"],
      searchableColumns: [],
      orderBy: "id; DROP TABLE users",
      orderDir: "ASC",
    });
    assert.equal(built.ok, false);

    const built2 = buildDatabaseBrowserRowsQuery({
      tableName: "users",
      safeColumns: ["id", "email"],
      searchableColumns: [],
      orderBy: "password_hash",
      orderDir: "ASC",
    });
    assert.equal(built2.ok, false);

    const built3 = buildDatabaseBrowserRowsQuery({
      tableName: "users",
      safeColumns: ["id", "email"],
      searchableColumns: [],
      orderBy: "email",
      orderDir: "SIDEWAYS",
    });
    assert.equal(built3.ok, false);
  });

  it("caps oversized page size", () => {
    const pagination = normalizeBrowserPagination({ page: 1, pageSize: 10_000 });
    assert.equal(pagination.pageSize, DATABASE_BROWSER_MAX_PAGE_SIZE);

    const built = buildDatabaseBrowserRowsQuery({
      tableName: "customers",
      safeColumns: ["id", "email"],
      searchableColumns: [],
      pageSize: 9999,
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.equal(built.pagination.pageSize, DATABASE_BROWSER_MAX_PAGE_SIZE);
      assert.match(built.rowsSql, new RegExp(`LIMIT ${DATABASE_BROWSER_MAX_PAGE_SIZE}`));
    }
  });

  it("parameterizes search filters", () => {
    const built = buildDatabaseBrowserRowsQuery({
      tableName: "customers",
      safeColumns: ["id", "email", "company_name"],
      searchableColumns: ["email", "company_name"],
      search: "acme%' OR 1=1 --",
    });
    assert.equal(built.ok, true);
    if (built.ok === false) return;
    assert.match(built.rowsSql, /LIKE \?/);
    assert.equal((built.rowsSql.match(/LIKE \?/g) || []).length, 2);
    assert.doesNotMatch(built.rowsSql, /acme/);
    assert.ok(built.values.every((v) => String(v).includes("acme%' OR 1=1 --")));
  });
});

describe("database browser authorization model", () => {
  it("customers.read alone does not imply database.query", () => {
    assert.equal(
      hasAdminPermission("support_admin", new Set(["customers.read"]), "database.query"),
      false,
    );
    assert.equal(
      hasAdminPermission(
        "support_admin",
        new Set(ROLE_PERMISSION_FALLBACK.support_admin),
        "database.query",
      ),
      false,
    );
  });

  it("super_admin retains database.query", () => {
    assert.equal(hasAdminPermission("super_admin", new Set(), "database.query"), true);
  });
});

describe("database route source contracts", () => {
  it("GET requires database.query and does not use SELECT *", async () => {
    const src = await readFile(new URL("../../app/api/master-admin/database/route.ts", import.meta.url), "utf8");
    assert.match(src, /guardAdminPermission\("database\.query"/);
    assert.doesNotMatch(src, /guardAdminPermission\("customers\.read"/);
    assert.doesNotMatch(src, /SELECT \* FROM/);
    assert.match(src, /buildDatabaseBrowserRowsQuery/);
    assert.match(src, /redactSensitiveRowFields/);
    assert.match(src, /isAllowedBrowserTable/);
  });
});
