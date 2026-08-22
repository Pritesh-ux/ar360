"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  CheckCircle2,
  Clock,
  Download,
  Eye,
  MessageSquare,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import TicketDetailModal from "@/components/features/master-admin/TicketDetailModal";
import CreateTicketModal from "@/components/features/master-admin/CreateTicketModal";
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
import type { PaginationMeta } from "@/lib/master-admin/pagination";
import "@/components/dashboard/dashboard-premium.css";
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

const priorityFilterOptions = priorityOptions.map((p) => p.value);

function defaultTicketDateRange(): DateRangeValue {
  return defaultDateRange("7d");
}

export default function SupportTicketsPage() {
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
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultTicketDateRange());
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);

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

  useDeferredEffect(() => {
    setPage(1);
  }, [search, status, priority, assigned, dateRange.from, dateRange.to, dateRange.preset]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, status, priority, assigned, dateRange.from, dateRange.to, dateRange.preset, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageItems = tickets;

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setPriority("all");
    setAssigned("all");
    setDateRange(defaultTicketDateRange());
  }

  const assignedOptions = ["all", "unassigned", ...assigneeOptions];
  const hasFilters = Boolean(
    search || status !== "all" || priority !== "all" || assigned !== "all" || dateRange.preset !== "7d",
  );

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (priority !== "all") params.set("priority", priority);
    if (assigned !== "all") params.set("assigned", assigned);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
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
      note: filterLabel,
      icon: MessageSquare,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Tickets",
      value: summary?.pending ?? 0,
      note: "Awaiting customer or admin",
      icon: Clock,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Resolved Tickets",
      value: summary?.resolved ?? 0,
      note: summary?.avgResolutionLabel || "Resolution time",
      icon: CheckCircle2,
      iconClassName: "bg-sky-50 text-sky-600",
    },
    {
      title: "Closed Tickets",
      value: summary?.closed ?? 0,
      note: "Archived tickets",
      icon: XCircle,
      iconClassName: "bg-violet-50 text-violet-600",
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
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Support Tickets"
        subtitle="Manage and respond to customer support tickets."
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <Download size={15} />
              Export
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="dash-premium-btn-primary h-10 px-4 text-[12px]"
            >
              <Plus size={15} strokeWidth={2.2} />
              New Ticket
            </button>
          </>
        }
      />

      {message ? (
        <div
          className={`dash-premium-card flex items-center justify-between gap-3 px-4 py-3 ${
            message.toLowerCase().includes("fail") || message.toLowerCase().includes("unable")
              ? "border-[#FECACA] bg-[#FEF2F2]"
              : "border-[#DCFCE7] bg-[#F0FDF4]"
          }`}
        >
          <p
            className={`text-[13px] font-semibold ${
              message.toLowerCase().includes("fail") || message.toLowerCase().includes("unable")
                ? "text-[#B91C1C]"
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
          <div className="relative min-w-[240px] flex-1 basis-[260px] max-w-md">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket ID, subject or customer..."
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
            options={statusOptions.map((s) => s.value)}
            onChange={setStatus}
            renderOption={(value) => statusOptions.find((s) => s.value === value)?.label || value}
            renderValue={(value) => statusOptions.find((s) => s.value === value)?.label || value}
          />
          <UserFilterDropdown
            hideLabel
            compact
            className="w-[140px] shrink-0"
            label="Priority"
            menuTitle="Priority"
            value={priority}
            options={priorityFilterOptions}
            onChange={setPriority}
            renderOption={(value) => priorityOptions.find((p) => p.value === value)?.label || value}
            renderValue={(value) => priorityOptions.find((p) => p.value === value)?.label || value}
          />
          <UserFilterDropdown
            hideLabel
            compact
            className="w-[160px] shrink-0"
            label="Assigned"
            menuTitle="Assigned"
            value={assigned}
            options={assignedOptions}
            onChange={setAssigned}
            renderOption={(value) =>
              value === "all" ? "All Assigned" : value === "unassigned" ? "Unassigned" : value
            }
            renderValue={(value) =>
              value === "all" ? "All Assigned" : value === "unassigned" ? "Unassigned" : value
            }
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
          <table className="w-full min-w-[1100px] text-left text-[13px]">
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
                <th className="px-3 py-3">Ticket</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Subject</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Assigned To</th>
                <th className="px-3 py-3">Created At</th>
                <th className="px-3 py-3">Last Updated</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <AdminLoadingState label="Loading tickets..." />
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <AdminEmptyState title="No tickets found." />
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
                      <button
                        type="button"
                        onClick={() => setDetailId(row.id)}
                        className="font-black text-[#111827] transition hover:text-[#5AA700] hover:underline"
                      >
                        {row.ticketNumber}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar name={row.customerName} seed={row.customerEmail} size="sm" />
                        <div className="min-w-0">
                          {row.customerUid ? (
                            <Link
                              href={`/master-admin/customers/${row.customerUid}`}
                              className="truncate font-bold text-[#111827] transition hover:text-[#5AA700]"
                            >
                              {row.customerName}
                            </Link>
                          ) : (
                            <p className="truncate font-bold text-[#111827]">{row.customerName}</p>
                          )}
                          <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{row.customerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <p className="truncate font-bold text-[#111827]">{row.subject}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-[#9CA3AF]">{row.description}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${ticketPriorityClass(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${ticketStatusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <CustomerAvatar name={row.assignedTo} seed={row.assignedTo} size="sm" />
                        <span className="font-semibold text-[#374151]">{row.assignedTo}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#374151]">{fmtDateTime(row.createdAt)}</td>
                    <td className="px-3 py-3 font-semibold text-[#374151]">{fmtDateTime(row.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          title="View"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
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

        <div className="border-t border-[#ECECEC] px-2">
          <AdminPagination
            page={page}
            totalPages={pagination.totalPages}
            meta={pagination}
            onPageChange={setPage}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="dash-premium-card p-4">
          <h3 className="text-[13px] font-black text-slate-900">Ticket Overview</h3>
          <div className="mt-4">
            <DonutChart items={donutItems} total={donutTotal} centerLabel="Total Tickets" />
          </div>
        </div>

        <div className="dash-premium-card p-4">
          <h3 className="text-[13px] font-black text-[#111827]">Top Ticket Categories</h3>
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

        <div className="dash-premium-card p-4">
          <h3 className="text-[13px] font-black text-[#111827]">Open Ticket Aging</h3>
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
        saving={false}
        onClose={() => setDetailId(null)}
        onSaved={(msg) => {
          if (msg) setMessage(msg);
          void load(page);
        }}
      />
      <CreateTicketModal
        open={createOpen}
        assigneeOptions={assigneeOptions}
        saving={false}
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
