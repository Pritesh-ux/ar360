"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  CreditCard,
  Download,
  FileText,
  IndianRupee,
  Mail,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  X,
  XCircle,
  TrendingUp,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminAreaChart } from "@/components/features/master-admin/AdminSparkline";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import GenerateInvoiceModal from "@/components/features/master-admin/GenerateInvoiceModal";
import ManualPaymentModal from "@/components/features/master-admin/ManualPaymentModal";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import { useMasterAdminToast } from "@/components/features/master-admin/MasterAdminToastContext";
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminMetricCard,
  AdminPagination,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import "@/components/dashboard/dashboard-premium.css";
import {
  billingStatusClass,
  fmtDateShort,
  fmtMoneyInr,
} from "@/components/features/master-admin/billing-utils";

type InvoiceRow = {
  id: string;
  invoice: string;
  invoiceUid: string;
  customerUid: string;
  customer: string;
  email: string;
  plan: string;
  billing: string;
  amount: number;
  tax: number;
  total: number;
  date: string;
  status: "Paid" | "Pending" | "Failed" | "Refunded";
  gateway: string;
};

type Summary = {
  revenue: number;
  pending: number;
  paid: number;
  failed: number;
  refunds: number;
  totalCount: number;
};

type StatusBreakdown = {
  status: string;
  count: number;
  amount: number;
  percent: number;
};

const PAGE_SIZE = 10;
const planOptions = ["all", "trial", "basic", "professional", "enterprise"];
const statusOptions = ["all", "Paid", "Pending", "Failed", "Refunded"];

const statusColors: Record<string, string> = {
  Paid: "#10B981",
  Pending: "#F59E0B",
  Failed: "#EF4444",
  Refunded: "#8B5CF6",
};

function MiniLineChart({ rows, color = "#84D400" }: { rows: { label: string; value: number }[]; color?: string }) {
  return <AdminAreaChart rows={rows} color={color} className="mt-3 h-28 w-full" />;
}

function DonutChart({ items, total }: { items: { label: string; value: number; color: string }[]; total: number }) {
  const segments = items.map((item, index) => {
    const pct = total > 0 ? item.value / total : 0;
    const dash = `${pct * 100} ${100 - pct * 100}`;
    const offset = items.slice(0, index).reduce((sum, curr) => {
      const currPct = total > 0 ? curr.value / total : 0;
      return sum + currPct * 100;
    }, 0);
    return { ...item, dash, offset };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 36 36" className="h-24 w-24 shrink-0 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={seg.color}
            strokeWidth="3.5"
            strokeDasharray={seg.dash}
            strokeDashoffset={100 - seg.offset}
          />
        ))}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="font-semibold text-slate-600">{item.label}</span>
            </div>
            <span className="font-bold text-slate-800">
              {item.value.toLocaleString("en-IN")}{" "}
              <span className="font-semibold text-slate-400">
                ({total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultBillingDateRange(): DateRangeValue {
  return defaultDateRange("7d");
}

export default function BillingPage() {
  const { showToast } = useMasterAdminToast();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [revenueDaily, setRevenueDaily] = useState<{ label: string; value: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultBillingDateRange());
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRefund, setConfirmRefund] = useState<InvoiceRow | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  function notify(text: string, tone: "ok" | "err" = "ok") {
    setMessage(text);
    showToast(text, tone);
  }

  function isErrorMessage(text: string) {
    const lower = text.toLowerCase();
    return (
      lower.includes("fail") ||
      lower.includes("not available") ||
      lower.includes("missing") ||
      lower.includes("unable") ||
      lower.includes("select a") ||
      lower.includes("only paid") ||
      lower.includes("skipped")
    );
  }

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (plan !== "all") params.set("plan", plan);
    if (status !== "all") params.set("status", status);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

    try {
      const response = await fetch(`/api/master-admin/billing?${params}`, { cache: "no-store" });
      const data = await response.json();
      setInvoices(data.invoices || []);
      setSummary(data.summary || null);
      setStatusBreakdown(data.analytics?.statusBreakdown || []);
      setRevenueDaily(data.analytics?.revenueDaily || []);
      setRecentTransactions(data.recentTransactions || []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) notify(data.error, "err");
      setSelected(new Set());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to load billing data", "err");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    setPage(1);
  }, [search, plan, status, dateRange.from, dateRange.to, dateRange.preset]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, plan, status, dateRange.from, dateRange.to, dateRange.preset, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = invoices;

  function resetFilters() {
    setSearch("");
    setPlan("all");
    setStatus("all");
    setDateRange(defaultBillingDateRange());
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (plan !== "all") params.set("plan", plan);
    if (status !== "all") params.set("status", status);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
    window.open(`/api/master-admin/billing?${params}`, "_blank");
  }

  function downloadAllInvoices() {
    notify("Preparing ZIP of all invoice PDFs…");
    const anchor = document.createElement("a");
    anchor.href = "/api/master-admin/billing/invoices/download-all?limit=500";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      notify("Invoice ZIP download started. Check your downloads folder.");
    }, 800);
  }

  async function issueRefund(invoice: InvoiceRow) {
    setConfirmRefund(invoice);
    setRefundNote("");
  }

  async function confirmIssueRefund() {
    if (!confirmRefund) return;
    try {
      const res = await fetch(`/api/master-admin/payments/${confirmRefund.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: refundNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      setConfirmRefund(null);
      notify(data.message || "Refund processed.");
      await load(page);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Refund failed", "err");
    }
  }

  async function sendInvoice(invoice: InvoiceRow) {
    if (!invoice.invoiceUid) {
      notify("No invoice document is linked to this payment.", "err");
      return;
    }
    try {
      const res = await fetch(`/api/master-admin/billing/invoices/${invoice.invoiceUid}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      const text = data.message || `Invoice sent to ${invoice.email}.`;
      notify(text, data.delivered === false || isErrorMessage(text) ? "err" : "ok");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Send failed", "err");
    }
  }

  async function sendPaymentReminderForRow(paymentUid: string) {
    try {
      const res = await fetch("/api/master-admin/billing/payment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reminder failed");
      notify(data.message || "Payment reminder sent.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Reminder failed", "err");
    }
  }

  async function sendPaymentReminderForSelection() {
    const pending = pageItems.filter((row) => selected.has(row.id) && row.status === "Pending");
    const target = pending[0] || pageItems.find((row) => row.status === "Pending");
    if (!target) {
      notify("Select a pending payment to send a reminder.", "err");
      return;
    }
    try {
      const res = await fetch("/api/master-admin/billing/payment-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentUid: target.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reminder failed");
      notify(data.message || "Payment reminder sent.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Reminder failed", "err");
    }
  }

  function processRefundSelection() {
    const paidSelected = pageItems.filter((row) => selected.has(row.id) && row.status === "Paid");
    const target = paidSelected[0] || pageItems.find((row) => selected.has(row.id));
    if (!target) {
      notify("Select a paid payment row to refund.", "err");
      return;
    }
    if (target.status !== "Paid") {
      notify("Only paid payments can be refunded.", "err");
      return;
    }
    void issueRefund(target);
  }

  function handleQuickAction(label: string) {
    if (label === "Download Report") {
      exportCsv();
      return;
    }
    if (label === "Download All Invoices") {
      downloadAllInvoices();
      return;
    }
    if (label === "Generate Invoice") {
      setGenerateOpen(true);
      return;
    }
    if (label === "Send Payment Reminder") {
      void sendPaymentReminderForSelection();
      return;
    }
    if (label === "Add Manual Payment") {
      setManualOpen(true);
      return;
    }
    if (label === "Process Refund") {
      processRefundSelection();
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(pageItems.map((row) => row.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dateRangeLabel =
    dateRange.from && dateRange.to
      ? `${fmtDateShort(dateRange.from)} – ${fmtDateShort(dateRange.to)}`
      : "All time";

  const hasFilters = Boolean(search || plan !== "all" || status !== "all" || dateRange.preset !== "7d");

  const statCards = [
    {
      title: "Total Revenue",
      value: fmtMoneyInr(summary?.revenue ?? 0),
      note: dateRangeLabel,
      icon: IndianRupee,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Amount",
      value: fmtMoneyInr(summary?.pending ?? 0),
      note: `${summary?.totalCount ?? 0} transactions`,
      icon: RefreshCcw,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Paid Amount",
      value: fmtMoneyInr(summary?.paid ?? 0),
      note: "Captured payments",
      icon: TrendingUp,
      iconClassName: "bg-sky-50 text-sky-600",
    },
    {
      title: "Failed Payments",
      value: fmtMoneyInr(summary?.failed ?? 0),
      note: "Failed attempts",
      icon: XCircle,
      iconClassName: "bg-red-50 text-red-600",
    },
    {
      title: "Refunds Issued",
      value: fmtMoneyInr(summary?.refunds ?? 0),
      note: "Refunded total",
      icon: RotateCcw,
      iconClassName: "bg-violet-50 text-violet-600",
    },
  ];

  const donutItems = statusBreakdown.map((item) => ({
    label: item.status,
    value: item.count,
    color: statusColors[item.status] || "#94A3B8",
  }));
  const donutTotal = donutItems.reduce((sum, item) => sum + item.value, 0);

  const quickActions = [
    { label: "Generate Invoice", icon: FileText },
    { label: "Send Payment Reminder", icon: Send },
    { label: "Add Manual Payment", icon: CreditCard },
    { label: "Process Refund", icon: RotateCcw },
    { label: "Download All Invoices", icon: Download },
  ];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <AdminPageHeader
            title="Billing & Invoices"
            subtitle="Track all payments, invoices and refunds."
            actions={
              <>
                <button
                  type="button"
                  onClick={downloadAllInvoices}
                  className="dash-premium-btn-primary h-10 px-3 text-[12px]"
                >
                  <Download size={15} />
                  Download all invoices
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </>
            }
          />

          {message ? (
            <div
              className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
                isErrorMessage(message)
                  ? "border-[#FECACA] bg-[#FEF2F2]"
                  : "border-[#DCFCE7] bg-[#F0FDF4]"
              }`}
            >
              <p
                className={`text-[13px] font-semibold ${
                  isErrorMessage(message) ? "text-[#B91C1C]" : "text-[#166534]"
                }`}
              >
                {message}
              </p>
              <button
                type="button"
                onClick={() => setMessage("")}
                className="grid h-8 w-8 place-items-center rounded-[10px] hover:bg-white/70"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((card) => (
              <AdminMetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                note={card.note}
                iconComponent={card.icon}
                iconClassName={card.iconClassName}
                layout="compact"
              />
            ))}
          </section>

          <section className="dash-premium-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
              <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by invoice, customer, email..."
                  className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
                />
              </div>
              <UserFilterDropdown
                hideLabel
                compact
                className="w-[140px] shrink-0"
                label="Plan"
                menuTitle="Plan"
                value={plan}
                options={planOptions}
                onChange={setPlan}
                renderOption={(value) =>
                  value === "all" ? "All Plans" : value.charAt(0).toUpperCase() + value.slice(1)
                }
                renderValue={(value) =>
                  value === "all" ? "All Plans" : value.charAt(0).toUpperCase() + value.slice(1)
                }
              />
              <UserFilterDropdown
                hideLabel
                compact
                className="w-[138px] shrink-0"
                label="Status"
                menuTitle="Status"
                value={status}
                options={statusOptions}
                onChange={setStatus}
                renderOption={(value) => (value === "all" ? "All Status" : value)}
                renderValue={(value) => (value === "all" ? "All Status" : value)}
              />
              <UserDateRangePicker value={dateRange} onChange={setDateRange} />
              {hasFilters ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto inline-flex h-10 shrink-0 items-center rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-[13px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={pageItems.length > 0 && pageItems.every((row) => selected.has(row.id))}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                      />
                    </th>
                    <th className="px-3 py-3">Invoice</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Plan</th>
                    <th className="px-3 py-3">Amount</th>
                    <th className="px-3 py-3">Tax</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9}>
                        <AdminLoadingState label="Loading invoices..." />
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <AdminEmptyState title={`No invoices found for ${dateRangeLabel}.`} />
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((row) => (
                      <tr key={row.id} className={adminTableRowClass}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-[#111827]">{row.invoice}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <CustomerAvatar name={row.customer} seed={row.email} size="sm" />
                            <div className="min-w-0">
                              <Link
                                href={`/master-admin/customers/${row.customerUid}`}
                                className="truncate font-bold text-[#111827] transition hover:text-[#5AA700]"
                              >
                                {row.customer}
                              </Link>
                              <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{row.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <PlanBadge planId={row.plan || "basic"} />
                        </td>
                        <td className="px-3 py-3 font-bold text-[#111827]">{fmtMoneyInr(row.amount)}</td>
                        <td className="px-3 py-3 font-semibold text-[#6B7280]">{fmtMoneyInr(row.tax)}</td>
                        <td className="px-3 py-3 font-semibold text-[#374151]">{row.date}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${billingStatusClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`/api/master-admin/billing/invoices/${encodeURIComponent(row.invoiceUid || row.id)}/download?format=pdf`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download PDF"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            >
                              <FileText size={15} />
                            </a>
                            <a
                              href={`/api/master-admin/billing/invoices/${encodeURIComponent(row.invoiceUid || row.id)}/download`}
                              target="_blank"
                              rel="noreferrer"
                              title="View HTML"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            >
                              <Download size={15} />
                            </a>
                            {row.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => sendPaymentReminderForRow(row.id)}
                                title="Send payment reminder"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-amber-50 hover:text-amber-600"
                              >
                                <Send size={15} />
                              </button>
                            )}
                            {row.status === "Paid" && (
                              <button
                                type="button"
                                onClick={() => issueRefund(row)}
                                title="Refund"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-red-50 hover:text-red-600"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => sendInvoice(row)}
                              title="Send Invoice"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-sky-50 hover:text-sky-600"
                            >
                              <Mail size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-[#ECECEC] px-2">
              <AdminPagination
                page={page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#ECECEC] bg-white px-3 py-3 text-[11px] font-bold text-[#374151] transition hover:border-[#84D400]/60 hover:bg-[#FAFAFB]"
                >
                  <Icon size={14} className="text-[#5AA700]" />
                  {action.label}
                </button>
              );
            })}
          </section>
        </div>

        <aside className="w-full shrink-0 space-y-3 xl:w-[320px]">
          <div className="dash-premium-card p-4">
            <h3 className="text-[13px] font-black text-slate-900">Payment Status</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {summary?.totalCount?.toLocaleString("en-IN") ?? 0} total transactions
            </p>
            <div className="mt-4">
              <DonutChart items={donutItems} total={donutTotal} />
            </div>
          </div>

          <div className="dash-premium-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-black text-[#111827]">Revenue Overview</h3>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">This Month</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black text-slate-900">{fmtMoneyInr(summary?.revenue ?? 0)}</p>
                <p className="text-[10px] font-bold text-slate-400">Filtered range</p>
              </div>
            </div>
            <MiniLineChart rows={revenueDaily} />
          </div>

          <div className="dash-premium-card p-4">
            <h3 className="text-[13px] font-black text-[#111827]">Recent Transactions</h3>
            <div className="mt-3 space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-[12px] font-semibold text-slate-400">No recent transactions</p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-start justify-between gap-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-slate-800">{tx.invoice}</p>
                      {tx.customerUid ? (
                        <Link
                          href={`/master-admin/customers/${encodeURIComponent(tx.customerUid)}`}
                          className="truncate text-[11px] font-medium text-[#3D6600] hover:underline"
                        >
                          {tx.customer}
                        </Link>
                      ) : (
                        <p className="truncate text-[11px] font-medium text-slate-500">{tx.customer}</p>
                      )}
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${billingStatusClass(tx.status)}`}
                      >
                        {tx.status}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-black text-slate-900">{fmtMoneyInr(tx.total)}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{tx.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-[14px] border border-[#ECECEC] py-2.5 text-[12px] font-bold text-[#374151] transition hover:bg-[#FAFAFB]"
            >
              View All Transactions
            </button>
          </div>
        </aside>
      </div>

      <ConfirmModal
        open={!!confirmRefund}
        title={`Refund ${confirmRefund?.invoice || "invoice"}?`}
        description="This issues a refund for the selected payment. Add an optional note for the audit trail."
        confirmText="Issue refund"
        danger
        onCancel={() => setConfirmRefund(null)}
        onConfirm={() => void confirmIssueRefund()}
      >
        <textarea
          value={refundNote}
          onChange={(e) => setRefundNote(e.target.value)}
          placeholder="Refund note (optional)"
          rows={3}
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none"
        />
      </ConfirmModal>

      <GenerateInvoiceModal
        open={generateOpen}
        saving={false}
        onClose={() => setGenerateOpen(false)}
        onCreated={(invoiceUid) => {
          setGenerateOpen(false);
          notify(invoiceUid ? `Invoice ${invoiceUid} generated.` : "Invoice generated.");
          void load(page);
        }}
      />
      <ManualPaymentModal
        open={manualOpen}
        saving={false}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false);
          notify("Manual payment recorded.");
          void load(page);
        }}
      />
    </div>
  );
}
