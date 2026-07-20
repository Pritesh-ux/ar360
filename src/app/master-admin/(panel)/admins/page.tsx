"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  RefreshCw,
  Shield,
  UserCog,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import AdminTable from "@/components/features/master-admin/AdminTable";
import AdminStatCard from "@/components/features/master-admin/AdminStatCard";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminActionMessage, AdminPagination } from "@/components/ui/admin";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import { paginationRange, type PaginationMeta } from "@/lib/master-admin/pagination";

type AdminRow = {
  id: number;
  adminUid: string | null;
  name: string;
  email: string;
  status: "Active" | "Disabled";
  roleId: number | null;
  roleCode: string | null;
  roleName: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type Role = {
  id: number;
  code: string;
  name: string;
  description: string;
};

type Summary = {
  total: number;
  active: number;
  disabled: number;
  recentLogins: number;
};

const PAGE_SIZE = 15;

function statusClass(status: string) {
  return status === "Active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200";
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [roleId, setRoleId] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [pendingToggle, setPendingToggle] = useState<AdminRow | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (roleId !== "all") params.set("roleId", roleId);

    try {
      const response = await fetch(`/api/master-admin/admins?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load admins");
      setAdmins(data.admins || []);
      setRoles(data.roles || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination(data.pagination);
        setPage(data.pagination.page);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roleId]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }

  async function updateAdmin(admin: AdminRow, patch: { status?: "Active" | "Disabled"; roleId?: number | null }) {
    setSavingId(admin.id);
    setMessage("");
    try {
      const response = await fetch(`/api/master-admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed");
      setMessage(`Updated ${admin.name}.`);
      await load(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSavingId(null);
      setPendingToggle(null);
    }
  }

  const range = paginationRange(pagination);

  return (
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader
        title="Admin Management"
        subtitle="Manage master admin accounts, roles, and access status."
        actions={
          <button
            onClick={() => load(page)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {message && <AdminActionMessage message={message} />}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard title="Total Admins" value={summary?.total ?? 0} icon={<Users className="text-slate-950" size={22} />} />
        <AdminStatCard title="Active" value={summary?.active ?? 0} icon={<UserCheck className="text-emerald-600" size={22} />} />
        <AdminStatCard title="Disabled" value={summary?.disabled ?? 0} icon={<UserX className="text-red-500" size={22} />} />
        <AdminStatCard title="Recent Logins (7d)" value={summary?.recentLogins ?? 0} icon={<UserCog className="text-blue-600" size={22} />} />
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <AdminSearch value={search} onChange={setSearch} placeholder="Search name, email, UID..." />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={status}
              onChange={setStatus}
              options={[
                { label: "All Status", value: "all" },
                { label: "Active", value: "active" },
                { label: "Disabled", value: "disabled" },
              ]}
            />
            <FilterSelect
              value={roleId}
              onChange={setRoleId}
              options={[
                { label: "All Roles", value: "all" },
                ...roles.map((r) => ({ label: r.name, value: String(r.id) })),
              ]}
            />
            <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Apply</button>
          </div>
        </form>

        <AdminTable headers={["Admin", "Role", "Status", "Last Login", "Created", "Actions"]} alignRightIndex={[5]}>
          {loading ? (
            <tr><td colSpan={6} className="p-8 text-center text-sm font-semibold text-slate-500">Loading admins…</td></tr>
          ) : admins.length === 0 ? (
            <tr><td colSpan={6} className="p-8 text-center text-sm font-semibold text-slate-500">No admins found.</td></tr>
          ) : admins.map((admin) => (
            <tr key={admin.id} className="align-middle">
              <td className="p-3 md:p-4">
                <div className="font-black text-slate-950">{admin.name}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{admin.email}</div>
              </td>
              <td className="p-3 md:p-4">
                <div className="relative inline-block">
                  <select
                    value={admin.roleId ?? ""}
                    disabled={savingId === admin.id}
                    onChange={(e) => updateAdmin(admin, { roleId: e.target.value ? Number(e.target.value) : null })}
                    className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-bold text-slate-700 disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </td>
              <td className="p-3 md:p-4">
                <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass(admin.status)}`}>
                  {admin.status}
                </span>
              </td>
              <td className="p-3 font-bold md:p-4 text-slate-600">{fmtDateTime(admin.lastLoginAt)}</td>
              <td className="p-3 font-bold md:p-4 text-slate-600">{fmtDateTime(admin.createdAt)}</td>
              <td className="p-3 md:p-4 text-right">
                <button
                  disabled={savingId === admin.id}
                  onClick={() => setPendingToggle(admin)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {admin.status === "Active" ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </AdminTable>

        <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={(p) => load(p)} />
      </section>

      <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex items-start gap-2">
          <Shield size={16} className="mt-0.5 shrink-0 text-slate-500" />
          <p>
            Role changes take effect on the admin&apos;s next request. Creating new admin accounts requires database setup or a dedicated invite flow (not included here).
          </p>
        </div>
      </div>

      {pendingToggle && (
        <ConfirmModal
          open={Boolean(pendingToggle)}
          title={pendingToggle.status === "Active" ? "Disable admin?" : "Enable admin?"}
          description={
            pendingToggle.status === "Active"
              ? `${pendingToggle.name} will lose access immediately.`
              : `${pendingToggle.name} will regain access on next login.`
          }
          confirmText={pendingToggle.status === "Active" ? "Disable" : "Enable"}
          danger={pendingToggle.status === "Active"}
          onConfirm={() =>
            updateAdmin(pendingToggle, {
              status: pendingToggle.status === "Active" ? "Disabled" : "Active",
            })
          }
          onCancel={() => setPendingToggle(null)}
        />
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
