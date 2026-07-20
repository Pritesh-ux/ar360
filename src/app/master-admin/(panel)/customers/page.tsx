"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  Building2,
  ChevronDown,
  Download,
  Eye,
  Filter,
  LogIn,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import CustomerAvatar from "@/components/features/master-admin/CustomerAvatar";
import PlanBadge from "@/components/features/master-admin/PlanBadge";
import {
  AdminButton,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminLoadingState,
  AdminMetricCard,
  AdminPagination,
  AdminActionMessage,
  AdminBulkActions,
  AdminSelect,
  AdminTablePanel,
  StatusBadge,
} from "@/components/ui/admin";
import {
  fmtBandwidth,
  fmtDateTime,
  fmtRevenue,
  fmtStorage,
  planLabel,
} from "@/components/features/master-admin/customers-utils";
import { type PaginationMeta } from "@/lib/master-admin/pagination";

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
  const [countryFilter, setCountryFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState("");
  const [bulkAction, setBulkAction] = useState("");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
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
      if (countryFilter) params.set("country", countryFilter);
      if (planFilter) params.set("plan", planFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (signupFrom) params.set("signupFrom", signupFrom);
      if (signupTo) params.set("signupTo", signupTo);

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

  useEffect(() => {
    setPage(1);
  }, [search, companyFilter, countryFilter, planFilter, statusFilter, signupFrom, signupTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, companyFilter, countryFilter, planFilter, statusFilter, signupFrom, signupTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!bulkAction) return;
    if (bulkAction === "export") {
      exportCsv();
      setBulkAction("");
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
      setBulkAction("");
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
    setCountryFilter("");
    setPlanFilter("");
    setStatusFilter("");
    setSignupFrom("");
    setSignupTo("");
    setPage(1);
  }

  const statCards = [
    {
      title: "Total Customers",
      value: summary?.total ?? 0,
      note: "+12.5% vs last month",
      icon: Users,
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      title: "Active Customers",
      value: summary?.active ?? 0,
      note: `${summary?.activePct ?? 0}% of total`,
      icon: UserCheck,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Trial Users",
      value: summary?.trial ?? 0,
      note: `${summary?.trialPct ?? 0}% of total`,
      icon: TrendingUp,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Enterprise Users",
      value: summary?.enterprise ?? 0,
      note: `${summary?.enterprisePct ?? 0}% of total`,
      icon: Building2,
      iconBg: "bg-violet-50 text-violet-600",
    },
    {
      title: "Suspended Users",
      value: summary?.suspended ?? 0,
      note: `${summary?.suspendedPct ?? 0}% of total`,
      icon: UserX,
      iconBg: "bg-red-50 text-red-500",
    },
  ];

  return (
    <div className="master-admin-panel space-y-5">
      <AdminPageHeader
        title="Customers"
        subtitle="Manage all registered users and their activity on AR360."
        actions={
          <>
            <AdminButton onClick={exportCsv}>
              <Download size={16} />
              Export
              <ChevronDown size={14} className="text-slate-400" />
            </AdminButton>
            <AdminButton>
              <Upload size={16} />
              Import
            </AdminButton>
            <AdminButton variant="primary">
              <Plus size={16} />
              Add New Customer
            </AdminButton>
          </>
        }
      />

      {actionMessage ? <AdminActionMessage message={actionMessage} variant="success" /> : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <AdminMetricCard
            key={card.title}
            layout="compact"
            title={card.title}
            value={card.value}
            note={card.note}
            iconComponent={card.icon}
            iconClassName={card.iconBg}
          />
        ))}
      </section>

      <AdminTablePanel>
        <AdminFilterBar onClear={clearFilters}>
          <AdminInput
            soft
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="min-w-[200px] flex-1"
          />
          <AdminInput
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            placeholder="Company"
            className="min-w-[130px]"
          />
          <AdminSelect
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="min-w-[130px]"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="">All Plans</option>
            {["trial", "free", "basic", "professional", "enterprise"].map((p) => (
              <option key={p} value={p}>
                {planLabel(p)}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </AdminSelect>
          <AdminBulkActions
            value={bulkAction}
            onChange={setBulkAction}
            selectedCount={selected.size}
            onApply={() => void runBulkAction()}
            requireSelection={bulkAction !== "export"}
            options={[
              { value: "suspend", label: "Suspend Selected" },
              { value: "export", label: "Export Page" },
            ]}
          />
          <AdminButton
            size="sm"
            variant={moreFiltersOpen ? "primary" : "secondary"}
            onClick={() => setMoreFiltersOpen((open) => !open)}
          >
            <Filter size={15} />
            More Filters
          </AdminButton>
        </AdminFilterBar>

        {moreFiltersOpen && (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <AdminInput
                type="date"
                value={signupFrom}
                onChange={(e) => setSignupFrom(e.target.value)}
                className="text-[12px]"
                title="Signup from"
              />
              <span className="text-[12px] font-semibold text-slate-400">to</span>
              <AdminInput
                type="date"
                value={signupTo}
                onChange={(e) => setSignupTo(e.target.value)}
                className="text-[12px]"
                title="Signup to"
              />
            </div>
            <AdminButton
              size="sm"
              variant="ghost"
              onClick={() => {
                setSignupFrom("");
                setSignupTo("");
              }}
            >
              Clear extra filters
            </AdminButton>
          </div>
        )}

        {loading ? (
          <AdminLoadingState label="Loading customers..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="w-10 p-3">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} />
                  </th>
                  <th className="p-3">Avatar</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Current Plan</th>
                  <th className="p-3">Projects</th>
                  <th className="p-3">Storage</th>
                  <th className="p-3">Bandwidth</th>
                  <th className="p-3">Revenue</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3">Status</th>
                  <th className="w-36 p-3">Actions</th>
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
                    <tr key={c.customer_uid} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                      <td className="p-3">
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
                        />
                      </td>
                      <td className="p-3">
                        <CustomerAvatar name={c.contact_name} seed={c.customer_uid} size="sm" />
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/master-admin/customers/${c.customer_uid}`}
                          className="text-[13px] font-bold text-slate-900 hover:text-[#4D9A00]"
                        >
                          {c.contact_name}
                        </Link>
                      </td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{c.company_name || "—"}</td>
                      <td className="p-3 text-[12px] font-medium text-slate-500">{c.email}</td>
                      <td className="p-3">
                        <PlanBadge planId={c.plan_id} />
                      </td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{c.product_count}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{fmtStorage(c.storage_used_mb)}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{fmtBandwidth(c.bandwidth_used_mb)}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-900">{fmtRevenue(c.total_revenue)}</td>
                      <td className="p-3">
                        <p className="text-[12px] font-semibold text-slate-700">{login.date}</p>
                        <p className="text-[11px] font-medium text-slate-400">{login.time}</p>
                      </td>
                      <td className="p-3">
                        <StatusBadge label={c.status} domain="customer" value={c.status} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-0.5">
                          <Link
                            href={`/master-admin/customers/${c.customer_uid}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            title="View"
                          >
                            <Eye size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void impersonateCustomer(c.customer_uid)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Login As User"
                          >
                            <LogIn size={15} />
                          </button>
                          <Link
                            href={`/master-admin/customers/${c.customer_uid}/billing`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                            title="Upgrade"
                          >
                            <ArrowUpCircle size={15} />
                          </Link>
                          {c.status === "Active" ? (
                            <button
                              type="button"
                              onClick={() => doAction(c.customer_uid, "suspend")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-50"
                              title="Suspend"
                            >
                              <UserMinus size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => doAction(c.customer_uid, "activate")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                              title="Activate"
                            >
                              <UserCheck size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUid(c.customer_uid)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
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
                    <td colSpan={13}>
                      <AdminEmptyState title="No customers found." />
                    </td>
                  </tr>
                )}
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
