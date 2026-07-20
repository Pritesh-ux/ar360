"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  MessageSquare,
  Plus,
  XCircle,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import TicketDetailModal from "@/components/features/master-admin/TicketDetailModal";
import CreateTicketModal from "@/components/features/master-admin/CreateTicketModal";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { paginationRange, type PaginationMeta } from "@/lib/master-admin/pagination";
import {
  fmtDateTime,
  ticketPriorityClass,
  ticketStatusClass,
} from "@/components/features/master-admin/support-tickets-utils";

type TicketRow = {
  id: string;
  ticketNumber: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  categoryLabel: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "Pending" | "Resolved" | "Closed";
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  totalCount: number;
  avgResolutionLabel?: string;
};

type OpenAging = {
  bucket: string;
  count: number;
};

type StatusBreakdown = {
  status: string;
  key: string;
  count: number;
  percent: number;
};

type CategoryBreakdown = {
  category: string;
  label: string;
  count: number;
  percent: number;
};

const PAGE_SIZE = 8;
const statusOptions = [
  { label: "All Status", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];
const priorityOptions = [
  { label: "All Priority", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const statusColors: Record<string, string> = {
  Open: "#10B981",
  Pending: "#F59E0B",
  Resolved: "#0EA5E9",
  Closed: "#94A3B8",
};

function DonutChart({
  items,
  total,
  centerLabel,
}: {
  items: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const activeItems = items.filter((i) => i.value > 0);
  const segments = activeItems.map((item, index) => {
    const pct = total > 0 ? item.value / total : 0;
    const dash = `${pct * 100} ${100 - pct * 100}`;
    const offset = activeItems.slice(0, index).reduce((sum, curr) => {
      const currPct = total > 0 ? curr.value / total : 0;
      return sum + currPct * 100;
    }, 0);
    return { ...item, dash, offset };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative">
        <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[16px] font-black text-slate-900">{total.toLocaleString("en-IN")}</p>
          <p className="text-[10px] font-semibold text-slate-400">{centerLabel}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="font-semibold text-slate-600">{item.label}</span>
            </div>
            <span className="font-bold text-slate-800">
              {item.value}{" "}
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

export default function SupportTicketsPage() {
  const initialRange = defaultDateRange();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [openAging, setOpenAging] = useState<OpenAging[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [assigned, setAssigned] = useState("all");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    if (assigned !== "all") params.set("assigned", assigned);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const response = await fetch(`/api/master-admin/support-tickets?${params}`, { cache: "no-store" });
      const data = await response.json();
      setTickets(data.tickets || []);
      setSummary(data.summary || null);
      setStatusBreakdown(data.analytics?.statusBreakdown || []);
      setCategoryBreakdown(data.analytics?.categoryBreakdown || []);
      setOpenAging(data.analytics?.openAging || []);
      setAssigneeOptions(data.assigneeOptions || []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
      if (data.error) setMessage(data.error);
      setSelected(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load support tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [search, status, priority, assigned, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, priority, assigned, dateFrom, dateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = tickets;
  const range = paginationRange(pagination);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setAssigned("all");
    const range = defaultDateRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    if (assigned !== "all") params.set("assigned", assigned);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    window.open(`/api/master-admin/support-tickets?${params}`, "_blank");
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

  const filterLabel = `${summary?.totalCount ?? 0} matching filters`;

  const statCards = [
    {
      title: "Open Tickets",
      value: summary?.open ?? 0,
      subtitle: filterLabel,
      icon: MessageSquare,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Tickets",
      value: summary?.pending ?? 0,
      subtitle: "Awaiting customer or admin",
      icon: Clock,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Resolved Tickets",
      value: summary?.resolved ?? 0,
      subtitle: summary?.avgResolutionLabel || "Resolution time",
      icon: CheckCircle2,
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      title: "Closed Tickets",
      value: summary?.closed ?? 0,
      subtitle: "Archived tickets",
      icon: XCircle,
      iconBg: "bg-violet-50 text-violet-600",
    },
  ];

  const donutItems = statusBreakdown.map((item) => ({
    label: item.status,
    value: item.count,
    color: statusColors[item.status] || "#94A3B8",
  }));
  const donutTotal = summary?.totalCount ?? 0;

  const categoryMax = Math.max(...categoryBreakdown.map((c) => c.count), 1);

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title="Support Tickets"
        subtitle="Manage and respond to customer support tickets."
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
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A6FF2E] px-4 py-2.5 text-[13px] font-black text-slate-900"
            >
              <Plus size={16} />
              New Ticket
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
              <p className="mt-0.5 text-[24px] font-black leading-none text-slate-950">
                {Number(card.value).toLocaleString("en-IN")}
              </p>
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
            placeholder="Search by ticket ID, subject or customer..."
            className="h-10 min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-[13px] font-medium outline-none focus:border-[#A6FF2E] focus:bg-white"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
          >
            {priorityOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
          >
            <option value="all">All Assigned</option>
            <option value="unassigned">Unassigned</option>
            {assigneeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600">
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
            onClick={resetFilters}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-bold text-slate-600"
          >
            Reset
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[13px]">
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
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center font-semibold text-slate-400">
                    Loading tickets...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center font-semibold text-slate-400">
                    No tickets found.
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
                      <button
                        type="button"
                        onClick={() => setDetailId(row.id)}
                        className="font-black text-slate-900 hover:text-[#4D9A00] hover:underline"
                      >
                        {row.ticketNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar name={row.customerName} seed={row.customerEmail} size="sm" />
                        <div className="min-w-0">
                          {row.customerUid ? (
                            <Link
                              href={`/master-admin/customers/${row.customerUid}`}
                              className="truncate font-bold text-slate-900 hover:text-[#4D9A00]"
                            >
                              {row.customerName}
                            </Link>
                          ) : (
                            <p className="truncate font-bold text-slate-900">{row.customerName}</p>
                          )}
                          <p className="truncate text-[11px] font-medium text-slate-400">{row.customerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-bold text-slate-900">{row.subject}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-400">{row.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${ticketPriorityClass(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${ticketStatusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CustomerAvatar name={row.assignedTo} seed={row.assignedTo} size="sm" />
                        <span className="font-semibold text-slate-700">{row.assignedTo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{fmtDateTime(row.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{fmtDateTime(row.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          title="View"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Eye size={15} />
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
          meta={pagination}
          onPageChange={setPage}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-black text-slate-900">Ticket Overview</h3>
          <div className="mt-4">
            <DonutChart items={donutItems} total={donutTotal} centerLabel="Total Tickets" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-black text-slate-900">Top Ticket Categories</h3>
          <div className="mt-4 space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-[12px] font-semibold text-slate-400">No category data</p>
            ) : (
              categoryBreakdown.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-800">
                      {item.count}{" "}
                      <span className="font-semibold text-slate-400">({item.percent}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#A6FF2E]"
                      style={{ width: `${(item.count / categoryMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-black text-slate-900">Open Ticket Aging</h3>
          <div className="mt-4 space-y-3">
            {openAging.length === 0 ? (
              <p className="text-[12px] font-semibold text-slate-400">No open tickets in filter</p>
            ) : (
              openAging.map((item) => (
                <div key={item.bucket} className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-slate-600">{item.bucket}</span>
                  <span className="font-bold text-slate-800">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <TicketDetailModal
        open={Boolean(detailId)}
        ticketId={detailId}
        assigneeOptions={assigneeOptions}
        saving={saving}
        onClose={() => setDetailId(null)}
        onSaved={(msg) => {
          if (msg) setMessage(msg);
          void load(page);
        }}
      />
      <CreateTicketModal
        open={createOpen}
        assigneeOptions={assigneeOptions}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setMessage("Support ticket created.");
          void load(page);
        }}
      />
    </div>
  );
}
