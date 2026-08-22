"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Mail,
  Plus,
  RefreshCw,
  Eye,
  Search,
  Send,
  X,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import SendEmailModal from "@/components/features/master-admin/SendEmailModal";
import EmailLogDetailModal, {
  type EmailLogDetail,
} from "@/components/features/master-admin/EmailLogDetailModal";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import type { PaginationMeta } from "@/lib/master-admin/pagination";
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
const STATUS_OPTIONS = ["all", "sent", "failed", "console"];

function statusClass(status: string) {
  if (status === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export default function EmailCenterPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [templateBreakdown, setTemplateBreakdown] = useState<TemplateBreakdown[]>([]);
  const [templates, setTemplates] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [template, setTemplate] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [sendOpen, setSendOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailLog, setDetailLog] = useState<EmailLogDetail | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (template !== "all") params.set("template", template);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

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

  useDeferredEffect(() => {
    setPage(1);
  }, [search, status, template, dateRange.from, dateRange.to, dateRange.preset]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, template, dateRange.from, dateRange.to, dateRange.preset, page]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (template !== "all") params.set("template", template);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
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

  async function openDetail(logId: number) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError("");
    setDetailLog(null);
    try {
      const res = await fetch(`/api/master-admin/email-center/${logId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load email detail");
      setDetailLog(data.log || null);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load email detail");
    } finally {
      setDetailLoading(false);
    }
  }

  const templateOptions = ["all", ...templates.map((t) => t.id)];
  const hasFilters = Boolean(
    search || status !== "all" || template !== "all" || dateRange.preset !== "30d",
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setTemplate("all");
    setDateRange(defaultDateRange("30d"));
    setPage(1);
  }

  const statCards = [
    {
      title: "Sent",
      value: summary?.sent ?? 0,
      note: `${summary?.today ?? 0} today`,
      icon: CheckCircle2,
      accent: "emerald" as const,
    },
    {
      title: "Failed",
      value: summary?.failed ?? 0,
      note: "Delivery errors",
      icon: AlertCircle,
      accent: "rose" as const,
    },
    {
      title: "Console Logged",
      value: summary?.console ?? 0,
      note: "No live provider configured",
      icon: Mail,
      accent: "amber" as const,
    },
    {
      title: "Total Logs",
      value: summary?.total ?? 0,
      note: "Filtered results",
      icon: Send,
      accent: "sky" as const,
    },
  ];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Email Center"
        subtitle="Search delivery logs, send customer emails, and review provider status."
        actions={
          <>
            <Link href="/master-admin/settings" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              Email Settings
            </Link>
            <button type="button" onClick={exportCsv} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <Download size={15} />
              Export
            </button>
            <button type="button" onClick={() => setSendOpen(true)} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Plus size={15} strokeWidth={2.2} />
              Send Email
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
            message.toLowerCase().includes("fail") || message.toLowerCase().includes("unable")
              ? "border-[#FEE2E2] bg-[#FEF2F2]"
              : "border-[#DCFCE7] bg-[#F0FDF4]"
          }`}
        >
          <p
            className={`text-[13px] font-semibold ${
              message.toLowerCase().includes("fail") || message.toLowerCase().includes("unable")
                ? "text-[#991B1B]"
                : "text-[#166534]"
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <UserMetricCard
            key={card.title}
            title={card.title}
            value={Number(card.value).toLocaleString("en-IN")}
            note={card.note}
            icon={card.icon}
            accent={card.accent}
            compact
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <div className="dash-premium-card overflow-hidden xl:col-span-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
            <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipient, subject, template..."
                className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
              />
            </div>

            <UserFilterDropdown
              hideLabel
              compact
              className="w-[138px] shrink-0"
              label="Status"
              menuTitle="Status"
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
              renderOption={(v) =>
                ({ all: "All Status", sent: "Sent", failed: "Failed", console: "Console" } as Record<string, string>)[
                  v
                ] || v
              }
              renderValue={(v) =>
                ({ all: "All Status", sent: "Sent", failed: "Failed", console: "Console" } as Record<string, string>)[
                  v
                ] || v
              }
            />

            <UserFilterDropdown
              hideLabel
              compact
              className="w-[160px] shrink-0"
              label="Template"
              menuTitle="Template"
              value={template}
              options={templateOptions}
              onChange={setTemplate}
              renderOption={(v) =>
                v === "all" ? "All Templates" : templates.find((t) => t.id === v)?.label || v
              }
              renderValue={(v) =>
                v === "all" ? "All Templates" : templates.find((t) => t.id === v)?.label || v
              }
            />

            <UserDateRangePicker value={dateRange} onChange={setDateRange} />

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex h-10 shrink-0 items-center rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                Clear
              </button>
            ) : null}
          </div>

          {loading ? (
            <AdminLoadingState label="Loading email logs..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-3 py-3">Recipient</th>
                    <th className="px-3 py-3">Subject</th>
                    <th className="px-3 py-3">Template</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Sent</th>
                    <th className="w-16 px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <AdminEmptyState title="No email logs yet." />
                      </td>
                    </tr>
                  ) : (
                    logs.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]"
                        onClick={() => void openDetail(row.id)}
                      >
                        <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">{row.recipient}</td>
                        <td className="max-w-[240px] px-3 py-3">
                          <p className="truncate text-[12px] font-semibold text-[#374151]">{row.subject}</p>
                          {row.errorMessage ? (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-red-500">{row.errorMessage}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{row.templateLabel}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{fmtDateTime(row.sentAt)}</td>
                        <td className="px-3 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void openDetail(row.id)}
                              title="View details"
                              className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F7FCE8] hover:text-[#3D6600]"
                            >
                              <Eye size={15} />
                            </button>
                            {row.status === "failed" && row.template !== "custom" ? (
                              <button
                                type="button"
                                disabled={retryingId === row.id}
                                onClick={() => void retryLog(row.id)}
                                title="Retry"
                                className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50"
                              >
                                <RefreshCw size={15} className={retryingId === row.id ? "animate-spin" : ""} />
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
          )}

          <div className="border-t border-[#ECECEC] px-2">
            <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={setPage} />
          </div>
        </div>

        <aside className="dash-premium-card p-4">
          <h3 className="text-[13px] font-bold text-[#111827]">By Template</h3>
          <div className="mt-4 space-y-3">
            {templateBreakdown.length === 0 ? (
              <p className="text-[12px] font-medium text-[#9CA3AF]">No template data</p>
            ) : (
              templateBreakdown.map((item) => (
                <div key={item.template} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-semibold text-[#6B7280]">{item.label}</span>
                  <span className="font-bold text-[#111827]">{item.count}</span>
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

      <EmailLogDetailModal
        open={detailOpen}
        loading={detailLoading}
        log={detailLog}
        error={detailError}
        onClose={() => {
          setDetailOpen(false);
          setDetailLog(null);
          setDetailError("");
        }}
      />
    </div>
  );
}
