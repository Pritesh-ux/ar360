"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  Filter,
  IndianRupee,
  Mail,
  RefreshCcw,
  RotateCcw,
  Send,
  XCircle,
  TrendingUp,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import GenerateInvoiceModal from "@/components/features/master-admin/GenerateInvoiceModal";
import ManualPaymentModal from "@/components/features/master-admin/ManualPaymentModal";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
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
const planOptions = ["trial", "basic", "professional", "enterprise"];
const statusOptions = ["all", "Paid", "Pending", "Failed", "Refunded"];

const statusColors: Record<string, string> = {
  Paid: "#10B981",
  Pending: "#F59E0B",
  Failed: "#EF4444",
  Refunded: "#8B5CF6",
};

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

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function BillingPage() {
  const initialRange = defaultDateRange();
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
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRefund, setConfirmRefund] = useState<InvoiceRow | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (plan !== "all") params.set("plan", plan);
    if (status !== "all") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

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
      if (data.error) setMessage(data.error);
      setSelected(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, plan, status, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, plan, status, dateFrom, dateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = invoices;

  function resetFilters() {
    setSearch("");
    setPlan("all");
    setStatus("all");
    const range = defaultDateRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (plan !== "all") params.set("plan", plan);
    if (status !== "all") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/master-admin/billing?${params}`, "_blank");
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
      setMessage(data.message || "Refund processed.");
      await load(page);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refund failed");
    }
  }

  async function sendInvoice(invoice: InvoiceRow) {
    if (!invoice.invoiceUid) {
      setMessage("No invoice document is linked to this payment.");
      return;
    }
    try {
      const res = await fetch(`/api/master-admin/billing/invoices/${invoice.invoiceUid}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setMessage(data.message || `Invoice sent to ${invoice.email}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Send failed");
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
      setMessage(data.message || "Payment reminder sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reminder failed");
    }
  }

  async function sendPaymentReminderForSelection() {
    const pending = pageItems.filter((row) => selected.has(row.id) && row.status === "Pending");
    const target = pending[0] || pageItems.find((row) => row.status === "Pending");
    if (!target) {
      setMessage("Select a pending payment to send a reminder.");
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
      setMessage(data.message || "Payment reminder sent.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reminder failed");
    }
  }

  function processRefundSelection() {
    const paidSelected = pageItems.filter((row) => selected.has(row.id) && row.status === "Paid");
    const target = paidSelected[0] || pageItems.find((row) => selected.has(row.id));
    if (!target) {
      setMessage("Select a paid payment row to refund.");
      return;
    }
    if (target.status !== "Paid") {
      setMessage("Only paid payments can be refunded.");
      return;
    }
    void issueRefund(target);
  }

  function handleQuickAction(label: string) {
    if (label === "Download Report") {
      exportCsv();
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

  const dateRangeLabel = `${fmtDateShort(dateFrom)} – ${fmtDateShort(dateTo)}`;

  const statCards = [
    {
      title: "Total Revenue",
      value: fmtMoneyInr(summary?.revenue ?? 0),
      subtitle: dateRangeLabel,
      color: "#10B981",
      icon: IndianRupee,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Amount",
      value: fmtMoneyInr(summary?.pending ?? 0),
      subtitle: `${summary?.totalCount ?? 0} transactions`,
      color: "#F59E0B",
      icon: RefreshCcw,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Paid Amount",
      value: fmtMoneyInr(summary?.paid ?? 0),
      subtitle: "Captured payments",
      color: "#10B981",
      icon: TrendingUp,
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      title: "Failed Payments",
      value: fmtMoneyInr(summary?.failed ?? 0),
      subtitle: "Failed attempts",
      color: "#EF4444",
      icon: XCircle,
      iconBg: "bg-red-50 text-red-600",
    },
    {
      title: "Refunds Issued",
      value: fmtMoneyInr(summary?.refunds ?? 0),
      subtitle: "Refunded total",
      color: "#8B5CF6",
      icon: RotateCcw,
      iconBg: "bg-violet-50 text-violet-600",
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
    { label: "Download Report", icon: Download },
  ];

  return (
    <div className="master-admin-panel">
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <AdminPageHeader
            title="Billing & Invoices"
            subtitle="Track all payments, invoices and refunds."
            actions={
              <>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600">
                  <Calendar size={14} className="text-slate-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border-none bg-transparent outline-none"
                  />
                  <span className="text-slate-300">–</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border-none bg-transparent outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
                >
                  <Download size={16} />
                  Export
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
              </>
            }
          />

          {message ? (
            <AdminActionMessage
              message={message}
              variant={
                message.toLowerCase().includes("fail") || message.toLowerCase().includes("not available")
                  ? "error"
                  : "success"
              }
            />
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                      <Icon size={16} />
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">{card.title}</p>
                  <p className="mt-0.5 text-[20px] font-black leading-none text-slate-950">{card.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{card.subtitle}</p>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice, customer, email..."
                className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
              />
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                <option value="all">All Plans</option>
                {planOptions.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Status" : s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700"
              >
                <Filter size={14} />
                Filters
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600"
              >
                Reset
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={pageItems.length > 0 && pageItems.every((row) => selected.has(row.id))}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Tax</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center font-semibold text-slate-400">
                        Loading invoices...
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center font-semibold text-slate-400">
                        No invoices found for {dateRangeLabel}.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{row.invoice}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <CustomerAvatar name={row.customer} seed={row.email} size="sm" />
                            <div className="min-w-0">
                              <Link
                                href={`/master-admin/customers/${row.customerUid}`}
                                className="truncate font-bold text-slate-900 hover:text-[#4D9A00]"
                              >
                                {row.customer}
                              </Link>
                              <p className="truncate text-[11px] font-medium text-slate-400">{row.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PlanBadge planId={row.plan || "basic"} />
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">{fmtMoneyInr(row.amount)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{fmtMoneyInr(row.tax)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{row.date}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${billingStatusClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`/api/master-admin/billing/invoices/${row.invoiceUid}/download?format=pdf`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download PDF"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <FileText size={15} />
                            </a>
                            <a
                              href={`/api/master-admin/billing/invoices/${row.invoiceUid}/download`}
                              target="_blank"
                              rel="noreferrer"
                              title="View HTML"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Download size={15} />
                            </a>
                            {row.status === "Pending" && (
                              <button
                                type="button"
                                onClick={() => sendPaymentReminderForRow(row.id)}
                                title="Send payment reminder"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                              >
                                <Send size={15} />
                              </button>
                            )}
                            {row.status === "Paid" && (
                              <button
                                type="button"
                                onClick={() => issueRefund(row)}
                                title="Refund"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => sendInvoice(row)}
                              title="Send Invoice"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-sky-50 hover:text-sky-600"
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

            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] font-bold text-slate-700 transition hover:border-[#A6FF2E]/60 hover:bg-[#A6FF2E]/5"
                >
                  <Icon size={14} className="text-[#4D9A00]" />
                  {action.label}
                </button>
              );
            })}
          </section>
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[320px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Payment Status</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {summary?.totalCount?.toLocaleString("en-IN") ?? 0} total transactions
            </p>
            <div className="mt-4">
              <DonutChart items={donutItems} total={donutTotal} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-black text-slate-900">Revenue Overview</h3>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">This Month</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black text-slate-900">{fmtMoneyInr(summary?.revenue ?? 0)}</p>
                <p className="text-[10px] font-bold text-slate-400">Filtered range</p>
              </div>
            </div>
            <MiniLineChart rows={revenueDaily} />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-[13px] font-black text-slate-900">Recent Transactions</h3>
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
              className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
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
        saving={saving}
        onClose={() => setGenerateOpen(false)}
        onCreated={(invoiceUid) => {
          setGenerateOpen(false);
          setMessage(invoiceUid ? `Invoice ${invoiceUid} generated.` : "Invoice generated.");
          void load(page);
        }}
      />
      <ManualPaymentModal
        open={manualOpen}
        saving={saving}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false);
          setMessage("Manual payment recorded.");
          void load(page);
        }}
      />
    </div>
  );
}
