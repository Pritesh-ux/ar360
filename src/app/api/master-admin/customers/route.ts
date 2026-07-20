import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { setCustomerPlan } from "@/lib/billing/admin-plans";
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

  await ensureAppSchema();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "";
  const status = searchParams.get("status") || "";
  const company = searchParams.get("company") || "";
  const country = searchParams.get("country") || "";
  const signupFrom = searchParams.get("signupFrom") || "";
  const signupTo = searchParams.get("signupTo") || "";

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (search) {
    conditions.push("(c.contact_name LIKE ? OR c.email LIKE ? OR c.company_name LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like);
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
    conditions.push("c.company_name LIKE ?");
    values.push(`%${company}%`);
  }
  if (country) {
    conditions.push("c.country LIKE ?");
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

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { page, pageSize, offset } = parsePagination(searchParams, { pageSize: 10 });

  const [countRows, rows, summaryRows, countryRows] = await Promise.all([
    query<{ total: number }>(`
      SELECT COUNT(DISTINCT c.customer_uid) AS total
      FROM customers c
      LEFT JOIN products p ON p.customer_uid = c.customer_uid
      ${where}
    `, values),
    query<CustomerRow>(`
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.country,
        c.plan_id,
        c.status,
        c.storage_used_mb,
        c.bandwidth_used_mb,
        c.created_at,
        u.last_login_at,
        COUNT(DISTINCT p.id) AS product_count,
        SUM(p.status = 'published') AS published_count,
        COALESCE((
          SELECT SUM(COALESCE(bi.total_paise, bp.amount_paise)) / 100
          FROM billing_payments bp
          LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
          WHERE bp.customer_uid = c.customer_uid AND bp.status = 'captured'
        ), 0) AS total_revenue
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN products p ON p.customer_uid = c.customer_uid
      ${where}
      GROUP BY c.customer_uid
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),
    query<any>(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'Active') AS active,
        SUM(status = 'Suspended') AS suspended,
        SUM(plan_id IN ('trial', 'free') OR plan_id IS NULL) AS trial,
        SUM(plan_id = 'enterprise') AS enterprise
      FROM customers
    `).catch(() => [{ total: 0, active: 0, suspended: 0, trial: 0, enterprise: 0 }]),
    query<{ country: string }>(`
      SELECT DISTINCT country
      FROM customers
      WHERE country IS NOT NULL AND country != ''
      ORDER BY country ASC
      LIMIT 100
    `).catch(() => []),
  ]);

  const mappedCustomers = rows.map((row) => ({
    ...row,
    storage_used_mb: Number(row.storage_used_mb || 0),
    bandwidth_used_mb: Number(row.bandwidth_used_mb || 0),
    product_count: Number(row.product_count || 0),
    published_count: Number(row.published_count || 0),
    total_revenue: Number(row.total_revenue || 0),
  }));

  const summaryRow = summaryRows[0] || {};
  const total = Number(summaryRow.total || 0) || 1;
  const filteredTotal = Number(countRows[0]?.total || 0);
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
    await query("UPDATE customers SET status = 'Suspended' WHERE customer_uid = ?", [customer_uid]);
    const { createCustomerNotification } = await import("@/lib/account/notify.service");
    await createCustomerNotification({
      customerUid: customer_uid,
      category: "system",
      title: "Account suspended",
      body: "Your AR360 account has been suspended. Contact support to restore access.",
      href: "/dashboard/support",
      dedupeKey: `account-suspended:${customer_uid}`,
    }).catch(() => {});
  } else if (action === "activate") {
    await query("UPDATE customers SET status = 'Active' WHERE customer_uid = ?", [customer_uid]);
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
    await setCustomerPlan({ customerUid: customer_uid, planId: plan_id, status: plan_id === "trial" ? "trialing" : "active" });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
