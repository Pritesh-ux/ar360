"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Activity,
  Download,
  Eye,
  Package,
  CreditCard,
  Shield,
  User,
  X,
  RefreshCw,
  Search,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { type PaginationMeta } from "@/lib/master-admin/pagination";

type ActivityType = "Product" | "Payment" | "Subscription" | "Security" | "Customer" | "Admin";

type ActivityLog = {
  id: string;
  customer: string;
  email: string;
  type: ActivityType | string;
  action: string;
  details: string;
  actor: string;
  ip: string;
  time: string;
  status: "Success" | "Warning" | "Failed" | string;
};

type Summary = {
  total: number;
  productCount: number;
  paymentCount: number;
  failedCount: number;
  today: number;
};

const PAGE_SIZE = 15;
const TYPE_OPTIONS = ["all", "Product", "Payment"];
const STATUS_OPTIONS = ["all", "Success", "Warning", "Failed"];

function typeIcon(type: string) {
  if (type === "Product") return Package;
  if (type === "Payment") return CreditCard;
  if (type === "Security") return Shield;
  if (type === "Customer") return User;
  return Activity;
}

function typeClass(type: string) {
  if (type === "Product") return "bg-[#eaffc9] text-slate-950";
  if (type === "Payment") return "bg-green-50 text-green-700";
  if (type === "Subscription") return "bg-purple-50 text-purple-700";
  if (type === "Security") return "bg-red-50 text-red-700";
  if (type === "Customer") return "bg-yellow-50 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

function statusClass(status: string) {
  if (status === "Success") return "bg-green-50 text-green-700";
  if (status === "Warning") return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [selected, setSelected] = useState<ActivityLog | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (status !== "all") params.set("status", status);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

    try {
      const response = await fetch(`/api/master-admin/activity-logs?${params}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load activity logs");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    load(1);
  }, [type, status, dateRange.from, dateRange.to, dateRange.preset]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (status !== "all") params.set("status", status);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
    window.location.href = `/api/master-admin/activity-logs?${params}`;
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Activity Logs"
        subtitle="Product and payment events across the platform. Logs are read-only."
        actions={
          <>
            <button type="button" onClick={() => load(page)} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button type="button" onClick={exportCsv} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Download size={15} />
              Export CSV
            </button>
          </>
        }
      />

      {message ? (
        <div className="dash-premium-card flex items-center justify-between gap-3 border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#991B1B]">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#991B1B] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UserMetricCard title="Total Events" value={String(summary?.total ?? 0)} icon={Activity} accent="sky" compact />
        <UserMetricCard title="Product Logs" value={String(summary?.productCount ?? 0)} icon={Package} accent="lime" compact />
        <UserMetricCard title="Payment Logs" value={String(summary?.paymentCount ?? 0)} icon={CreditCard} accent="emerald" compact />
        <UserMetricCard title="Failed Actions" value={String(summary?.failedCount ?? 0)} icon={Shield} accent="rose" compact />
      </section>

      <section className="dash-premium-card overflow-hidden">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3"
        >
          <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, customer, actor..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Type"
            menuTitle="Type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={setType}
            renderOption={(v) => (v === "all" ? "All Types" : v)}
            renderValue={(v) => (v === "all" ? "All Types" : v)}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Status"
            menuTitle="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            renderOption={(v) => (v === "all" ? "All Status" : v)}
            renderValue={(v) => (v === "all" ? "All Status" : v)}
          />

          <UserDateRangePicker value={dateRange} onChange={setDateRange} />

          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#111827] transition hover:bg-[#FAFAFB]"
          >
            Apply
          </button>
        </form>

        {loading ? (
          <AdminLoadingState label="Loading activity logs…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-3 py-3">Activity</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Actor</th>
                  <th className="px-3 py-3">IP / Source</th>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <AdminEmptyState title="No activity logs found." />
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => {
                    const Icon = typeIcon(l.type);
                    return (
                      <tr key={l.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#B9FF2C]/15 text-[#111827]">
                              <Icon size={16} />
                            </div>
                            <div>
                              <div className="text-[13px] font-bold text-[#111827]">{l.action}</div>
                              <div className="mt-0.5 max-w-[360px] truncate text-[11px] font-medium text-[#9CA3AF]">
                                {l.details}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[13px] font-bold text-[#111827]">{l.customer}</div>
                          <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{l.email}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${typeClass(l.type)}`}>
                            {l.type}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{l.actor}</td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{l.ip || "—"}</td>
                        <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{fmtDateTime(l.time)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelected(l)}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#ECECEC] px-2">
          <AdminPagination
            page={page}
            totalPages={pagination.totalPages}
            meta={pagination}
            onPageChange={(p) => load(p)}
          />
        </div>
      </section>

      {selected && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Activity Detail</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 md:text-sm">
                  {selected.action} • {selected.customer}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              {[
                ["Customer", selected.customer],
                ["Email", selected.email],
                ["Type", selected.type],
                ["Action", selected.action],
                ["Details", selected.details],
                ["Actor", selected.actor],
                ["IP / Source", selected.ip || "—"],
                ["Time", fmtDateTime(selected.time)],
                ["Status", selected.status],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
}
