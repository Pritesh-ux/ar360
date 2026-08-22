"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Download, Eye, RefreshCw, Search, Shield, User, FileText, X } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import { type PaginationMeta } from "@/lib/master-admin/pagination";
import ViewportPortal from "@/components/shared/ViewportPortal";

type AuditLog = {
  id: number;
  adminId: string | null;
  adminName: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type Summary = {
  total: number;
  uniqueAdmins: number;
  today: number;
  last7Days: number;
};

const PAGE_SIZE = 15;

function actionClass(action: string) {
  if (action.includes("delete") || action.includes("disable")) return "bg-red-50 text-red-700";
  if (action.includes("create") || action.includes("send")) return "bg-emerald-50 text-emerald-700";
  if (action.includes("update") || action.includes("assign")) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actionBreakdown, setActionBreakdown] = useState<{ action: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [selected, setSelected] = useState<AuditLog | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (action !== "all") params.set("action", action);
    if (entityType !== "all") params.set("entityType", entityType);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

    try {
      const response = await fetch(`/api/master-admin/audit-logs?${params}`, { cache: "no-store" });
      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      setActionBreakdown(data.actionBreakdown || []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    load(1);
  }, [action, entityType, dateRange.from, dateRange.to, dateRange.preset]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (action !== "all") params.set("action", action);
    if (entityType !== "all") params.set("entityType", entityType);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
    window.location.href = `/api/master-admin/audit-logs?${params}`;
  }

  const actionOptions = ["all", ...actionBreakdown.map((row) => row.action)];
  const entityOptions = ["all", ...Array.from(new Set(logs.map((l) => l.entityType)))];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Audit Logs"
        subtitle="Immutable record of master admin actions. Logs cannot be edited or deleted."
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
        <UserMetricCard title="Total Entries" value={String(summary?.total ?? 0)} icon={Shield} accent="sky" compact />
        <UserMetricCard title="Unique Admins" value={String(summary?.uniqueAdmins ?? 0)} icon={User} accent="violet" compact />
        <UserMetricCard title="Today" value={String(summary?.today ?? 0)} icon={FileText} accent="emerald" compact />
        <UserMetricCard title="Last 7 Days" value={String(summary?.last7Days ?? 0)} icon={Shield} accent="amber" compact />
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
              placeholder="Search action, admin, entity..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[160px] shrink-0"
            label="Action"
            menuTitle="Action"
            value={action}
            options={actionOptions}
            onChange={setAction}
            renderOption={(v) => (v === "all" ? "All Actions" : v)}
            renderValue={(v) => (v === "all" ? "All Actions" : v)}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[160px] shrink-0"
            label="Entity"
            menuTitle="Entity type"
            value={entityType}
            options={entityOptions}
            onChange={setEntityType}
            renderOption={(v) => (v === "all" ? "All Entities" : v)}
            renderValue={(v) => (v === "all" ? "All Entities" : v)}
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
          <AdminLoadingState label="Loading audit logs…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-3 py-3">Admin</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Entity</th>
                  <th className="px-3 py-3">Entity ID</th>
                  <th className="px-3 py-3">Time</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <AdminEmptyState title="No audit logs found." />
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-bold text-[#111827]">{log.adminName}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{log.adminEmail || "—"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${actionClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{log.entityType}</td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{log.entityId || "—"}</td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelected(log)}
                          className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                          title="View metadata"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
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
                <h2 className="text-2xl font-black text-slate-950">Audit Entry</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 md:text-sm">
                  {selected.action} • {selected.entityType}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              {[
                ["Admin", selected.adminName],
                ["Email", selected.adminEmail || "—"],
                ["Action", selected.action],
                ["Entity Type", selected.entityType],
                ["Entity ID", selected.entityId || "—"],
                ["Time", fmtDateTime(selected.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-slate-950 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Metadata</p>
              <pre className="mt-2 overflow-x-auto font-mono text-xs text-emerald-300">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
}
