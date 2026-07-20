"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  Mail,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import SendEmailModal from "@/components/features/master-admin/SendEmailModal";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { paginationRange, type PaginationMeta } from "@/lib/master-admin/pagination";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";

type EmailLog = {
  id: number;
  recipient: string;
  subject: string;
  template: string;
  templateLabel: string;
  status: string;
  messageId: string | null;
  errorMessage: string | null;
  sentAt: string;
  createdAt: string;
};

type Summary = {
  sent: number;
  failed: number;
  console: number;
  total: number;
  today: number;
};

type TemplateBreakdown = {
  template: string;
  label: string;
  count: number;
};

const PAGE_SIZE = 15;
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Sent", value: "sent" },
  { label: "Failed", value: "failed" },
  { label: "Console", value: "console" },
];

function statusClass(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function EmailCenterPage() {
  const initialRange = defaultDateRange();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [templateBreakdown, setTemplateBreakdown] = useState<TemplateBreakdown[]>([]);
  const [templates, setTemplates] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [template, setTemplate] = useState("all");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [sendOpen, setSendOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (template !== "all") params.set("template", template);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const response = await fetch(`/api/master-admin/email-center?${params}`, { cache: "no-store" });
      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      setTemplateBreakdown(data.templateBreakdown || []);
      setTemplates(data.templates || []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load email logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, status, template, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, template, dateFrom, dateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = paginationRange(pagination);

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (template !== "all") params.set("template", template);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/master-admin/email-center?${params}`, "_blank");
  }

  async function retryLog(logId: number) {
    setRetryingId(logId);
    setMessage("");
    try {
      const res = await fetch("/api/master-admin/email-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", logId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      setMessage("Retry attempted.");
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  const statCards = [
    {
      title: "Sent",
      value: summary?.sent ?? 0,
      subtitle: `${summary?.today ?? 0} today`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Failed",
      value: summary?.failed ?? 0,
      subtitle: "Delivery errors",
      icon: AlertCircle,
      iconBg: "bg-red-50 text-red-600",
    },
    {
      title: "Console Logged",
      value: summary?.console ?? 0,
      subtitle: "No live provider configured",
      icon: Mail,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Total Logs",
      value: summary?.total ?? 0,
      subtitle: "Filtered results",
      icon: Send,
      iconBg: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title="Email Center"
        subtitle="Search delivery logs, send customer emails, and review provider status."
        actions={
          <>
            <Link
              href="/master-admin/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700"
            >
              Email Settings
            </Link>
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
              onClick={() => setSendOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A6FF2E] px-4 py-2.5 text-[13px] font-black text-slate-900"
            >
              <Plus size={16} />
              Send Email
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${card.iconBg}`}>
                <Icon size={16} />
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{card.title}</p>
              <p className="mt-0.5 text-[24px] font-black leading-none text-slate-950">
                {Number(card.value).toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">{card.subtitle}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:col-span-3">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:flex-wrap lg:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient, subject, template..."
              className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            >
              <option value="all">All Templates</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center font-semibold text-slate-400">
                      Loading email logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center font-semibold text-slate-400">
                      No email logs yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-900">{row.recipient}</td>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate font-semibold text-slate-800">{row.subject}</p>
                        {row.errorMessage ? (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-red-500">{row.errorMessage}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{row.templateLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{fmtDateTime(row.sentAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          {row.status === "failed" && row.template !== "custom" ? (
                            <button
                              type="button"
                              disabled={retryingId === row.id}
                              onClick={() => void retryLog(row.id)}
                              title="Retry"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
                            >
                              <RefreshCw size={15} />
                            </button>
                          ) : null}
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
            meta={pagination}
            onPageChange={setPage}
          />
        </div>

        <aside className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-black text-slate-900">By Template</h3>
          <div className="mt-4 space-y-3">
            {templateBreakdown.length === 0 ? (
              <p className="text-[12px] font-semibold text-slate-400">No template data</p>
            ) : (
              templateBreakdown.map((item) => (
                <div key={item.template} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-semibold text-slate-600">{item.label}</span>
                  <span className="font-bold text-slate-800">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <SendEmailModal
        open={sendOpen}
        templates={templates}
        onClose={() => setSendOpen(false)}
        onSent={(msg) => {
          setMessage(msg);
          void load(page);
        }}
      />
    </div>
  );
}
