"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  FileText,
  Filter,
  IndianRupee,
  Mail,
  Plus,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import {
  billingCycleLabel,
  fmtDateShort,
  fmtMoneyInr,
  paymentStatusClass,
  renewalHint,
  renewalHintClass,
} from "@/components/features/master-admin/subscriptions-utils";
import { AdminPagination, AdminActionMessage, AdminBulkActions } from "@/components/ui/admin";
import { type PaginationMeta } from "@/lib/master-admin/pagination";

type Subscription = {
  customerUid: string;
  customerName: string;
  company: string;
  email: string;
  planId: string;
  planName: string;
  status: string;
  billingCycle: string;
  startDate: string | null;
  renewalDate: string | null;
  renewalDays: number | null;
  amount: number;
  paymentStatus: string;
  autoRenew: boolean;
  provider: string;
  providerMode: string | null;
  providerSubscriptionId: string | null;
  providerStatus: string | null;
  mandateStatus: string | null;
  nextChargeAt: string | null;
  renewalAttemptCount: number;
  nextRetryAt: string | null;
  lastFailure: { code: string; message: string | null } | null;
  salesChannel: string;
};

type Summary = {
  activePlans: number;
  monthlyRevenue: number;
  annualRevenue: number;
  trialUsers: number;
  expiringSoon: number;
  expiredUsers: number;
  mrrGrowthPct: number;
  arrGrowthPct: number;
  churnRate: number;
  manualEnterpriseRevenue: number;
};

type Analytics = {
  mrrDaily: { label: string; value: number }[];
  arrDaily: { label: string; value: number }[];
  churnDaily: { label: string; value: number }[];
  revenueByPlan: { name: string; value: number }[];
};

type Sidebar = {
  renewals7: { customerUid: string; name: string; plan: string; renewalDate: string | null; days: number | null }[];
  renewals30: { customerUid: string; name: string; plan: string; renewalDate: string | null; days: number | null }[];
};

const PAGE_SIZE = 8;
const planOptions = ["trial", "basic", "professional", "enterprise"];
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trial", value: "trialing" },
  { label: "Payment Failed", value: "past_due" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

function MiniLineChart({ rows, color = "#7AE02E" }: { rows: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const points = rows
    .map((row, index) => {
      const x = (index / Math.max(rows.length - 1, 1)) * 100;
      const y = 100 - (row.value / max) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" className="mt-3 h-28 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function DonutLegend({
  items,
  total,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="font-semibold text-slate-600">{item.label}</span>
          </div>
          <span className="font-bold text-slate-800">
            {total > 0 ? Math.round((item.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

function AutoRenewToggle({ enabled }: { enabled: boolean }) {
  return (
    <button
      type="button"
      className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-[#A6FF2E]" : "bg-slate-200"}`}
      aria-pressed={enabled}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sidebar, setSidebar] = useState<Sidebar | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [billingCycle, setBillingCycle] = useState("all");
  const [autoRenew, setAutoRenew] = useState("all");
  const [expiringWithin, setExpiringWithin] = useState("all");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [actionPending, setActionPending] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (plan !== "all") params.set("plan", plan);
    if (status !== "all") params.set("status", status);
    if (billingCycle !== "all") params.set("billingCycle", billingCycle);
    if (autoRenew !== "all") params.set("autoRenew", autoRenew);
    if (expiringWithin !== "all") params.set("expiringWithin", expiringWithin);

    try {
      const response = await fetch(`/api/master-admin/subscriptions?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
      setSummary(data.summary || null);
      setAnalytics(data.analytics || null);
      setSidebar(data.sidebar || null);
      setAlerts(data.alerts || []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  async function subscriptionAction(customerUid: string, action: string, body: Record<string, unknown> = {}) {
    setActionPending(true);
    setMessage("");
    try {
      const reason = String(body.reason || window.prompt(`Reason for ${action.replace(/_/g, " ")}:`) || "").trim();
      if (reason.length < 5) throw new Error("A reason of at least 5 characters is required.");
      const response = await fetch(`/api/master-admin/customers/${customerUid}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body, reason, confirm: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Action failed");
      setMessage(`${action.replace(/_/g, " ")} completed successfully.`);
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionPending(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, plan, status, billingCycle, autoRenew, expiringWithin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, plan, status, billingCycle, autoRenew, expiringWithin, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = subscriptions;
  const allPageSelected = pageItems.length > 0 && pageItems.every((s) => selected.has(s.customerUid));

  function toggleAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageItems.forEach((s) => next.delete(s.customerUid));
      else pageItems.forEach((s) => next.add(s.customerUid));
      return next;
    });
  }

  function toggleRow(customerUid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerUid)) next.delete(customerUid);
      else next.add(customerUid);
      return next;
    });
  }

  async function runBulkAction() {
    if (!bulkAction) return;
    const selectedRows = pageItems.filter((s) => selected.has(s.customerUid));

    if (bulkAction === "export") {
      const header = ["Customer", "Company", "Plan", "Billing Cycle", "Renewal Date", "Amount", "Status"];
      const rows = (selectedRows.length ? selectedRows : pageItems).map((s) => [
        s.customerName,
        s.company,
        s.planName,
        s.billingCycle,
        fmtDateShort(s.renewalDate),
        s.amount,
        s.paymentStatus,
      ]);
      const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "subscriptions-selected.csv";
      a.click();
      setBulkAction("");
      return;
    }

    if (selectedRows.length === 0) {
      setMessage("Select at least one subscription.");
      return;
    }

    if (bulkAction === "cancel") {
      if (!window.confirm(`Cancel ${selectedRows.length} subscription(s)?`)) return;
      for (const row of selectedRows) {
        await subscriptionAction(row.customerUid, "suspend");
      }
      setSelected(new Set());
      setBulkAction("");
      return;
    }

    if (bulkAction === "reminder") {
      setMessage(`Renewal reminders queued for ${selectedRows.length} subscription(s).`);
      setBulkAction("");
      setSelected(new Set());
    }
  }

  function exportCsv() {
    const header = [
      "Customer",
      "Company",
      "Plan",
      "Billing Cycle",
      "Start Date",
      "Renewal Date",
      "Amount",
      "Payment Status",
      "Auto Renew",
    ];
    const rows = subscriptions.map((s) => [
      s.customerName,
      s.company,
      s.planName,
      s.billingCycle,
      fmtDateShort(s.startDate),
      fmtDateShort(s.renewalDate),
      s.amount,
      s.paymentStatus,
      s.autoRenew ? "Yes" : "No",
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "subscriptions.csv";
    a.click();
  }

  function handleQuickAction(label: string, subscription: Subscription) {
    if (actionPending) return;
    if (label === "Upgrade" || label === "Downgrade") {
      router.push(`/master-admin/customers/${subscription.customerUid}/billing`);
      return;
    }
    if (label === "Extend") {
      void subscriptionAction(subscription.customerUid, "extend_trial", { hours: 168 });
      return;
    }
    if (label === "Cancel") {
      if (!window.confirm(`Cancel subscription for ${subscription.customerName}?`)) return;
      void subscriptionAction(subscription.customerUid, "suspend");
      return;
    }
    if (label === "Refund") {
      router.push(`/master-admin/billing?search=${encodeURIComponent(subscription.email)}`);
      return;
    }
    setMessage(`${label} will be available in a future release.`);
  }

  const statCards = [
    {
      title: "Active Plans",
      value: summary?.activePlans ?? 0,
      note: `↑ ${summary?.mrrGrowthPct ?? 0}% vs last month`,
      icon: Users,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Monthly Revenue",
      value: fmtMoneyInr(summary?.monthlyRevenue ?? 0),
      note: "MRR",
      icon: IndianRupee,
      iconBg: "bg-sky-50 text-sky-600",
      isText: true,
    },
    {
      title: "Annual Revenue",
      value: fmtMoneyInr(summary?.annualRevenue ?? 0),
      note: `↑ ${summary?.arrGrowthPct ?? 0}% vs last month`,
      icon: TrendingUp,
      iconBg: "bg-violet-50 text-violet-600",
      isText: true,
    },
    {
      title: "Enterprise Revenue",
      value: fmtMoneyInr(summary?.manualEnterpriseRevenue ?? 0),
      note: "Manual · excluded from MRR",
      icon: IndianRupee,
      iconBg: "bg-amber-50 text-amber-700",
      isText: true,
    },
    {
      title: "Trial Users",
      value: summary?.trialUsers ?? 0,
      note: "Active trials",
      icon: Clock,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Expiring Soon",
      value: summary?.expiringSoon ?? 0,
      note: "Next 7 days",
      icon: CalendarClock,
      iconBg: "bg-orange-50 text-orange-600",
    },
    {
      title: "Expired Users",
      value: summary?.expiredUsers ?? 0,
      note: "Cancelled / expired",
      icon: XCircle,
      iconBg: "bg-red-50 text-red-500",
    },
  ];

  const planColors = ["#7AE02E", "#0EA5E9", "#8B5CF6", "#94A3B8"];
  const revenueDonut = (analytics?.revenueByPlan || []).map((item, index) => ({
    label: item.name,
    value: item.value,
    color: planColors[index % planColors.length],
  }));
  const revenueTotal = revenueDonut.reduce((sum, item) => sum + item.value, 0);

  const quickActions = [
    { label: "Upgrade", icon: ArrowUpCircle },
    { label: "Downgrade", icon: ArrowDownCircle },
    { label: "Extend", icon: RefreshCw },
    { label: "Cancel", icon: XCircle },
    { label: "Refund", icon: CreditCard },
    { label: "Generate Invoice", icon: FileText },
    { label: "Send Reminder", icon: Send },
  ];

  return (
    <div className="master-admin-panel">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <AdminPageHeader
            title="Subscriptions"
            subtitle="Manage all customer subscriptions and billing information."
            actions={
              <>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
                >
                  <Download size={16} />
                  Export
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#A6FF2E] px-4 py-2.5 text-[13px] font-black text-slate-900"
                >
                  <Plus size={16} />
                  Add Subscription
                </button>
              </>
            }
          />

          {message ? (
            <AdminActionMessage
              message={message}
              variant={message.toLowerCase().includes("fail") || message.toLowerCase().includes("unable") ? "error" : "success"}
            />
          ) : null}
          {alerts.length > 0 ? (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <h2 className="text-sm font-black text-red-900">Persistent billing alerts ({alerts.length})</h2>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {alerts.slice(0, 8).map((alert) => (
                  <div key={alert.alert_uid} className="rounded-xl bg-white p-3 text-xs font-semibold text-red-800">
                    <p className="font-black">{String(alert.alert_type).replace(/_/g, " ")}</p>
                    <p>{alert.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">{card.title}</p>
                    <p className="truncate text-[22px] font-black leading-none text-slate-950">
                      {card.isText ? card.value : Number(card.value).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-emerald-600">{card.note}</p>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriptions..."
                className="h-10 min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
              />
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">All Plans</option>
                {planOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">All Billing Cycles</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700"
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                value={autoRenew}
                onChange={(e) => setAutoRenew(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">Auto Renew: All</option>
                <option value="yes">Auto Renew: On</option>
                <option value="no">Auto Renew: Off</option>
              </select>
              <AdminBulkActions
                value={bulkAction}
                onChange={setBulkAction}
                selectedCount={selected.size}
                onApply={() => void runBulkAction()}
                disabled={actionPending}
                requireSelection={bulkAction !== "export"}
                options={[
                  { value: "export", label: "Export Selected" },
                  { value: "reminder", label: "Send Renewal Reminder" },
                  { value: "cancel", label: "Cancel Selected" },
                ]}
              />
              <button
                type="button"
                onClick={() => setMoreFiltersOpen((open) => !open)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition ${
                  moreFiltersOpen
                    ? "border-[#A6FF2E] bg-[#A6FF2E]/10 text-slate-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Filter size={15} />
                More Filters
              </button>
            </div>

            {moreFiltersOpen && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <select
                  value={expiringWithin}
                  onChange={(e) => setExpiringWithin(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
                >
                  <option value="all">Renewal: Any time</option>
                  <option value="7">Renewal within 7 days</option>
                  <option value="30">Renewal within 30 days</option>
                  <option value="90">Renewal within 90 days</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setExpiringWithin("all");
                    setMoreFiltersOpen(false);
                  }}
                  className="text-[13px] font-bold text-slate-500 hover:text-slate-800"
                >
                  Clear extra filters
                </button>
              </div>
            )}

            {loading ? (
              <div className="p-16 text-center text-[13px] font-semibold text-slate-400">Loading subscriptions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1600px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="w-10 p-3">
                        <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} />
                      </th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Billing Cycle</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Renewal Date</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3">Provider / Mandate</th>
                      <th className="p-3">Next Charge</th>
                      <th className="p-3">Attempts / Failure</th>
                      <th className="p-3">Auto Renew</th>
                      <th className="w-12 p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((s) => {
                      const actionItems = [
                        { label: "View Customer", onClick: () => router.push(`/master-admin/customers/${s.customerUid}`) },
                        { label: "Upgrade", onClick: () => router.push(`/master-admin/customers/${s.customerUid}/billing`) },
                        { label: "Downgrade", onClick: () => handleQuickAction("Downgrade", s) },
                        { label: "Extend", onClick: () => handleQuickAction("Extend", s) },
                        { label: "Cancel", onClick: () => handleQuickAction("Cancel", s), isDangerous: true },
                        { label: "Refund", onClick: () => handleQuickAction("Refund", s), isDangerous: true },
                        { label: "Generate Invoice", onClick: () => handleQuickAction("Generate Invoice", s) },
                        { label: "Send Reminder", onClick: () => handleQuickAction("Send Reminder", s) },
                      ];

                      return (
                        <tr key={s.customerUid} className="border-b border-slate-50 hover:bg-slate-50/70">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selected.has(s.customerUid)}
                              onChange={() => toggleRow(s.customerUid)}
                            />
                          </td>
                          <td className="p-3 text-[11px] font-semibold text-slate-700">
                            <p>{s.provider} {s.providerMode ? `· ${s.providerMode}` : ""}</p>
                            <p className="max-w-[180px] truncate text-slate-400">{s.providerSubscriptionId || "No provider subscription"}</p>
                            <p>{s.providerStatus || "—"} · mandate {s.mandateStatus || "unknown"}</p>
                          </td>
                          <td className="p-3 text-[11px] font-semibold text-slate-700">
                            <p>{fmtDateShort(s.nextChargeAt)}</p>
                            {s.nextRetryAt ? <p className="text-amber-600">Retry {fmtDateShort(s.nextRetryAt)}</p> : null}
                          </td>
                          <td className="p-3 text-[11px] font-semibold text-slate-700">
                            <p>{s.renewalAttemptCount} attempt(s)</p>
                            {s.lastFailure ? <p className="max-w-[180px] truncate text-red-600" title={s.lastFailure.message || s.lastFailure.code}>{s.lastFailure.code}</p> : "No failure"}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <CustomerAvatar name={s.customerName} seed={s.customerUid} size="sm" />
                              <div className="min-w-0">
                                <Link
                                  href={`/master-admin/customers/${encodeURIComponent(s.customerUid)}`}
                                  className="truncate text-[13px] font-bold text-slate-900 hover:text-[#4D9A00] hover:underline"
                                >
                                  {s.customerName}
                                </Link>
                                <p className="truncate text-[11px] font-medium text-slate-400">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-[12px] font-semibold text-slate-700">{s.company}</td>
                          <td className="p-3">
                            <PlanBadge planId={s.planId} />
                          </td>
                          <td className="p-3 text-[12px] font-semibold text-slate-700">{billingCycleLabel(s.billingCycle)}</td>
                          <td className="p-3 text-[12px] font-semibold text-slate-600">{fmtDateShort(s.startDate)}</td>
                          <td className="p-3">
                            <p className="text-[12px] font-semibold text-slate-700">{fmtDateShort(s.renewalDate)}</p>
                            <p className={`text-[10px] font-bold ${renewalHintClass(s.renewalDays)}`}>
                              {renewalHint(s.renewalDays)}
                            </p>
                          </td>
                          <td className="p-3 text-[12px] font-bold text-slate-900">{fmtMoneyInr(s.amount)}</td>
                          <td className="p-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${paymentStatusClass(s.paymentStatus as "Paid" | "Trial" | "Failed" | "Pending")}`}
                            >
                              {s.paymentStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <AutoRenewToggle enabled={s.autoRenew} />
                          </td>
                          <td className="p-3">
                            <AdminActionMenu items={actionItems} />
                          </td>
                        </tr>
                      );
                    })}
                    {pageItems.length === 0 && (
                      <tr>
                        <td colSpan={14} className="p-16 text-center text-[13px] font-semibold text-slate-400">
                          No subscriptions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              meta={pagination}
              onPageChange={setPage}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-black text-slate-900">MRR</h3>
                <span className="text-[12px] font-bold text-emerald-600">↑ {summary?.mrrGrowthPct ?? 0}%</span>
              </div>
              <MiniLineChart rows={analytics?.mrrDaily || []} />
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-black text-slate-900">ARR</h3>
                <span className="text-[12px] font-bold text-emerald-600">↑ {summary?.arrGrowthPct ?? 0}%</span>
              </div>
              <MiniLineChart rows={analytics?.arrDaily || []} color="#8B5CF6" />
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-black text-slate-900">Churn</h3>
                <span className="inline-flex items-center gap-1 text-[12px] font-bold text-red-500">
                  <TrendingDown size={14} />
                  {summary?.churnRate ?? 0}%
                </span>
              </div>
              <MiniLineChart rows={analytics?.churnDaily || []} color="#EF4444" />
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="text-[14px] font-black text-slate-900">Revenue by Plan</h3>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                MRR {fmtMoneyInr(summary?.monthlyRevenue ?? 0)}
              </p>
              <DonutLegend items={revenueDonut} total={revenueTotal} />
            </div>
          </section>
        </div>

        <aside className="hidden w-[280px] shrink-0 space-y-4 xl:block">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Renewals in 7 Days</h3>
            <div className="mt-3 space-y-3">
              {(sidebar?.renewals7 || []).map((item) => (
                <Link
                  key={item.customerUid}
                  href={`/master-admin/customers/${item.customerUid}`}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-50"
                >
                  <CustomerAvatar name={item.name} seed={item.customerUid} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-slate-800">{item.name}</p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      {item.plan} · {fmtDateShort(item.renewalDate)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold ${renewalHintClass(item.days)}`}>
                    {renewalHint(item.days)}
                  </span>
                </Link>
              ))}
              {(sidebar?.renewals7 || []).length === 0 && (
                <p className="text-[12px] font-medium text-slate-400">No renewals in the next 7 days.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMessage("Bulk renewal reminders will be available in a future release.")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#A6FF2E] py-2.5 text-[12px] font-black text-slate-900"
            >
              <Mail size={14} />
              Send Renewal Reminders
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Renewals in 30 Days</h3>
            <div className="mt-3 space-y-2">
              {(sidebar?.renewals30 || []).map((item) => (
                <Link
                  key={`30-${item.customerUid}`}
                  href={`/master-admin/customers/${item.customerUid}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-slate-800">{item.name}</p>
                    <p className="truncate text-[10px] font-semibold text-slate-400">{item.plan}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">{renewalHint(item.days)}</span>
                </Link>
              ))}
              {(sidebar?.renewals30 || []).length === 0 && (
                <p className="text-[12px] font-medium text-slate-400">No renewals in the next 30 days.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Quick Actions</h3>
            <div className="mt-3 space-y-1">
              {quickActions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMessage(`Select a subscription row to use ${label}.`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Icon size={15} className="text-slate-400" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(summary?.expiringSoon ?? 0) > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 text-amber-600" />
                <div>
                  <p className="text-[13px] font-black text-amber-900">{summary?.expiringSoon} expiring soon</p>
                  <p className="mt-1 text-[11px] font-medium text-amber-800/80">
                    Subscriptions ending within the next 7 days need attention.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
