import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMasterAdmin } from "@/lib/auth";
import { ensureAppSchema, query } from "@/lib/db";
import { listLedgerPayments } from "@/lib/billing/payment-ledger";
import { getCustomerAddonLicenses } from "@/lib/billing/addons";
import { getAdminClientWorkspacesSummary } from "@/lib/master-admin/client-workspaces";
import CustomerDetailClient from "./CustomerDetailClient";
import type { CustomerDetailPayload } from "@/components/features/master-admin/CustomerDetailView";
import { timezoneFromCountry } from "@/components/features/master-admin/customers-utils";

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function countJsonArray(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentMasterAdmin();
  if (!admin) redirect("/master-admin/login");

  await ensureAppSchema();
  const { id } = await params;

  const [
    customers,
    products,
    payments,
    activity,
    auditLogs,
    analytics,
    productMeta,
    qrCount,
    billingProfile,
    addonRows,
    clientWorkspaces,
  ] = await Promise.all([
    (async () => {
      const { ensurePhoneVerifiedColumn } = await import("@/lib/account/verification.service");
      await ensurePhoneVerifiedColumn();
      return query<any>(`
      SELECT c.customer_uid, c.contact_name, c.company_name, c.email, c.phone, c.phone_verified, c.country,
             c.plan_id, c.status, c.storage_used_mb, c.bandwidth_used_mb, c.created_at,
             u.last_login_at, u.email_verified, u.two_factor_enabled,
             s.status AS sub_status, s.trial_ends_at, s.trial_used, s.current_period_end,
             s.billing_period, s.cancelled_at
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
      WHERE c.customer_uid = ? LIMIT 1
    `, [id]);
    })(),

    query<any>(`
      SELECT id, title, category, status, views, created_at, variants, material_settings
      FROM products WHERE customer_uid = ?
      ORDER BY created_at DESC LIMIT 50
    `, [id]),

    listLedgerPayments({ customerUid: id, limit: 20 }).then((rows) =>
      rows.map((row) => ({
        payment_uid: row.id,
        invoice: row.invoice,
        total: row.total,
        status: row.status,
        created_at: String(row.date),
      })),
    ).catch(() => []),

    query<any>(`
      SELECT id, action, created_at
      FROM audit_logs WHERE customer_uid = ?
      ORDER BY created_at DESC LIMIT 20
    `, [id]).catch(() => []),

    query<any>(`
      SELECT id, action, created_at, ip_hash AS ip, resource_label AS details, actor_name AS admin_name
      FROM audit_logs WHERE customer_uid = ?
      ORDER BY created_at DESC LIMIT 10
    `, [id]).catch(() => []),

    query<any>(`
      SELECT
        COALESCE(SUM(a.ar_launches), 0) AS arViews,
        COALESCE(SUM(a.qr_scans), 0) AS qrScans
      FROM analytics_daily a
      INNER JOIN products p ON p.id = a.product_uid
      WHERE p.customer_uid = ?
    `, [id]).catch(() => [{ arViews: 0, qrScans: 0 }]),

    query<any>(`
      SELECT variants, material_settings, status FROM products WHERE customer_uid = ?
    `, [id]).catch(() => []),

    query<any>(`
      SELECT COUNT(*) AS total FROM product_qr_codes WHERE customer_uid = ?
    `, [id]).catch(() => [{ total: 0 }]),

    query<any>(`
      SELECT gstin FROM billing_profiles WHERE customer_uid = ? LIMIT 1
    `, [id]).catch(() => []),

    getCustomerAddonLicenses(id).catch(() => []),
    getAdminClientWorkspacesSummary(id).catch(() => ({
      addonActive: false,
      clientCount: 0,
      assignedProductCount: 0,
      clients: [],
      productClientLabel: {},
    })),
  ]);

  const customer = customers[0];
  if (!customer) {
    return (
      <div className="master-admin-panel">
        <Link href="/master-admin/customers" className="text-[13px] font-bold text-slate-600">
          ← Back to Customers
        </Link>
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-6 text-[13px] font-bold text-red-700">
          Customer not found.
        </div>
      </div>
    );
  }

  let variants = 0;
  let materials = 0;
  let published = 0;
  for (const row of productMeta) {
    variants += countJsonArray(row.variants);
    materials += countJsonArray(row.material_settings);
    if (String(row.status || "").toLowerCase() === "published") published += 1;
  }

  const paymentRows = payments as CustomerDetailPayload["payments"];
  const totalRevenue = paymentRows.reduce((sum, p) => sum + Number(p.total || 0), 0);

  const payload: CustomerDetailPayload = {
    customer: {
      customer_uid: customer.customer_uid,
      contact_name: customer.contact_name,
      company_name: customer.company_name,
      email: customer.email,
      phone: customer.phone,
      country: customer.country,
      gstin: billingProfile[0]?.gstin || null,
      timezone: timezoneFromCountry(customer.country),
      plan_id: customer.plan_id,
      status: customer.status,
      storage_used_mb: Number(customer.storage_used_mb || 0),
      bandwidth_used_mb: Number(customer.bandwidth_used_mb || 0),
      created_at: customer.created_at,
      last_login_at: customer.last_login_at,
      email_verified: Boolean(customer.email_verified),
      phone_verified: Boolean((customer as { phone_verified?: number | boolean }).phone_verified),
      two_factor_enabled: Boolean(customer.two_factor_enabled),
      sub_status: customer.sub_status,
      billing_period: customer.billing_period,
      current_period_end: customer.current_period_end,
      trial_ends_at: customer.trial_ends_at,
      auto_renew: !customer.cancelled_at,
    },
    stats: {
      products: products.length,
      variants,
      materials,
      published,
      arViews: Number(analytics[0]?.arViews || 0),
      qrScans: Number(analytics[0]?.qrScans || 0),
      qrCodes: Number(qrCount[0]?.total || 0),
      embedCodes: products.length,
      objectCaptureJobs: 0,
      totalRevenue,
      renewalDays: daysUntil(customer.current_period_end),
    },
    products: products.map((p: any) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      status: p.status,
      views: Number(p.views || 0),
      created_at: p.created_at,
    })),
    payments,
    activity: activity.map((row: any) => ({
      id: row.id,
      action: row.action,
      created_at: row.created_at,
    })),
    auditLogs: auditLogs.map((row: any) => ({
      id: row.id,
      admin_name: row.admin_name || "System",
      action: row.action,
      created_at: row.created_at,
      ip: row.ip,
      details: row.details,
    })),
    addons: (addonRows || []).map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      monthly_price: row.monthly_price,
      yearly_price: row.yearly_price,
      active: row.active,
      license: row.license
        ? {
            status: row.license.status,
            billing_type: row.license.billing_type,
            activated_at: row.license.activated_at,
            expires_at: row.license.expires_at,
          }
        : null,
    })),
    clientWorkspaces,
  };

  return <CustomerDetailClient data={payload} />;
}
