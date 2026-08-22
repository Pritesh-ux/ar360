"use client";

import { useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCog,
  Users,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import ViewportPortal from "@/components/shared/ViewportPortal";
import { AdminEmptyState, AdminLoadingState, AdminPagination } from "@/components/ui/admin";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";
import type { PaginationMeta } from "@/lib/master-admin/pagination";

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
const STATUS_OPTIONS = ["all", "active", "disabled"];

function statusClass(status: string) {
  return status === "Active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-red-50 text-red-700 ring-red-200";
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
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [pendingToggle, setPendingToggle] = useState<AdminRow | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState<string>("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const roleOptions = ["all", ...roles.map((r) => String(r.id))];

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

  useDeferredEffect(() => {
    load(1);
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

  async function inviteAdmin() {
    setInviteLoading(true);
    setInviteError("");
    try {
      const res = await fetch("/api/master-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          password: invitePassword,
          roleId: inviteRoleId ? Number(inviteRoleId) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin");
      setMessage(`Admin "${inviteName}" created successfully.`);
      setShowInvite(false);
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      setInviteRoleId("");
      await load(page);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to create admin");
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Admin Management"
        subtitle="Manage master admin accounts, roles, and access status."
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="dash-premium-btn-primary h-10 px-4 text-[12px]"
            >
              <Plus size={15} strokeWidth={2.2} />
              Invite Admin
            </button>
            <button
              type="button"
              onClick={() => load(page)}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </>
        }
      />

      {message ? (
        <div className="dash-premium-card flex items-center justify-between gap-3 border-[#DCFCE7] bg-[#F0FDF4] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#166534]">{message}</p>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#166534] hover:bg-white/70"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UserMetricCard title="Total Admins" value={String(summary?.total ?? 0)} icon={Users} accent="sky" compact />
        <UserMetricCard title="Active" value={String(summary?.active ?? 0)} icon={UserCheck} accent="emerald" compact />
        <UserMetricCard title="Disabled" value={String(summary?.disabled ?? 0)} icon={UserX} accent="rose" compact />
        <UserMetricCard
          title="Recent Logins (7d)"
          value={String(summary?.recentLogins ?? 0)}
          icon={UserCog}
          accent="violet"
          compact
        />
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
              placeholder="Search name, email, UID..."
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
            options={STATUS_OPTIONS}
            onChange={setStatus}
            renderOption={(value) =>
              ({ all: "All Status", active: "Active", disabled: "Disabled" } as Record<string, string>)[value] || value
            }
            renderValue={(value) =>
              ({ all: "All Status", active: "Active", disabled: "Disabled" } as Record<string, string>)[value] || value
            }
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[148px] shrink-0"
            label="Role"
            menuTitle="Role"
            value={roleId}
            options={roleOptions}
            onChange={setRoleId}
            renderOption={(value) =>
              value === "all" ? "All Roles" : roles.find((r) => String(r.id) === value)?.name || value
            }
            renderValue={(value) =>
              value === "all" ? "All Roles" : roles.find((r) => String(r.id) === value)?.name || value
            }
          />

          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#111827] transition hover:bg-[#FAFAFB]"
          >
            Apply
          </button>
        </form>

        {loading ? (
          <AdminLoadingState label="Loading admins..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-3 py-3">Admin</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Last Login</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="w-28 px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <AdminEmptyState title="No admins found." />
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-bold text-[#111827]">{admin.name}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{admin.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <UserFilterDropdown
                          hideLabel
                          compact
                          disabled={savingId === admin.id}
                          className="w-[180px]"
                          menuWidth={220}
                          label="Role"
                          menuTitle="Role"
                          value={admin.roleId != null ? String(admin.roleId) : "none"}
                          options={["none", ...roles.map((role) => String(role.id))]}
                          onChange={(value) =>
                            updateAdmin(admin, { roleId: value === "none" ? null : Number(value) })
                          }
                          renderOption={(value) =>
                            value === "none"
                              ? "Unassigned"
                              : roles.find((role) => String(role.id) === value)?.name || value
                          }
                          renderValue={(value) =>
                            value === "none"
                              ? "Unassigned"
                              : roles.find((role) => String(role.id) === value)?.name || value
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 ${statusClass(admin.status)}`}>
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {fmtDateTime(admin.lastLoginAt)}
                      </td>
                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">
                        {fmtDateTime(admin.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          disabled={savingId === admin.id}
                          onClick={() => setPendingToggle(admin)}
                          className="inline-flex h-9 items-center rounded-[12px] border border-[#ECECEC] px-3 text-[12px] font-semibold text-[#374151] transition hover:bg-[#FAFAFB] disabled:opacity-50"
                        >
                          {admin.status === "Active" ? "Disable" : "Enable"}
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

      <div className="dash-premium-card flex items-start gap-2 px-4 py-3 text-[13px] text-[#667085]">
        <Shield size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
        <p>Role changes take effect on the admin&apos;s next request. New admins can be invited from the button above.</p>
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

      {showInvite && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-950">Invite New Admin</h2>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            {inviteError && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[12px] font-bold text-red-600">{inviteError}</div>
            )}

            <div className="grid gap-3">
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Full name"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
              />
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
              />
              <input
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                type="password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20"
              />
              <UserFilterDropdown
                label="Role"
                menuTitle="Role"
                className="w-full"
                menuWidth={360}
                value={inviteRoleId || "none"}
                options={["none", ...roles.map((r) => String(r.id))]}
                onChange={(value) => setInviteRoleId(value === "none" ? "" : value)}
                renderOption={(value) =>
                  value === "none"
                    ? "No role (unassigned)"
                    : roles.find((r) => String(r.id) === value)?.name || value
                }
                renderValue={(value) =>
                  value === "none"
                    ? "No role (unassigned)"
                    : roles.find((r) => String(r.id) === value)?.name || value
                }
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void inviteAdmin()}
                disabled={inviteLoading || !inviteName.trim() || !inviteEmail.trim() || !invitePassword.trim()}
                className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {inviteLoading ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}
    </div>
  );
}
