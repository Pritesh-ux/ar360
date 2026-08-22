"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Box,
  CreditCard,
  Eye,
  ExternalLink,
  HardDrive,
  KeyRound,
  Layers,
  LogIn,
  Package,
  QrCode,
  Trash2,
  Wifi,
} from "lucide-react";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
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
import "@/components/dashboard/dashboard-premium.css";

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
    phone_verified?: boolean;
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

function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-premium-card p-4 md:p-5 ${className}`}>{children}</div>;
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-[#111827]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{subtitle}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-2 last:border-0">
      <span className="text-[12px] font-semibold text-[#6B7280]">{label}</span>
      <span className="max-w-[60%] truncate text-right text-[13px] font-bold text-[#111827]">{value}</span>
    </div>
  );
}

function ProgressBar({ value, tone = "green" }: { value: number; tone?: "green" | "blue" }) {
  const bar = tone === "green" ? "bg-[#B6FF38]" : "bg-[#3B82F6]";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
      <div
        className={`dash-progress-bar h-full rounded-full ${bar}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
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

  const wiredTabs = new Set<TabId>(["Overview", "Products", "Clients", "Subscription", "Storage"]);

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/master-admin/customers"
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] transition hover:border-[#D4D4D4]"
        >
          <ArrowLeft size={14} />
          Back to Customers
        </Link>
        <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-[#9CA3AF]">
          <Link href="/master-admin/customers" className="hover:text-[#6B7280]">
            Customers
          </Link>
          <span>/</span>
          <span className="text-[#374151]">{customer.contact_name}</span>
        </nav>
      </div>

      <UserPageHeader
        title={customer.contact_name}
        subtitle={`${customer.email} · ${customer.customer_uid}`}
        highlighted
        leading={<CustomerAvatar name={customer.contact_name} seed={customer.customer_uid} size="lg" />}
        badge={
          <>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(customer.status)}`}
            >
              {customer.status}
            </span>
            <PlanBadge planId={customer.plan_id} />
          </>
        }
        actions={
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onImpersonate?.()}
              className="dash-premium-btn-primary h-10 px-3 text-[12px] disabled:opacity-50"
            >
              <LogIn size={14} />
              {busy ? "Opening..." : "Open as customer"}
            </button>
            <Link
              href={`/master-admin/customers/${customer.customer_uid}/billing`}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <CreditCard size={14} />
              Billing
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <UserMetricCard title="Products" value={String(stats.products)} icon={Package} accent="lime" compact />
        <UserMetricCard title="Variants" value={String(stats.variants)} icon={Layers} accent="violet" compact />
        <UserMetricCard title="Materials" value={String(stats.materials)} icon={Box} accent="amber" compact />
        <UserMetricCard
          title="Storage"
          value={fmtStorage(customer.storage_used_mb)}
          note={`${storagePct}% used`}
          icon={HardDrive}
          accent="mint"
          compact
          storagePercent={storagePct}
        />
        <UserMetricCard
          title="Bandwidth"
          value={fmtBandwidth(customer.bandwidth_used_mb)}
          note={`${bandwidthPct}% used`}
          icon={Wifi}
          accent="sky"
          compact
        />
        <UserMetricCard
          title="AR Views"
          value={stats.arViews.toLocaleString("en-IN")}
          icon={Eye}
          accent="emerald"
          compact
        />
        <UserMetricCard
          title="QR Scans"
          value={stats.qrScans.toLocaleString("en-IN")}
          icon={QrCode}
          accent="orange"
          compact
        />
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <PanelCard>
          <PanelTitle title="Customer Profile" subtitle="Account identity & contact" />
          <div className="space-y-0.5">
            <InfoRow label="Name" value={customer.contact_name} />
            <InfoRow label="Company" value={customer.company_name || "—"} />
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="Phone" value={customer.phone || "—"} />
            <InfoRow label="Country" value={customer.country || "—"} />
            <InfoRow label="Timezone" value={timezone} />
            <InfoRow label="GST" value={customer.gstin || "—"} />
            <InfoRow label="Customer Since" value={fmtDateShort(customer.created_at)} />
          </div>
        </PanelCard>

        <PanelCard>
          <PanelTitle title="Subscription Details" subtitle="Plan & renewal settings" />
          <div className="space-y-0.5">
            <InfoRow label="Plan" value={planLabel(customer.plan_id)} />
            <InfoRow label="Billing Cycle" value={customer.billing_period || "Yearly"} />
            <InfoRow
              label="Renewal"
              value={customer.current_period_end ? fmtDateShort(customer.current_period_end) : "—"}
            />
            <InfoRow label="Payment Method" value="Visa •••• 4242" />
            <InfoRow label="Auto Renew" value={customer.auto_renew ? "Enabled" : "Disabled"} />
          </div>
          <div className="mt-4 space-y-2">
            <Link
              href={`/master-admin/customers/${customer.customer_uid}/billing`}
              className="dash-premium-btn-primary h-10 w-full text-[12px]"
            >
              Upgrade Plan
            </Link>
            <button type="button" className="dash-premium-btn-secondary h-10 w-full text-[12px]">
              Downgrade Plan
            </button>
            <button
              type="button"
              className="w-full py-1.5 text-[12px] font-semibold text-[#EF4444] transition hover:text-[#DC2626]"
            >
              Cancel Subscription
            </button>
          </div>
        </PanelCard>

        <div className="space-y-3">
          <PanelCard>
            <PanelTitle title="Quick Actions" />
            <div className="space-y-1">
              {[
                { label: "Open as customer", icon: LogIn, onClick: () => onImpersonate?.() },
                { label: "Reset Password", icon: KeyRound, onClick: () => onResetPassword?.() },
                {
                  label: "Billing / plan",
                  icon: CreditCard,
                  href: `/master-admin/customers/${customer.customer_uid}/billing`,
                },
                customer.status === "Active"
                  ? { label: "Suspend", icon: Ban, onClick: () => void onSuspend?.() }
                  : { label: "Activate", icon: Ban, onClick: () => void onActivate?.() },
                { label: "Delete", icon: Trash2, onClick: () => onDelete?.(), danger: true },
              ].map((item) => {
                const Icon = item.icon;
                const className = `dash-activity-row flex w-full items-center gap-2.5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-left text-[13px] font-semibold disabled:opacity-50 ${
                  "danger" in item && item.danger ? "text-[#EF4444]" : "text-[#111827]"
                }`;
                if ("href" in item && item.href) {
                  return (
                    <Link key={item.label} href={item.href} className={className}>
                      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm">
                        <Icon size={15} className="text-[#6B7280]" />
                      </span>
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
                    className={className}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm ${
                        "danger" in item && item.danger ? "text-[#EF4444]" : "text-[#6B7280]"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </PanelCard>

          <PanelCard className="bg-[#FAFAFB]">
            <PanelTitle title="Account Summary" />
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-[#6B7280]">Last Login</span>
                <span className="font-bold text-[#111827]">
                  {lastLogin.date} · {lastLogin.time}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-[#6B7280]">Total Revenue</span>
                <span className="font-bold text-[#111827]">{fmtRevenue(stats.totalRevenue)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-[#6B7280]">Renewal</span>
                <span className="font-bold text-[#111827]">
                  {customer.current_period_end ? fmtDateShort(customer.current_period_end) : "—"}
                  {stats.renewalDays != null ? ` (${stats.renewalDays}d)` : ""}
                </span>
              </div>
            </div>
          </PanelCard>
        </div>
      </section>

      <PanelCard>
        <PanelTitle
          title="Premium Add-ons"
          subtitle="Grant or revoke Client Management and Team Management without checkout."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {(addons || []).map((addon) => (
            <div
              key={addon.slug}
              className="flex flex-col rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#111827]">{addon.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    addon.active ? "bg-emerald-100 text-emerald-700" : "bg-[#E5E7EB] text-[#4B5563]"
                  }`}
                >
                  {addon.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#6B7280]">
                {addon.description || "Premium module"}
                {addon.slug === "client-management" && addon.active ? (
                  <>
                    {" "}
                    · {clientWorkspaces.clientCount} client workspace
                    {clientWorkspaces.clientCount === 1 ? "" : "s"}
                    {clientWorkspaces.assignedProductCount > 0
                      ? ` · ${clientWorkspaces.assignedProductCount} product(s) assigned`
                      : ""}
                  </>
                ) : null}
              </p>
              <div className="mt-3 space-y-1 text-[11px] font-semibold text-[#6B7280]">
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
                    className="inline-flex h-9 items-center rounded-[12px] border border-red-200 bg-white px-3 text-[12px] font-bold text-[#EF4444] disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onGrantAddon?.(addon.slug)}
                    className="dash-premium-btn-primary h-9 px-3 text-[12px] disabled:opacity-50"
                  >
                    Grant access
                  </button>
                )}
                {addon.slug === "client-management" && addon.active ? (
                  <button
                    type="button"
                    onClick={() => setTab("Clients")}
                    className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
                  >
                    View client workspaces
                  </button>
                ) : null}
                {addon.active ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onGrantAddon?.(addon.slug)}
                    className="dash-premium-btn-secondary h-9 px-3 text-[12px] disabled:opacity-50"
                  >
                    Extend / re-grant
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {(addons || []).length === 0 ? (
            <p className="text-[13px] font-medium text-[#9CA3AF] md:col-span-2">
              No add-on modules configured. Seed Premium Add-ons in Master Admin first.
            </p>
          ) : null}
        </div>
      </PanelCard>

      <section className="dash-premium-card overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#ECECEC] px-2 pt-1">
          {TABS.map((item) => {
            const active = tab === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`relative shrink-0 px-4 py-3.5 text-[13px] font-semibold transition ${
                  active ? "text-[#84D400]" : "text-[#737373] hover:text-[#111111]"
                }`}
              >
                {item}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#84D400]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-5">
          {tab === "Overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Overview</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Published Models", value: stats.published },
                    { label: "QR Codes", value: stats.qrCodes },
                    { label: "Embed Codes", value: stats.embedCodes },
                    { label: "Object Capture Jobs", value: stats.objectCaptureJobs },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] p-3"
                    >
                      <p className="text-[11px] font-semibold text-[#6B7280]">{item.label}</p>
                      <p className="mt-1 text-[20px] font-bold text-[#111827]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="text-[14px] font-bold text-[#111827]">Recent Activity</h3>
                  <div className="mt-3 space-y-1.5">
                    {activity.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        className="dash-activity-row flex gap-3 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5"
                      >
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#B6FF38]" />
                        <div>
                          <p className="text-[13px] font-bold text-[#111827]">{log.action}</p>
                          <p className="text-[11px] font-medium text-[#9CA3AF]">
                            {fmtDateTime(log.created_at).date} · {fmtDateTime(log.created_at).time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {activity.length === 0 && (
                      <p className="text-[13px] font-medium text-[#9CA3AF]">No recent activity.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-[14px] font-bold text-[#111827]">Account Status</h3>
                  <div className="mt-3 space-y-1.5">
                    {[
                      {
                        label: "Account Status",
                        ok: customer.status === "Active",
                        okText: "Active",
                        pendingText: "Suspended",
                      },
                      {
                        label: "Email Verified",
                        ok: customer.email_verified,
                        okText: "Verified",
                        pendingText: "Pending",
                      },
                      {
                        label: "Phone Verified",
                        ok: Boolean(customer.phone_verified),
                        okText: "Verified",
                        pendingText: "Pending",
                      },
                      {
                        label: "2FA Enabled",
                        ok: customer.two_factor_enabled,
                        okText: "Enabled",
                        pendingText: "Pending",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5 text-[13px]"
                      >
                        <span className="font-semibold text-[#6B7280]">{item.label}</span>
                        <span className={`font-bold ${item.ok ? "text-[#22C55E]" : "text-[#9CA3AF]"}`}>
                          {item.ok ? `✓ ${item.okText}` : item.pendingText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[14px] font-bold text-[#111827]">Audit Logs</h3>
                <div className="mt-3 overflow-x-auto rounded-[14px] border border-[#ECECEC]">
                  <table className="w-full min-w-[720px] text-left text-[12px]">
                    <thead className="bg-[#FAFAFB] text-[11px] font-bold uppercase text-[#9CA3AF]">
                      <tr className="border-b border-[#ECECEC]">
                        <th className="p-3">Admin</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3">IP Address</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 5).map((log) => (
                        <tr key={log.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                          <td className="p-3 font-semibold text-[#374151]">{log.admin_name}</td>
                          <td className="p-3 font-bold text-[#111827]">{log.action}</td>
                          <td className="p-3 text-[#6B7280]">
                            {fmtDateTime(log.created_at).date} {fmtDateTime(log.created_at).time}
                          </td>
                          <td className="p-3 text-[#6B7280]">{log.ip || "—"}</td>
                          <td className="p-3 text-[#4B5563]">{log.details || "—"}</td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-[#9CA3AF]">
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
            <div className="overflow-x-auto rounded-[14px] border border-[#ECECEC]">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="bg-[#FAFAFB] text-[11px] font-bold uppercase text-[#9CA3AF]">
                  <tr className="border-b border-[#ECECEC]">
                    <th className="p-3">Product</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Views</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Client assignment</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="p-3">
                        <Link
                          href={`/master-admin/products/${encodeURIComponent(p.id)}`}
                          className="group inline-flex max-w-[280px] items-start gap-1.5 font-bold text-[#3D6600] hover:underline"
                          title="Open product in Products panel"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{p.title || p.file_name || p.id}</span>
                            {p.file_name && p.file_name !== p.title ? (
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#9CA3AF]">
                                {p.file_name}
                              </span>
                            ) : null}
                          </span>
                          <ExternalLink size={13} className="mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
                        </Link>
                      </td>
                      <td className="p-3 text-[#4B5563]">{p.category || "—"}</td>
                      <td className="p-3 font-semibold">{p.views.toLocaleString("en-IN")}</td>
                      <td className="p-3 capitalize">{p.status}</td>
                      <td className="p-3">
                        {clientWorkspaces.productClientLabel[p.id] ? (
                          <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                            Client: {clientWorkspaces.productClientLabel[p.id]}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#9CA3AF]">Main library</span>
                        )}
                      </td>
                      <td className="p-3 text-[#6B7280]">{fmtDateShort(p.created_at)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#9CA3AF]">
                        No products yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Clients" && (
            <div className="space-y-3">
              <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-4 py-3 text-[12px] font-medium text-[#4B5563]">
                <p>
                  <span className="font-bold text-[#111827]">Client Management license: </span>
                  {clientWorkspaces.addonActive ? (
                    <span className="font-bold text-[#22C55E]">Active</span>
                  ) : (
                    <span className="font-bold text-[#6B7280]">Not active</span>
                  )}
                  {" · "}
                  {clientWorkspaces.clientCount} workspace
                  {clientWorkspaces.clientCount === 1 ? "" : "s"}
                  {" · "}
                  {clientWorkspaces.assignedProductCount} product
                  {clientWorkspaces.assignedProductCount === 1 ? "" : "s"} assigned to clients
                </p>
              </div>

              {clientWorkspaces.clients.length === 0 ? (
                <p className="text-[13px] text-[#9CA3AF]">
                  {clientWorkspaces.addonActive
                    ? "License active but no client workspaces created yet."
                    : "No client workspaces. Grant Client Management or wait for self-service purchase."}
                </p>
              ) : (
                clientWorkspaces.clients.map((client) => (
                  <div
                    key={client.client_uid}
                    className="rounded-[16px] border border-[#ECECEC] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#F3F4F6] pb-3">
                      <div>
                        <h3 className="text-[14px] font-bold text-[#111827]">{client.name}</h3>
                        <p className="text-[11px] font-semibold text-[#6B7280]">
                          {client.email || "No email"}
                          {client.company_name ? ` · ${client.company_name}` : ""}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{client.client_uid}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          client.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-[#E5E7EB] text-[#4B5563]"
                        }`}
                      >
                        {client.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-[#6B7280]">
                      QR linked: {client.qr_count} · Domains: {client.domain_count} · Created{" "}
                      {fmtDateShort(client.created_at)}
                    </p>
                    {client.products.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {client.products.map((prod) => (
                          <li
                            key={prod.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#FAFAFB] px-3 py-2 text-[12px]"
                          >
                            <Link
                              href={`/master-admin/products/${encodeURIComponent(prod.id)}`}
                              className="font-bold text-[#3D6600] hover:underline"
                            >
                              {prod.title}
                            </Link>
                            <span className="font-mono text-[10px] text-[#9CA3AF]">{prod.id}</span>
                            <span className="capitalize text-[#4B5563]">{prod.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-[12px] text-[#9CA3AF]">No products assigned yet.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "Subscription" && (
            <div className="space-y-2 text-[13px]">
              {payments.map((p) => (
                <div
                  key={p.payment_uid}
                  className="dash-activity-row flex items-center justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/master-admin/customers/${customer.customer_uid}/billing`}
                      className="font-bold text-[#3D6600] hover:underline"
                    >
                      {p.invoice}
                    </Link>
                    <p className="text-[11px] text-[#6B7280]">{fmtDateShort(p.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#111827]">{fmtRevenue(p.total)}</p>
                    <p className="text-[11px] font-semibold capitalize text-[#6B7280]">{p.status}</p>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-[13px] text-[#9CA3AF]">No subscription payments recorded.</p>
              )}
              <Link
                href={`/master-admin/customers/${customer.customer_uid}/billing`}
                className="inline-flex items-center gap-1 pt-2 text-[12px] font-bold text-[#5AA700]"
              >
                Manage subscription <ArrowUpRight size={14} />
              </Link>
            </div>
          )}

          {tab === "Storage" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
                <p className="text-[12px] font-semibold text-[#6B7280]">Storage Used</p>
                <p className="mt-1 text-[24px] font-bold text-[#111827]">
                  {fmtStorage(customer.storage_used_mb)} / {fmtStorage(storageLimit)}
                </p>
                <div className="mt-3">
                  <ProgressBar value={storagePct} />
                </div>
              </div>
              <div className="rounded-[16px] border border-[#ECECEC] bg-[#FAFAFB] p-4">
                <p className="text-[12px] font-semibold text-[#6B7280]">Bandwidth Used</p>
                <p className="mt-1 text-[24px] font-bold text-[#111827]">
                  {fmtBandwidth(customer.bandwidth_used_mb)} / {fmtBandwidth(bandwidthLimit)}
                </p>
                <div className="mt-3">
                  <ProgressBar value={bandwidthPct} tone="blue" />
                </div>
              </div>
            </div>
          )}

          {!wiredTabs.has(tab) && (
            <div className="rounded-[16px] border border-dashed border-[#ECECEC] bg-[#FAFAFB] p-10 text-center">
              <p className="text-[14px] font-bold text-[#111827]">{tab}</p>
              <p className="mt-2 text-[13px] font-medium text-[#6B7280]">
                Detailed {tab.toLowerCase()} analytics will be wired in the next phase.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
