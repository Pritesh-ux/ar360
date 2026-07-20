"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Ban,
  CreditCard,
  ExternalLink,
  KeyRound,
  LogIn,
  Trash2,
} from "lucide-react";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  fmtBandwidth,
  fmtDateShort,
  fmtDateTime,
  fmtRevenue,
  fmtStorage,
  planBandwidthLimitMb,
  planLabel,
  planStorageLimitMb,
  statusBadgeClass,
  timezoneFromCountry,
  usagePct,
} from "@/components/features/master-admin/customers-utils";

export type CustomerDetailPayload = {
  customer: {
    customer_uid: string;
    contact_name: string;
    company_name: string | null;
    email: string;
    phone: string | null;
    country: string | null;
    gstin: string | null;
    timezone: string | null;
    plan_id: string;
    status: string;
    storage_used_mb: number;
    bandwidth_used_mb: number;
    created_at: string;
    last_login_at: string | null;
    email_verified: boolean;
    two_factor_enabled: boolean;
    sub_status: string | null;
    billing_period: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    auto_renew: boolean;
  };
  stats: {
    products: number;
    variants: number;
    materials: number;
    published: number;
    arViews: number;
    qrScans: number;
    qrCodes: number;
    embedCodes: number;
    objectCaptureJobs: number;
    totalRevenue: number;
    renewalDays: number | null;
  };
  products: Array<{
    id: string;
    title: string;
    category: string | null;
    status: string;
    views: number;
    created_at: string;
    file_name?: string | null;
  }>;
  payments: Array<{
    payment_uid: string;
    invoice: string;
    total: number;
    status: string;
    created_at: string;
  }>;
  activity: Array<{ id: number | string; action: string; created_at: string }>;
  auditLogs: Array<{
    id: number;
    admin_name: string;
    action: string;
    created_at: string;
    ip: string;
    details: string;
  }>;
  addons: Array<{
    slug: string;
    name: string;
    description: string | null;
    monthly_price: number;
    yearly_price: number;
    active: boolean;
    license: {
      status: string;
      billing_type: string;
      activated_at: string;
      expires_at: string | null;
    } | null;
  }>;
  clientWorkspaces: {
    addonActive: boolean;
    clientCount: number;
    assignedProductCount: number;
    clients: Array<{
      client_uid: string;
      name: string;
      email: string | null;
      company_name: string | null;
      status: string;
      created_at: string;
      products: Array<{ id: string; title: string; status: string }>;
      qr_count: number;
      domain_count: number;
    }>;
    productClientLabel: Record<string, string>;
  };
};

const TABS = [
  "Overview",
  "Products",
  "Clients",
  "Subscription",
  "Storage",
  "Viewer Analytics",
  "QR",
  "Object Capture",
  "Activity",
  "Support",
  "Security",
] as const;

type TabId = (typeof TABS)[number];

function ProgressBar({ value, tone = "green" }: { value: number; tone?: "green" | "blue" }) {
  const bar = tone === "green" ? "bg-[#A6FF2E]" : "bg-sky-500";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export default function CustomerDetailView({
  data,
  busy = false,
  onSuspend,
  onActivate,
  onImpersonate,
  onResetPassword,
  onDelete,
  onGrantAddon,
  onRevokeAddon,
}: {
  data: CustomerDetailPayload;
  busy?: boolean;
  onSuspend?: () => void | Promise<void>;
  onActivate?: () => void | Promise<void>;
  onImpersonate?: () => void;
  onResetPassword?: () => void;
  onDelete?: () => void;
  onGrantAddon?: (slug: string) => void;
  onRevokeAddon?: (slug: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("Overview");
  const { customer, stats, products, payments, activity, auditLogs, addons, clientWorkspaces } =
    data;

  const storageLimit = planStorageLimitMb(customer.plan_id);
  const bandwidthLimit = planBandwidthLimitMb(customer.plan_id);
  const storagePct = usagePct(customer.storage_used_mb, storageLimit);
  const bandwidthPct = usagePct(customer.bandwidth_used_mb, bandwidthLimit);
  const lastLogin = fmtDateTime(customer.last_login_at);
  const timezone = customer.timezone || timezoneFromCountry(customer.country);

  const statCards = [
    { label: "Products", value: stats.products },
    { label: "Variants", value: stats.variants },
    { label: "Materials", value: stats.materials },
    {
      label: "Storage",
      value: fmtStorage(customer.storage_used_mb),
      sub: `${storagePct}% used`,
      progress: storagePct,
    },
    {
      label: "Bandwidth",
      value: fmtBandwidth(customer.bandwidth_used_mb),
      sub: `${bandwidthPct}% used`,
      progress: bandwidthPct,
      tone: "blue" as const,
    },
    { label: "AR Views", value: stats.arViews.toLocaleString("en-IN") },
    { label: "QR Scans", value: stats.qrScans.toLocaleString("en-IN") },
  ];

  return (
    <div className="master-admin-panel space-y-5 pb-10">
      <AdminPageHeader
        title={customer.contact_name}
        subtitle={`${customer.email} · ${customer.customer_uid}`}
        backHref="/master-admin/customers"
        backLabel="Back to Customers"
        breadcrumbs={[
          { label: "Customers", href: "/master-admin/customers" },
          { label: customer.contact_name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusBadgeClass(customer.status)}`}>
              {customer.status}
            </span>
            <PlanBadge planId={customer.plan_id} />
            <button
              type="button"
              disabled={busy}
              onClick={() => onImpersonate?.()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 disabled:opacity-50"
            >
              <LogIn size={14} />
              {busy ? "Opening..." : "Open as customer"}
            </button>
            <Link
              href={`/master-admin/customers/${customer.customer_uid}/billing`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
            >
              <CreditCard size={14} />
              Billing
            </Link>
          </div>
        }
      />

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {statCards.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
            <p className="mt-1 text-[22px] font-black leading-none text-slate-950">{item.value}</p>
            {"sub" in item && item.sub && (
              <p className="mt-1 text-[11px] font-semibold text-slate-400">{item.sub}</p>
            )}
            {"progress" in item && item.progress != null && (
              <div className="mt-3">
                <ProgressBar value={item.progress} tone={"tone" in item ? item.tone : "green"} />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Profile row */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-black text-slate-900">Customer Profile</h2>
          <div className="mt-4 flex items-start gap-4">
            <CustomerAvatar name={customer.contact_name} seed={customer.customer_uid} size="lg" />
            <div className="min-w-0 flex-1 space-y-2 text-[13px]">
              {[
                ["Name", customer.contact_name],
                ["Company", customer.company_name || "—"],
                ["Email", customer.email],
                ["Phone", customer.phone || "—"],
                ["Country", customer.country || "—"],
                ["Timezone", timezone],
                ["GST", customer.gstin || "—"],
                ["Customer Since", fmtDateShort(customer.created_at)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3 border-b border-slate-50 pb-2">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="max-w-[58%] truncate text-right font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-black text-slate-900">Subscription Details</h2>
          <div className="mt-4 space-y-2 text-[13px]">
            {[
              ["Plan", planLabel(customer.plan_id)],
              ["Billing Cycle", customer.billing_period || "Yearly"],
              ["Renewal", customer.current_period_end ? fmtDateShort(customer.current_period_end) : "—"],
              ["Payment Method", "Visa •••• 4242"],
              ["Auto Renew", customer.auto_renew ? "Enabled" : "Disabled"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between gap-3 border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-500">{label}</span>
                <span className="font-bold capitalize text-slate-800">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            <Link
              href={`/master-admin/customers/${customer.customer_uid}/billing`}
              className="flex w-full items-center justify-center rounded-xl bg-[#A6FF2E] py-2.5 text-[13px] font-black text-slate-900"
            >
              Upgrade Plan
            </Link>
            <button type="button" className="w-full rounded-xl border border-slate-200 py-2.5 text-[13px] font-bold text-slate-700">
              Downgrade Plan
            </button>
            <button type="button" className="w-full py-1 text-[12px] font-bold text-red-500">
              Cancel Subscription
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-black text-slate-900">Quick Actions</h2>
            <div className="mt-3 space-y-1">
              {[
                { label: "Open as customer", icon: LogIn, onClick: () => onImpersonate?.() },
                {
                  label: "Reset Password",
                  icon: KeyRound,
                  onClick: () => onResetPassword?.(),
                },
                {
                  label: "Billing / plan",
                  icon: CreditCard,
                  href: `/master-admin/customers/${customer.customer_uid}/billing`,
                },
                customer.status === "Active"
                  ? {
                      label: "Suspend",
                      icon: Ban,
                      onClick: () => void onSuspend?.(),
                    }
                  : {
                      label: "Activate",
                      icon: Ban,
                      onClick: () => void onActivate?.(),
                    },
                {
                  label: "Delete",
                  icon: Trash2,
                  onClick: () => onDelete?.(),
                  danger: true,
                },
              ].map((item) => {
                const Icon = item.icon;
                if ("href" in item && item.href) {
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Icon size={15} className="text-slate-400" />
                      {item.label}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={busy}
                    onClick={item.onClick}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-50 ${
                      "danger" in item && item.danger ? "text-red-600" : "text-slate-700"
                    }`}
                  >
                    <Icon size={15} className={"danger" in item && item.danger ? "text-red-400" : "text-slate-400"} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
            <h2 className="text-[14px] font-black text-slate-900">Account Summary</h2>
            <div className="mt-3 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Last Login</span>
                <span className="font-bold text-slate-800">
                  {lastLogin.date} · {lastLogin.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Total Revenue</span>
                <span className="font-bold text-slate-800">{fmtRevenue(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Renewal</span>
                <span className="font-bold text-slate-800">
                  {customer.current_period_end ? fmtDateShort(customer.current_period_end) : "—"}
                  {stats.renewalDays != null ? ` (${stats.renewalDays}d)` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium add-ons */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-black text-slate-900">Premium Add-ons</h2>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              Grant or revoke Client Management and Team Management for this customer without checkout.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(addons || []).map((addon) => (
            <div
              key={addon.slug}
              className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-black text-slate-900">{addon.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        addon.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {addon.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-slate-500">
                    {addon.description || "Premium module"}
                    {addon.slug === "client-management" && addon.active ? (
                      <>
                        {" "}
                        · {clientWorkspaces.clientCount} client workspace
                        {clientWorkspaces.clientCount === 1 ? "" : "s"}
                        {clientWorkspaces.assignedProductCount > 0
                          ? ` · ${clientWorkspaces.assignedProductCount} product(s) assigned to clients`
                          : ""}
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[11px] font-semibold text-slate-500">
                <p>
                  Catalog: ₹{addon.monthly_price}/mo · ₹{addon.yearly_price}/yr
                </p>
                {addon.license ? (
                  <p>
                    Billing: {addon.license.billing_type}
                    {addon.license.expires_at
                      ? ` · Expires ${fmtDateShort(addon.license.expires_at)}`
                      : " · No expiry"}
                  </p>
                ) : (
                  <p>Not granted yet.</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {addon.active ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRevokeAddon?.(addon.slug)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-[12px] font-bold text-red-600 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onGrantAddon?.(addon.slug)}
                    className="rounded-xl bg-[#A6FF2E] px-3 py-2 text-[12px] font-black text-slate-900 disabled:opacity-50"
                  >
                    Grant access
                  </button>
                )}
                {addon.slug === "client-management" && addon.active ? (
                  <button
                    type="button"
                    onClick={() => setTab("Clients")}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700"
                  >
                    View client workspaces
                  </button>
                ) : null}
                {addon.active ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onGrantAddon?.(addon.slug)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700 disabled:opacity-50"
                  >
                    Extend / re-grant
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {(addons || []).length === 0 ? (
            <p className="text-[13px] font-medium text-slate-400 md:col-span-2">
              No add-on modules configured. Seed Premium Add-ons in Master Admin first.
            </p>
          ) : null}
        </div>
      </section>

      {/* Tabs */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`shrink-0 rounded-t-lg px-3 py-2 text-[12px] font-bold transition ${
                tab === item
                  ? "border-b-2 border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "Overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[14px] font-black text-slate-900">Overview</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Published Models", value: stats.published },
                    { label: "QR Codes", value: stats.qrCodes },
                    { label: "Embed Codes", value: stats.embedCodes },
                    { label: "Object Capture Jobs", value: stats.objectCaptureJobs },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-[11px] font-semibold text-slate-500">{item.label}</p>
                      <p className="mt-1 text-[20px] font-black text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="text-[14px] font-black text-slate-900">Recent Activity</h3>
                  <div className="mt-3 space-y-3">
                    {activity.slice(0, 6).map((log) => (
                      <div key={log.id} className="flex gap-3">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#A6FF2E]" />
                        <div>
                          <p className="text-[13px] font-bold text-slate-800">{log.action}</p>
                          <p className="text-[11px] font-medium text-slate-400">
                            {fmtDateTime(log.created_at).date} · {fmtDateTime(log.created_at).time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && (
                      <p className="text-[13px] font-medium text-slate-400">No recent activity.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-[14px] font-black text-slate-900">Account Status</h3>
                  <div className="mt-3 space-y-2">
                    {[
                      { label: "Account Status", ok: customer.status === "Active" },
                      { label: "Email Verified", ok: customer.email_verified },
                      { label: "Phone Verified", ok: Boolean(customer.phone) },
                      { label: "2FA Enabled", ok: customer.two_factor_enabled },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[13px]"
                      >
                        <span className="font-semibold text-slate-600">{item.label}</span>
                        <span className={`font-bold ${item.ok ? "text-emerald-600" : "text-slate-400"}`}>
                          {item.ok ? "✓ Verified" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[14px] font-black text-slate-900">Audit Logs</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[12px]">
                    <thead className="text-[11px] font-bold uppercase text-slate-400">
                      <tr className="border-b border-slate-100">
                        <th className="p-2">Admin</th>
                        <th className="p-2">Action</th>
                        <th className="p-2">Date & Time</th>
                        <th className="p-2">IP Address</th>
                        <th className="p-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 5).map((log) => (
                        <tr key={log.id} className="border-b border-slate-50">
                          <td className="p-2 font-semibold text-slate-700">{log.admin_name}</td>
                          <td className="p-2 font-bold text-slate-800">{log.action}</td>
                          <td className="p-2 text-slate-500">
                            {fmtDateTime(log.created_at).date} {fmtDateTime(log.created_at).time}
                          </td>
                          <td className="p-2 text-slate-500">{log.ip || "—"}</td>
                          <td className="p-2 text-slate-600">{log.details || "—"}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400">
                            No audit logs yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "Products" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11px] font-bold uppercase text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="p-2">Product</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Views</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Client assignment</th>
                    <th className="p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="p-2">
                        <Link
                          href={`/master-admin/products/${encodeURIComponent(p.id)}`}
                          className="group inline-flex max-w-[280px] items-start gap-1.5 font-bold text-[#3D6600] hover:underline"
                          title="Open product in Products panel"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{p.title || p.file_name || p.id}</span>
                            {p.file_name && p.file_name !== p.title ? (
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-400">
                                {p.file_name}
                              </span>
                            ) : null}
                          </span>
                          <ExternalLink size={13} className="mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
                        </Link>
                      </td>
                      <td className="p-2 text-slate-600">{p.category || "—"}</td>
                      <td className="p-2">{p.views.toLocaleString("en-IN")}</td>
                      <td className="p-2 capitalize">{p.status}</td>
                      <td className="p-2">
                        {clientWorkspaces.productClientLabel[p.id] ? (
                          <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                            Client: {clientWorkspaces.productClientLabel[p.id]}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-400">Main library</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-500">{fmtDateShort(p.created_at)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No products yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Clients" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[12px] font-medium text-slate-600">
                <p>
                  <span className="font-black text-slate-900">Client Management license: </span>
                  {clientWorkspaces.addonActive ? (
                    <span className="font-bold text-emerald-700">Active</span>
                  ) : (
                    <span className="font-bold text-slate-500">Not active</span>
                  )}
                  {" · "}
                  {clientWorkspaces.clientCount} workspace
                  {clientWorkspaces.clientCount === 1 ? "" : "s"}
                  {" · "}
                  {clientWorkspaces.assignedProductCount} product
                  {clientWorkspaces.assignedProductCount === 1 ? "" : "s"} assigned to clients
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Purchases appear under Premium Add-ons and Master Admin → Add-ons licenses. This
                  tab shows how the customer uses CRM clients and which catalog products are
                  delivered per end-client.
                </p>
              </div>

              {clientWorkspaces.clients.length === 0 ? (
                <p className="text-[13px] text-slate-400">
                  {clientWorkspaces.addonActive
                    ? "License active but no client workspaces created yet."
                    : "No client workspaces. Grant Client Management or wait for self-service purchase."}
                </p>
              ) : (
                clientWorkspaces.clients.map((client) => (
                  <div
                    key={client.client_uid}
                    className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-50 pb-3">
                      <div>
                        <h3 className="text-[14px] font-black text-slate-900">{client.name}</h3>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {client.email || "No email"}
                          {client.company_name ? ` · ${client.company_name}` : ""}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{client.client_uid}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          client.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      QR linked: {client.qr_count} · Domains: {client.domain_count} · Created{" "}
                      {fmtDateShort(client.created_at)}
                    </p>
                    {client.products.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {client.products.map((prod) => (
                          <li
                            key={prod.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                          >
                            <Link
                              href={`/master-admin/products/${encodeURIComponent(prod.id)}`}
                              className="font-bold text-[#3D6600] hover:underline"
                            >
                              {prod.title}
                            </Link>
                            <span className="font-mono text-[10px] text-slate-400">{prod.id}</span>
                            <span className="capitalize text-slate-600">{prod.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[12px] text-slate-400">No products assigned yet.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "Subscription" && (
            <div className="space-y-3 text-[13px]">
              {payments.map((p) => (
                <div
                  key={p.payment_uid}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/master-admin/customers/${customer.customer_uid}/billing`}
                      className="font-bold text-[#3D6600] hover:underline"
                    >
                      {p.invoice}
                    </Link>
                    <p className="text-[11px] text-slate-500">{fmtDateShort(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{fmtRevenue(p.total)}</p>
                    <p className="text-[11px] font-semibold capitalize text-slate-500">{p.status}</p>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-[13px] text-slate-400">No subscription payments recorded.</p>
              )}
              <Link
                href={`/master-admin/customers/${customer.customer_uid}/billing`}
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#4D9A00]"
              >
                Manage subscription <ArrowUpRight size={14} />
              </Link>
            </div>
          )}

          {tab === "Storage" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-500">Storage Used</p>
                <p className="mt-1 text-[24px] font-black text-slate-900">
                  {fmtStorage(customer.storage_used_mb)} / {fmtStorage(storageLimit)}
                </p>
                <div className="mt-3">
                  <ProgressBar value={storagePct} />
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[12px] font-semibold text-slate-500">Bandwidth Used</p>
                <p className="mt-1 text-[24px] font-black text-slate-900">
                  {fmtBandwidth(customer.bandwidth_used_mb)} / {fmtBandwidth(bandwidthLimit)}
                </p>
                <div className="mt-3">
                  <ProgressBar value={bandwidthPct} tone="blue" />
                </div>
              </div>
            </div>
          )}

          {!["Overview", "Products", "Subscription", "Storage"].includes(tab) && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
              <p className="text-[14px] font-black text-slate-800">{tab}</p>
              <p className="mt-2 text-[13px] font-medium text-slate-500">
                Detailed {tab.toLowerCase()} analytics will be wired in the next phase.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
