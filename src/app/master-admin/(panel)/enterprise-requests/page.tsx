"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Eye, Search, X } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import type { EnterpriseRequest, EnterpriseStatus } from "@/lib/enterprise-sales/types";
import type { PaginationMeta } from "@/lib/master-admin/pagination";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  "all",
  "new",
  "contacted",
  "negotiating",
  "quoted",
  "waiting_payment",
  "active",
  "rejected",
  "closed",
] as const;

const STATUS_LABELS: Record<string, string> = {
  all: "All Statuses",
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  quoted: "Quoted",
  waiting_payment: "Waiting Payment",
  active: "Active",
  rejected: "Rejected",
  closed: "Closed",
};

type FilterOptions = {
  countries: string[];
  industries: string[];
  assignees: { id: number; name: string }[];
};

const badgeClass: Record<EnterpriseStatus, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-200",
  contacted: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  negotiating: "bg-amber-50 text-amber-700 ring-amber-200",
  quoted: "bg-violet-50 text-violet-700 ring-violet-200",
  waiting_payment: "bg-orange-50 text-orange-700 ring-orange-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  closed: "bg-slate-100 text-slate-600 ring-slate-200",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function EnterpriseRequestsPage() {
  const [requests, setRequests] = useState<EnterpriseRequest[]>([]);
  const [options, setOptions] = useState<FilterOptions>({
    countries: [],
    industries: [],
    assignees: [],
  });
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("all"));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  function buildParams(includePage = true) {
    const params = new URLSearchParams();
    if (includePage) {
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
    }
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    if (country !== "all") params.set("country", country);
    if (industry !== "all") params.set("industry", industry);
    if (assignee !== "all") params.set("assignee", assignee);
    if (dateRange.from) params.set("dateFrom", dateRange.from);
    if (dateRange.to) params.set("dateTo", dateRange.to);
    return params;
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/master-admin/enterprise-requests?${buildParams()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load Enterprise requests");
        setRequests(data.requests || []);
        setPagination(data.pagination);
        setOptions(data.filterOptions || options);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(error instanceof Error ? error.message : "Unable to load Enterprise requests");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, country, industry, assignee, dateRange.from, dateRange.to, dateRange.preset]);

  const hasFilters = Boolean(
    search ||
      status !== "all" ||
      country !== "all" ||
      industry !== "all" ||
      assignee !== "all" ||
      dateRange.preset !== "all",
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setCountry("all");
    setIndustry("all");
    setAssignee("all");
    setDateRange(defaultDateRange("all"));
    setPage(1);
  }

  function exportCsv() {
    const params = buildParams(false);
    params.set("export", "csv");
    window.open(`/api/master-admin/enterprise-requests?${params}`, "_blank", "noopener,noreferrer");
  }

  const countryOptions = ["all", ...options.countries];
  const industryOptions = ["all", ...options.industries];
  const assigneeOptions = ["all", "unassigned", ...options.assignees.map((a) => String(a.id))];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Enterprise Requests"
        subtitle="Review and manage custom-plan sales enquiries."
        actions={
          <button type="button" onClick={exportCsv} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
            <Download size={15} />
            Export CSV
          </button>
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

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
          <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search ID, company, contact or email..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Status"
            menuTitle="Status"
            value={status}
            options={[...STATUS_OPTIONS]}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            renderOption={(value) => STATUS_LABELS[value] || value}
            renderValue={(value) => STATUS_LABELS[value] || value}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Country"
            menuTitle="Country"
            value={country}
            options={countryOptions}
            onChange={(v) => {
              setCountry(v);
              setPage(1);
            }}
            renderOption={(value) => (value === "all" ? "All Countries" : value)}
            renderValue={(value) => (value === "all" ? "All Countries" : value)}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Industry"
            menuTitle="Industry"
            value={industry}
            options={industryOptions}
            onChange={(v) => {
              setIndustry(v);
              setPage(1);
            }}
            renderOption={(value) => (value === "all" ? "All Industries" : value)}
            renderValue={(value) => (value === "all" ? "All Industries" : value)}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Assignee"
            menuTitle="Assignee"
            value={assignee}
            options={assigneeOptions}
            onChange={(v) => {
              setAssignee(v);
              setPage(1);
            }}
            renderOption={(value) => {
              if (value === "all") return "All Assignees";
              if (value === "unassigned") return "Unassigned";
              return options.assignees.find((a) => String(a.id) === value)?.name || value;
            }}
            renderValue={(value) => {
              if (value === "all") return "All Assignees";
              if (value === "unassigned") return "Unassigned";
              return options.assignees.find((a) => String(a.id) === value)?.name || value;
            }}
          />

          <UserDateRangePicker
            value={dateRange}
            onChange={(v) => {
              setDateRange(v);
              setPage(1);
            }}
          />

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
          <AdminLoadingState label="Loading Enterprise requests..." />
        ) : requests.length === 0 ? (
          <AdminEmptyState title="No Enterprise requests found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-3 py-3">Request ID</th>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Contact Person</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Country</th>
                  <th className="px-3 py-3">Industry</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created Date</th>
                  <th className="w-20 px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.requestUid} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                    <td className="px-3 py-3">
                      <Link
                        href={`/master-admin/enterprise-requests/${item.requestUid}`}
                        className="text-[12px] font-bold text-[#111827] transition hover:text-[#5AA700]"
                      >
                        {item.requestUid}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{item.companyName}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{item.contactName}</td>
                    <td className="px-3 py-3 text-[12px] font-medium text-[#9CA3AF]">{item.businessEmail}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{item.country}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{item.industry}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${badgeClass[item.status]}`}
                      >
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/master-admin/enterprise-requests/${item.requestUid}`}
                        className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                        title="View request"
                      >
                        <Eye size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#ECECEC] px-2">
          <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={setPage} />
        </div>
      </section>
    </div>
  );
}
