"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
} from "lucide-react";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import AdminTable from "@/components/features/master-admin/AdminTable";
import AdminStatCard from "@/components/features/master-admin/AdminStatCard";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
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
const typeOptions = [
  { label: "All Types", value: "all" },
  { label: "Product", value: "Product" },
  { label: "Payment", value: "Payment" },
];
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Success", value: "Success" },
  { label: "Warning", value: "Warning" },
  { label: "Failed", value: "Failed" },
];

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

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
  const initialRange = defaultDateRange();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
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
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

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

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, dateFrom, dateTo]);

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
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.location.href = `/api/master-admin/activity-logs?${params}`;
  }

  return (
    <div className="min-h-full p-4 md:p-6 2xl:p-8 pb-10 md:pb-12">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-[32px]">
            Activity Logs
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Product and payment events across the platform. Logs are read-only.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => load(page)}
            className="inline-flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {message && <AdminActionMessage message={message} className="mb-4" />}

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 2xl:gap-5">
        <AdminStatCard title="Total Events" value={summary?.total ?? 0} icon={<Activity className="text-slate-950" size={22} />} />
        <AdminStatCard title="Product Logs" value={summary?.productCount ?? 0} icon={<Package className="text-slate-950" size={22} />} />
        <AdminStatCard title="Payment Logs" value={summary?.paymentCount ?? 0} icon={<CreditCard className="text-green-600" size={22} />} />
        <AdminStatCard title="Failed Actions" value={summary?.failedCount ?? 0} icon={<Shield className="text-red-500" size={22} />} />
      </section>

      <section className="rounded-[20px] border border-slate-200/60 bg-white p-4 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearch value={search} onChange={setSearch} placeholder="Search action, customer, actor..." />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select value={type} onChange={(e) => setType(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-bold text-slate-700">
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-bold text-slate-700">
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Apply</button>
          </div>
        </form>

        <AdminTable headers={["Activity", "Customer", "Type", "Actor", "IP / Source", "Time", "Status", ""]} alignRightIndex={[7]}>
          {loading ? (
            <tr><td colSpan={8} className="p-8 text-center text-sm font-semibold text-slate-500">Loading activity logs…</td></tr>
          ) : logs.length === 0 ? (
            <tr><td colSpan={8} className="p-8 text-center text-sm font-semibold text-slate-500">No activity logs found.</td></tr>
          ) : logs.map((l) => {
            const Icon = typeIcon(l.type);
            return (
              <tr key={l.id} className="align-middle">
                <td className="p-3 md:p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#A6FF2E]/10 text-slate-950">
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="font-black text-slate-950">{l.action}</div>
                      <div className="mt-1 max-w-[360px] truncate text-xs font-semibold text-slate-500">{l.details}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-950">{l.customer}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{l.email}</div>
                </td>
                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${typeClass(l.type)}`}>{l.type}</span>
                </td>
                <td className="p-3 font-bold md:p-4 text-slate-600">{l.actor}</td>
                <td className="p-3 font-bold md:p-4 text-slate-600">{l.ip || "—"}</td>
                <td className="p-3 font-bold md:p-4 text-slate-600">{fmtDateTime(l.time)}</td>
                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(l.status)}`}>{l.status}</span>
                </td>
                <td className="p-3 md:p-4 text-right">
                  <button
                    onClick={() => setSelected(l)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#A6FF2E]/10 text-slate-950 transition hover:bg-[#A6FF2E]"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </AdminTable>

        <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={(p) => load(p)} />
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Activity Detail</h2>
                <p className="mt-1 text-xs font-semibold md:text-sm text-slate-500">{selected.action} • {selected.customer}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
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
      )}
    </div>
  );
}
