"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminActionMessage,
  AdminButton,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminLoadingState,
  AdminPagination,
  AdminSelect,
  AdminTablePanel,
} from "@/components/ui/admin";
import type { EnterpriseRequest, EnterpriseStatus } from "@/lib/enterprise-sales/types";
import type { PaginationMeta } from "@/lib/master-admin/pagination";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: { value: EnterpriseStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "quoted", label: "Quoted" },
  { value: "waiting_payment", label: "Waiting Payment" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

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
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  function buildParams(includePage = true) {
    const params = new URLSearchParams();
    if (includePage) {
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
    }
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (country) params.set("country", country);
    if (industry) params.set("industry", industry);
    if (assignee) params.set("assignee", assignee);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
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
  }, [page, search, status, country, industry, assignee, dateFrom, dateTo]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setCountry("");
    setIndustry("");
    setAssignee("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function exportCsv() {
    const params = buildParams(false);
    params.set("export", "csv");
    window.open(`/api/master-admin/enterprise-requests?${params}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title="Enterprise Requests"
        subtitle="Review and manage custom-plan sales enquiries."
        actions={
          <AdminButton onClick={exportCsv}>
            <Download size={16} />
            Export CSV
          </AdminButton>
        }
      />

      {message ? <AdminActionMessage message={message} variant="error" /> : null}

      <AdminTablePanel>
        <AdminFilterBar onClear={clearFilters}>
          <div className="relative min-w-[240px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <AdminInput
              soft
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search ID, company, contact or email..."
              className="w-full pl-9"
            />
          </div>
          <AdminSelect
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Countries</option>
            {options.countries.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </AdminSelect>
          <AdminSelect
            value={industry}
            onChange={(event) => {
              setIndustry(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Industries</option>
            {options.industries.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </AdminSelect>
          <AdminSelect
            value={assignee}
            onChange={(event) => {
              setAssignee(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {options.assignees.map((value) => (
              <option key={value.id} value={value.id}>{value.name}</option>
            ))}
          </AdminSelect>
          <AdminInput
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            title="Created from"
          />
          <AdminInput
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            title="Created to"
          />
        </AdminFilterBar>

        {loading ? (
          <AdminLoadingState label="Loading Enterprise requests..." />
        ) : requests.length === 0 ? (
          <AdminEmptyState title="No Enterprise requests found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="p-3">Request ID</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Contact Person</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Industry</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="w-20 p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.requestUid} className="border-b border-slate-50 hover:bg-slate-50/70">
                    <td className="p-3">
                      <Link
                        href={`/master-admin/enterprise-requests/${item.requestUid}`}
                        className="text-[12px] font-black text-slate-900 hover:text-[#4D9A00]"
                      >
                        {item.requestUid}
                      </Link>
                    </td>
                    <td className="p-3 text-[12px] font-bold text-slate-800">{item.companyName}</td>
                    <td className="p-3 text-[12px] font-semibold text-slate-700">{item.contactName}</td>
                    <td className="p-3 text-[12px] font-medium text-slate-500">{item.businessEmail}</td>
                    <td className="p-3 text-[12px] font-semibold text-slate-600">{item.country}</td>
                    <td className="p-3 text-[12px] font-semibold text-slate-600">{item.industry}</td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${badgeClass[item.status]}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="p-3 text-[12px] font-semibold text-slate-600">{formatDate(item.createdAt)}</td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/master-admin/enterprise-requests/${item.requestUid}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
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

        <AdminPagination
          page={page}
          totalPages={pagination.totalPages}
          meta={pagination}
          onPageChange={setPage}
        />
      </AdminTablePanel>
    </div>
  );
}
