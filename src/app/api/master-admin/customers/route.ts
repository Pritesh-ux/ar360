import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { setCustomerPlan } from "@/lib/billing/admin-plans";
import { assertAdminPlanOverrideAllowed } from "@/lib/billing/admin-plan-override-guard";
import { paginationMeta, parsePagination } from "@/lib/master-admin/pagination";

type CustomerRow = {
  customer_uid: string;
  contact_name: string;
  company_name: string | null;
  email: string;
  country: string | null;
  plan_id: string;
  status: string;
  storage_used_mb: number;
  bandwidth_used_mb: number;
  created_at: string;
  last_login_at: string | null;
  product_count: number;
  published_count: number;
  total_revenue: number;
};

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("customers.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  try {
    // Never block the customers list on schema migrations.
    await ensureAppSchema().catch((error) => {
      console.error("[master-admin/customers] ensureAppSchema skipped", error);
    });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const status = searchParams.get("status") || "";
    const company = searchParams.get("company") || "";
    const country = searchParams.get("country") || "";
    const signupFrom = searchParams.get("signupFrom") || "";
    const signupTo = searchParams.get("signupTo") || "";

    const conditions: string[] = ["COALESCE(c.status, '') <> 'Deleted'"];
    const values: (string | number)[] = [];

    if (search) {
      conditions.push(
        "(c.contact_name LIKE ? OR c.email LIKE ? OR IFNULL(c.company_name, '') LIKE ? OR c.customer_uid LIKE ?)",
      );
      const like = `%${search}%`;
      values.push(like, like, like, like);
    }
    if (plan) {
      conditions.push("c.plan_id = ?");
      values.push(plan);
    }
    if (status) {
      conditions.push("c.status = ?");
      values.push(status);
    }
    if (company) {
      conditions.push("IFNULL(c.company_name, '') LIKE ?");
      values.push(`%${company}%`);
    }
    if (country) {
      conditions.push("IFNULL(c.country, '') LIKE ?");
      values.push(`%${country}%`);
    }
    if (signupFrom) {
      conditions.push("DATE(c.created_at) >= ?");
      values.push(signupFrom);
    }
    if (signupTo) {
      conditions.push("DATE(c.created_at) <= ?");
      values.push(signupTo);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const { page, pageSize, offset } = parsePagination(searchParams, { pageSize: 10 });

    // Prefer live asset bytes when the cached customers.storage_used_mb column is stale/zero.
    const storageUsedExpr = `
      GREATEST(
        COALESCE(c.storage_used_mb, 0),
        COALESCE((
          SELECT ROUND(COALESCE(SUM(pa.size_bytes), 0) / (1024 * 1024), 2)
          FROM product_assets pa
          WHERE pa.customer_uid = c.customer_uid
            AND pa.deleted_at IS NULL
        ), 0)
      )
    `;

    const revenueExpr = `
      COALESCE((
        SELECT ROUND(SUM(COALESCE(bi.total_paise, bp.amount_paise)) / 100, 0)
        FROM billing_payments bp
        LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
        WHERE bp.customer_uid = c.customer_uid
          AND bp.status = 'captured'
      ), 0)
    `;

    // Minimal columns proven to exist on live (same as mysql CLI check).
    const listSqlMinimal = `
      SELECT
        c.customer_uid,
        c.contact_name,
        NULL AS company_name,
        c.email,
        NULL AS country,
        c.plan_id,
        c.status,
        0 AS storage_used_mb,
        0 AS bandwidth_used_mb,
        c.created_at,
        NULL AS last_login_at,
        0 AS product_count,
        0 AS published_count,
        0 AS total_revenue
      FROM customers c
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listSqlSimple = `
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.country,
        c.plan_id,
        c.status,
        ${storageUsedExpr} AS storage_used_mb,
        COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb,
        c.created_at,
        NULL AS last_login_at,
        0 AS product_count,
        0 AS published_count,
        ${revenueExpr} AS total_revenue
      FROM customers c
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listSqlFull = `
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.country,
        c.plan_id,
        c.status,
        ${storageUsedExpr} AS storage_used_mb,
        COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb,
        c.created_at,
        MAX(u.last_login_at) AS last_login_at,
        COUNT(DISTINCT p.id) AS product_count,
        SUM(CASE WHEN LOWER(COALESCE(p.status, '')) IN ('published', 'active') THEN 1 ELSE 0 END) AS published_count,
        ${revenueExpr} AS total_revenue
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN products p ON p.customer_uid = c.customer_uid AND (p.deleted_at IS NULL)
      ${where}
      GROUP BY
        c.customer_uid, c.contact_name, c.company_name, c.email, c.country,
        c.plan_id, c.status, c.storage_used_mb, c.bandwidth_used_mb, c.created_at
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Cached column only — used if product_assets live sum is unavailable.
    const listSqlFullCached = `
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.country,
        c.plan_id,
        c.status,
        COALESCE(c.storage_used_mb, 0) AS storage_used_mb,
        COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb,
        c.created_at,
        MAX(u.last_login_at) AS last_login_at,
        COUNT(DISTINCT p.id) AS product_count,
        SUM(CASE WHEN LOWER(COALESCE(p.status, '')) IN ('published', 'active') THEN 1 ELSE 0 END) AS published_count,
        ${revenueExpr} AS total_revenue
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN products p ON p.customer_uid = c.customer_uid
      ${where}
      GROUP BY
        c.customer_uid, c.contact_name, c.company_name, c.email, c.country,
        c.plan_id, c.status, c.storage_used_mb, c.bandwidth_used_mb, c.created_at
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listSqlSimpleCached = `
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.country,
        c.plan_id,
        c.status,
        COALESCE(c.storage_used_mb, 0) AS storage_used_mb,
        COALESCE(c.bandwidth_used_mb, 0) AS bandwidth_used_mb,
        c.created_at,
        NULL AS last_login_at,
        0 AS product_count,
        0 AS published_count,
        ${revenueExpr} AS total_revenue
      FROM customers c
      ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) AS total FROM customers c ${where}`;

    let countRows: { total: number }[] = [{ total: 0 }];
    let rows: CustomerRow[] = [];

    const listArgs = [...values, pageSize, offset] as (string | number)[];
    const listAttempts = [listSqlFull, listSqlFullCached, listSqlSimple, listSqlSimpleCached, listSqlMinimal];
    let lastListError: unknown = null;
    for (const listSql of listAttempts) {
      try {
        [countRows, rows] = await Promise.all([
          query<{ total: number }>(countSql, values).catch(() =>
            query<{ total: number }>("SELECT COUNT(*) AS total FROM customers"),
          ),
          query<CustomerRow>(listSql, listArgs),
        ]);
        lastListError = null;
        break;
      } catch (error) {
        lastListError = error;
        console.error("[master-admin/customers] list query failed", error);
      }
    }
    if (lastListError) {
      throw lastListError;
    }

    type SummaryRow = {
      total: number;
      active: number;
      suspended: number;
      trial: number;
      enterprise: number;
    };
    const emptySummary: SummaryRow = { total: 0, active: 0, suspended: 0, trial: 0, enterprise: 0 };

    const [summaryRows, countryRows] = await Promise.all([
      query<SummaryRow>(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'Active'), 0) AS active,
          COALESCE(SUM(status = 'Suspended'), 0) AS suspended,
          COALESCE(SUM(plan_id IN ('trial', 'free') OR plan_id IS NULL OR plan_id = ''), 0) AS trial,
          COALESCE(SUM(plan_id = 'enterprise'), 0) AS enterprise
        FROM customers
      `).catch((): SummaryRow[] => [
        {
          total: rows.length,
          active: rows.filter((r) => r.status === "Active").length,
          suspended: rows.filter((r) => r.status === "Suspended").length,
          trial: rows.filter((r) => !r.plan_id || r.plan_id === "trial" || r.plan_id === "free").length,
          enterprise: rows.filter((r) => r.plan_id === "enterprise").length,
        },
      ]),
      query<{ country: string }>(`
        SELECT DISTINCT country
        FROM customers
        WHERE country IS NOT NULL AND country != ''
        ORDER BY country ASC
        LIMIT 100
      `).catch((): { country: string }[] => []),
    ]);

    const mappedCustomers = rows.map((row) => ({
      ...row,
      storage_used_mb: Number(row.storage_used_mb || 0),
      bandwidth_used_mb: Number(row.bandwidth_used_mb || 0),
      product_count: Number(row.product_count || 0),
      published_count: Number(row.published_count || 0),
      total_revenue: Number(row.total_revenue || 0),
    }));

    const summaryRow: SummaryRow = summaryRows[0] || emptySummary;
    const total = Number(summaryRow.total || 0) || 1;
    const filteredTotal = Number(countRows[0]?.total || mappedCustomers.length || 0);
    const pagination = paginationMeta(filteredTotal, page, pageSize);

    return NextResponse.json({
      customers: mappedCustomers,
      pagination,
      countries: countryRows.map((row) => row.country).filter(Boolean),
      summary: {
        total: Number(summaryRow.total || 0),
        active: Number(summaryRow.active || 0),
        suspended: Number(summaryRow.suspended || 0),
        trial: Number(summaryRow.trial || 0),
        enterprise: Number(summaryRow.enterprise || 0),
        activePct: Math.round((Number(summaryRow.active || 0) / total) * 1000) / 10,
        trialPct: Math.round((Number(summaryRow.trial || 0) / total) * 1000) / 10,
        suspendedPct: Math.round((Number(summaryRow.suspended || 0) / total) * 1000) / 10,
        enterprisePct: Math.round((Number(summaryRow.enterprise || 0) / total) * 1000) / 10,
      },
    });
  } catch (error) {
    console.error("[master-admin/customers GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Customers load failed." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  await ensureAppSchema();

  const body = await req.json() as { customer_uid: string; action: "suspend" | "activate" | "change_plan"; plan_id?: string };
  const { customer_uid, action, plan_id } = body;

  if (!customer_uid || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const permission =
    action === "change_plan"
      ? "subscriptions.update"
      : action === "suspend" || action === "activate"
        ? "customers.suspend"
        : "customers.update";

  const auth = await guardAdminPermission(permission);
  if (auth instanceof NextResponse) return auth;

  if (action === "suspend") {
    await query("UPDATE customers SET status = 'Suspended', updated_at = NOW() WHERE customer_uid = ?", [
      customer_uid,
    ]);
    await query(
      `UPDATE users u
       INNER JOIN customers c ON c.user_id = u.id
       SET u.status = 'Suspended'
       WHERE c.customer_uid = ?`,
      [customer_uid],
    );
    const { createCustomerNotification } = await import("@/lib/account/notify.service");
    await createCustomerNotification({
      customerUid: customer_uid,
      category: "system",
      title: "Account suspended",
      body: "Your AR360 account has been suspended. You can still sign in, but features stay locked until support reactivates you.",
      href: "/dashboard/account-suspended",
      dedupeKey: `account-suspended:${customer_uid}`,
    }).catch(() => {});
  } else if (action === "activate") {
    await query("UPDATE customers SET status = 'Active', updated_at = NOW() WHERE customer_uid = ?", [
      customer_uid,
    ]);
    await query(
      `UPDATE users u
       INNER JOIN customers c ON c.user_id = u.id
       SET u.status = 'Active'
       WHERE c.customer_uid = ? AND u.status = 'Suspended'`,
      [customer_uid],
    );
    const { createCustomerNotification } = await import("@/lib/account/notify.service");
    await createCustomerNotification({
      customerUid: customer_uid,
      category: "system",
      title: "Account reactivated",
      body: "Your AR360 account access has been restored.",
      href: "/dashboard",
      dedupeKey: `account-reactivated:${customer_uid}`,
    });
  } else if (action === "change_plan" && plan_id) {
    const blocked = await assertAdminPlanOverrideAllowed(customer_uid);
    if (blocked) return blocked;
    await setCustomerPlan({ customerUid: customer_uid, planId: plan_id, status: plan_id === "trial" ? "trialing" : "active" });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await logAdminAudit(auth.admin, `customer.${action}`, "customer", customer_uid, { plan_id });
  return NextResponse.json({ ok: true });
}
