"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  Building2,
  Download,
  Eye,
  LogIn,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  UserX,
  X,
} from "lucide-react";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPagination,
  StatusBadge,
} from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import type { MetricAccent } from "@/components/user-panel/metric-accent";
import {
  fmtBandwidth,
  fmtDateTime,
  fmtRevenue,
  fmtStorage,
  planLabel,
} from "@/components/features/master-admin/customers-utils";
import { type PaginationMeta } from "@/lib/master-admin/pagination";
import "@/components/dashboard/dashboard-premium.css";

const PLAN_FILTER_OPTIONS = ["all", "trial", "free", "basic", "professional", "enterprise"];
const STATUS_FILTER_OPTIONS = ["all", "Active", "Suspended"];
const BULK_OPTIONS = ["none", "suspend", "export"];

type Customer = {
  customer_uid: string;
  contact_name: string;
  company_name: string | null;
  email: string;
  country: string | null;
  plan_id: string;
  status: string;
  storage_used_mb: number;
  bandwidth_used_mb: number;
  created_at: string;
  last_login_at: string | null;
  product_count: number;
  total_revenue: number;
};

type Summary = {
  total: number;
  active: number;
  suspended: number;
  trial: number;
  enterprise: number;
  activePct: number;
  trialPct: number;
  suspendedPct: number;
  enterprisePct: number;
};

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("all"));
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState("");
  const [bulkAction, setBulkAction] = useState("none");
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setActionMessage("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(PAGE_SIZE));
      if (search) params.set("search", search);
      if (companyFilter) params.set("company", companyFilter);
      if (countryFilter && countryFilter !== "all") params.set("country", countryFilter);
      if (planFilter && planFilter !== "all") params.set("plan", planFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (dateRange.from) params.set("signupFrom", dateRange.from);
      if (dateRange.to) params.set("signupTo", dateRange.to);

      const res = await fetch(`/api/master-admin/customers?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Customers load failed (${res.status})`);
      }
      const data = (await res.json()) as {
        customers: Customer[];
        summary: Summary;
        countries?: string[];
        pagination?: PaginationMeta;
      };
      setCustomers(data.customers);
      setSummary(data.summary);
      setCountries(Array.isArray(data.countries) ? data.countries : []);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to load customers. Retry.");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    setPage(1);
  }, [search, companyFilter, countryFilter, planFilter, statusFilter, dateRange.from, dateRange.to, dateRange.preset]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, companyFilter, countryFilter, planFilter, statusFilter, dateRange.from, dateRange.to, dateRange.preset, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doAction(uid: string, action: "suspend" | "activate" | "change_plan", plan_id?: string) {
    const res = await fetch("/api/master-admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_uid: uid, action, plan_id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionMessage(data.error || "Action failed");
      return;
    }
    setActionMessage(action === "suspend" ? "Customer suspended." : action === "activate" ? "Customer activated." : "Plan updated.");
    await load(page);
  }

  async function impersonateCustomer(uid: string) {
    setActionMessage("");
    const res = await fetch(`/api/master-admin/customers/${uid}/impersonate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMessage(data.error || "Impersonation failed.");
      return;
    }
    window.location.href = data.redirectUrl || "/dashboard";
  }

  async function deleteCustomer(uid: string) {
    const res = await fetch(`/api/master-admin/customers/${uid}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMessage(data.error || "Delete failed.");
      return;
    }
    setConfirmDeleteUid(null);
    setActionMessage("Customer deleted.");
    await load(page);
  }

  async function runBulkAction() {
    if (!bulkAction || bulkAction === "none") return;
    if (bulkAction === "export") {
      exportCsv();
      setBulkAction("none");
      return;
    }
    if (selected.size === 0) {
      setActionMessage("Select at least one customer.");
      return;
    }
    if (bulkAction === "suspend") {
      for (const uid of selected) {
        await fetch("/api/master-admin/customers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_uid: uid, action: "suspend" }),
        });
      }
      setActionMessage(`Suspended ${selected.size} customer(s).`);
      setSelected(new Set());
      setBulkAction("none");
      await load(page);
    }
  }

  function exportCsv() {
    const header = [
      "Name",
      "Company",
      "Email",
      "Plan",
      "Status",
      "Projects",
      "Storage",
      "Bandwidth",
      "Revenue",
      "Last Login",
    ];
    const rows = customers.map((c) => [
      c.contact_name,
      c.company_name ?? "",
      c.email,
      planLabel(c.plan_id),
      c.status,
      c.product_count,
      fmtStorage(c.storage_used_mb),
      fmtBandwidth(c.bandwidth_used_mb),
      c.total_revenue,
      c.last_login_at ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "customers.csv";
    a.click();
  }

  const pageCustomers = customers;

  const allPageSelected =
    pageCustomers.length > 0 && pageCustomers.every((c) => selected.has(c.customer_uid));

  function toggleAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageCustomers.forEach((c) => next.delete(c.customer_uid));
      else pageCustomers.forEach((c) => next.add(c.customer_uid));
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setCompanyFilter("");
    setCountryFilter("all");
    setPlanFilter("all");
    setStatusFilter("all");
    setDateRange(defaultDateRange("all"));
    setPage(1);
  }

  const statCards: Array<{
    title: string;
    value: string;
    note: string;
    icon: typeof Users;
    accent: MetricAccent;
  }> = [
    {
      title: "Total Customers",
      value: String(summary?.total ?? 0),
      note: `${summary?.total ?? 0} registered`,
      icon: Users,
      accent: "sky",
    },
    {
      title: "Active Customers",
      value: String(summary?.active ?? 0),
      note: `${summary?.activePct ?? 0}% of total`,
      icon: UserCheck,
      accent: "emerald",
    },
    {
      title: "Trial Users",
      value: String(summary?.trial ?? 0),
      note: `${summary?.trialPct ?? 0}% of total`,
      icon: TrendingUp,
      accent: "amber",
    },
    {
      title: "Enterprise Users",
      value: String(summary?.enterprise ?? 0),
      note: `${summary?.enterprisePct ?? 0}% of total`,
      icon: Building2,
      accent: "violet",
    },
    {
      title: "Suspended Users",
      value: String(summary?.suspended ?? 0),
      note: `${summary?.suspendedPct ?? 0}% of total`,
      icon: UserX,
      accent: "rose",
    },
  ];

  const hasFilters = Boolean(
    search ||
      companyFilter ||
      countryFilter !== "all" ||
      planFilter !== "all" ||
      statusFilter !== "all" ||
      dateRange.preset !== "all",
  );

  const countryOptions = ["all", ...countries];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <UserPageHeader
        title="Customers"
        subtitle="Manage all registered users and their activity on AR360."
        highlighted
        actions={
          <>
            <button type="button" onClick={exportCsv} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <Download size={15} />
              Export
            </button>
            <button type="button" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <Upload size={15} />
              Import
            </button>
            <button type="button" className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Plus size={15} strokeWidth={2.2} />
              Add Customer
            </button>
          </>
        }
      />

      {actionMessage ? (
        <div className="dash-premium-card flex items-center justify-between gap-3 border-[#DCFCE7] bg-[#F0FDF4] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#166534]">{actionMessage}</p>
          <button
            type="button"
            onClick={() => setActionMessage("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#166534] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <UserMetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            note={card.note}
            icon={card.icon}
            accent={card.accent}
            compact
          />
        ))}
      </section>

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
          <div className="relative min-w-[200px] flex-1 basis-[220px] max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <input
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            placeholder="Company"
            className="h-10 w-[140px] shrink-0 rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400]"
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Country"
            menuTitle="Country"
            value={countryFilter}
            options={countryOptions}
            onChange={setCountryFilter}
            renderOption={(value) => (value === "all" ? "All Countries" : value)}
            renderValue={(value) => (value === "all" ? "All Countries" : value)}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Plan"
            menuTitle="Plan"
            value={planFilter}
            options={PLAN_FILTER_OPTIONS}
            onChange={setPlanFilter}
            renderOption={(value) => (value === "all" ? "All Plans" : planLabel(value))}
            renderValue={(value) => (value === "all" ? "All Plans" : planLabel(value))}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Status"
            menuTitle="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatusFilter}
            renderOption={(value) => (value === "all" ? "All Status" : value)}
            renderValue={(value) => (value === "all" ? "All Status" : value)}
          />

          <UserDateRangePicker value={dateRange} onChange={setDateRange} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <UserFilterDropdown
              hideLabel
              compact
              className="w-[150px] shrink-0"
              label="Bulk"
              menuTitle="Bulk actions"
              value={bulkAction}
              options={BULK_OPTIONS}
              onChange={setBulkAction}
              renderOption={(value) =>
                ({ none: "Bulk actions", suspend: "Suspend Selected", export: "Export Page" } as Record<
                  string,
                  string
                >)[value] || value
              }
              renderValue={(value) =>
                ({ none: "Bulk actions", suspend: "Suspend Selected", export: "Export Page" } as Record<
                  string,
                  string
                >)[value] || value
              }
            />
            <button
              type="button"
              onClick={() => void runBulkAction()}
              disabled={bulkAction === "none" || (bulkAction !== "export" && selected.size === 0)}
              className="inline-flex h-10 shrink-0 items-center rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#111827] transition hover:bg-[#FAFAFB] disabled:opacity-40"
            >
              Apply{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-10 shrink-0 items-center rounded-[14px] px-3 text-[12px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <AdminLoadingState label="Loading customers..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAllPage}
                      className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                    />
                  </th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Projects</th>
                  <th className="px-3 py-3">Storage</th>
                  <th className="px-3 py-3">Bandwidth</th>
                  <th className="px-3 py-3">Revenue</th>
                  <th className="px-3 py-3">Last Login</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="w-40 px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageCustomers.map((c) => {
                  const login = fmtDateTime(c.last_login_at);
                  const actionItems = [
                    {
                      label: "View",
                      icon: <Eye size={15} />,
                      onClick: () => router.push(`/master-admin/customers/${c.customer_uid}`),
                    },
                    {
                      label: "Login As User",
                      icon: <LogIn size={15} />,
                      onClick: () => void impersonateCustomer(c.customer_uid),
                    },
                    {
                      label: "Upgrade",
                      onClick: () => router.push(`/master-admin/customers/${c.customer_uid}/billing`),
                    },
                    c.status === "Active"
                      ? {
                          label: "Suspend",
                          icon: <UserMinus size={15} />,
                          onClick: () => doAction(c.customer_uid, "suspend"),
                          isDangerous: true,
                        }
                      : {
                          label: "Activate",
                          onClick: () => doAction(c.customer_uid, "activate"),
                        },
                    {
                      label: "Delete",
                      isDangerous: true,
                      onClick: () => setConfirmDeleteUid(c.customer_uid),
                    },
                  ];

                  return (
                    <tr
                      key={c.customer_uid}
                      className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.customer_uid)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.customer_uid)) next.delete(c.customer_uid);
                              else next.add(c.customer_uid);
                              return next;
                            })
                          }
                          className="h-4 w-4 rounded border-[#D1D5DB] accent-[#84D400]"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <CustomerAvatar name={c.contact_name} seed={c.customer_uid} size="sm" />
                          <div className="min-w-0">
                            <Link
                              href={`/master-admin/customers/${c.customer_uid}`}
                              className="block truncate text-[13px] font-bold text-[#111827] transition hover:text-[#5AA700]"
                            >
                              {c.contact_name}
                            </Link>
                            <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {c.company_name || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <PlanBadge planId={c.plan_id} />
                      </td>
                      <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">{c.product_count}</td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {fmtStorage(c.storage_used_mb)}
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {fmtBandwidth(c.bandwidth_used_mb)}
                      </td>
                      <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">
                        {fmtRevenue(c.total_revenue)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[12px] font-semibold text-[#374151]">{login.date}</p>
                        <p className="text-[11px] font-medium text-[#9CA3AF]">{login.time}</p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge label={c.status} domain="customer" value={c.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-0.5">
                          <Link
                            href={`/master-admin/customers/${c.customer_uid}`}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            title="View"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void impersonateCustomer(c.customer_uid)}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-emerald-50 hover:text-emerald-700"
                            title="Login As User"
                          >
                            <LogIn size={15} />
                          </button>
                          <Link
                            href={`/master-admin/customers/${c.customer_uid}/billing`}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            title="Upgrade"
                          >
                            <ArrowUpCircle size={15} />
                          </Link>
                          {c.status === "Active" ? (
                            <button
                              type="button"
                              onClick={() => doAction(c.customer_uid, "suspend")}
                              className="grid h-8 w-8 place-items-center rounded-[10px] text-amber-600 transition hover:bg-amber-50"
                              title="Suspend"
                            >
                              <UserMinus size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => doAction(c.customer_uid, "activate")}
                              className="grid h-8 w-8 place-items-center rounded-[10px] text-emerald-600 transition hover:bg-emerald-50"
                              title="Activate"
                            >
                              <UserCheck size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUid(c.customer_uid)}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-red-500 transition hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                          <AdminActionMenu items={actionItems} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pageCustomers.length === 0 && (
                  <tr>
                    <td colSpan={11}>
                      <AdminEmptyState title="No customers found." />
                    </td>
                  </tr>
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
            onPageChange={setPage}
          />
        </div>
      </section>

      <ConfirmModal
        open={!!confirmDeleteUid}
        title="Delete customer?"
        description="This soft-deletes the customer account and cancels active subscriptions. Products remain on disk."
        confirmText="Delete"
        danger
        onCancel={() => setConfirmDeleteUid(null)}
        onConfirm={() => {
          if (confirmDeleteUid) void deleteCustomer(confirmDeleteUid);
        }}
      />
    </div>
  );
}
