"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Eye,
  RefreshCw,
  Shield,
  ChevronDown,
  X,
  User,
  FileText,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import AdminTable from "@/components/features/master-admin/AdminTable";
import AdminStatCard from "@/components/features/master-admin/AdminStatCard";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import { type PaginationMeta } from "@/lib/master-admin/pagination";

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

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function actionClass(action: string) {
  if (action.includes("delete") || action.includes("disable")) return "bg-red-50 text-red-700";
  if (action.includes("create") || action.includes("send")) return "bg-emerald-50 text-emerald-700";
  if (action.includes("update") || action.includes("assign")) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function AuditLogsPage() {
  const initialRange = defaultDateRange();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actionBreakdown, setActionBreakdown] = useState<{ action: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
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
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

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

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, entityType, dateFrom, dateTo]);

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
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.location.href = `/api/master-admin/audit-logs?${params}`;
  }

  const actionOptions = [
    { label: "All Actions", value: "all" },
    ...actionBreakdown.map((row) => ({ label: row.action, value: row.action })),
  ];

  const entityOptions = [
    { label: "All Entities", value: "all" },
    ...Array.from(new Set(logs.map((l) => l.entityType))).map((t) => ({ label: t, value: t })),
  ];

  return (
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader
        title="Audit Logs"
        subtitle="Immutable record of master admin actions. Logs cannot be edited or deleted."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load(page)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-[var(--color-text)]"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        }
      />

      {message && <AdminActionMessage message={message} />}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard title="Total Entries" value={summary?.total ?? 0} icon={<Shield className="text-slate-950" size={22} />} />
        <AdminStatCard title="Unique Admins" value={summary?.uniqueAdmins ?? 0} icon={<User className="text-blue-600" size={22} />} />
        <AdminStatCard title="Today" value={summary?.today ?? 0} icon={<FileText className="text-emerald-600" size={22} />} />
        <AdminStatCard title="Last 7 Days" value={summary?.last7Days ?? 0} icon={<Shield className="text-amber-500" size={22} />} />
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearch value={search} onChange={setSearch} placeholder="Search action, admin, entity..." />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={action} onChange={setAction} options={actionOptions} />
            <FilterSelect value={entityType} onChange={setEntityType} options={entityOptions} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Apply</button>
          </div>
        </form>

        <AdminTable headers={["Admin", "Action", "Entity", "Entity ID", "Time", ""]} alignRightIndex={[5]}>
          {loading ? (
            <tr><td colSpan={6} className="p-8 text-center text-sm font-semibold text-slate-500">Loading audit logs…</td></tr>
          ) : logs.length === 0 ? (
            <tr><td colSpan={6} className="p-8 text-center text-sm font-semibold text-slate-500">No audit logs found.</td></tr>
          ) : logs.map((log) => (
            <tr key={log.id} className="align-middle">
              <td className="p-3 md:p-4">
                <div className="font-black text-slate-950">{log.adminName}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{log.adminEmail || "—"}</div>
              </td>
              <td className="p-3 md:p-4">
                <span className={`rounded-full px-3 py-1 text-xs font-black ${actionClass(log.action)}`}>{log.action}</span>
              </td>
              <td className="p-3 font-bold md:p-4 text-slate-600">{log.entityType}</td>
              <td className="p-3 font-bold md:p-4 text-slate-600">{log.entityId || "—"}</td>
              <td className="p-3 font-bold md:p-4 text-slate-600">{fmtDateTime(log.createdAt)}</td>
              <td className="p-3 md:p-4 text-right">
                <button
                  onClick={() => setSelected(log)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#A6FF2E]/10 text-slate-950 transition hover:bg-[#A6FF2E]"
                  title="View metadata"
                >
                  <Eye size={16} />
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={(p) => load(p)} />
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Audit Entry</h2>
                <p className="mt-1 text-xs font-semibold md:text-sm text-slate-500">{selected.action} • {selected.entityType}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
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
              <pre className="mt-2 overflow-x-auto text-xs font-mono text-emerald-300">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-bold text-slate-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
