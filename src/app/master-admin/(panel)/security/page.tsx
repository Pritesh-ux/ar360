"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  AlertTriangle,
  Lock,
  Unlock,
  Ban,
  KeyRound,
  MonitorSmartphone,
  X,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Search,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";
import ViewportPortal from "@/components/shared/ViewportPortal";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import { AdminEmptyState } from "@/components/ui/admin";

type SecurityStatus = "Safe" | "Suspicious" | "Blocked" | "Locked";

type SecurityUser = {
  id: string;
  customer: string;
  email: string;
  plan: string;
  status: SecurityStatus;
  failedLogins: number;
  activeSessions: number;
  lastIp: string;
  lastDevice: string;
  lastLocation: string;
  twoFA: boolean;
  apiKeys: number;
  lastLogin: string;
  risk: "Low" | "Medium" | "High";
};

export default function SecurityPage() {
  const [users, setUsers] = useState<SecurityUser[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/master-admin/live?kind=security", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((data) => setUsers(Array.isArray(data.rows) ? data.rows : []))
      .catch((error) => {
        if (error?.name !== "AbortError") console.error(error);
      });
    return () => controller.abort();
  }, []);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SecurityUser | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.customer.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.plan.toLowerCase().includes(q) ||
      u.status.toLowerCase().includes(q) ||
      u.lastIp.toLowerCase().includes(q) ||
      u.risk.toLowerCase().includes(q)
    );
  });

  const failedToday = users.reduce((sum, u) => sum + u.failedLogins, 0);
  const lockedAccounts = users.filter((u) => u.status === "Locked").length;
  const blockedAccounts = users.filter((u) => u.status === "Blocked").length;
  const suspiciousUsers = users.filter((u) => u.status === "Suspicious").length;

  function statusClass(status: SecurityStatus) {
    if (status === "Safe") return "bg-green-50 text-green-700";
    if (status === "Suspicious") return "bg-yellow-50 text-yellow-700";
    return "bg-red-50 text-red-700";
  }

  function riskClass(risk: SecurityUser["risk"]) {
    if (risk === "Low") return "bg-green-50 text-green-700";
    if (risk === "Medium") return "bg-yellow-50 text-yellow-700";
    return "bg-red-50 text-red-700";
  }

  async function callSecurityAction(customerUid: string, action: string, optimistic?: Partial<SecurityUser>) {
    if (optimistic) {
      setUsers((prev) => prev.map((u) => (u.id === customerUid ? { ...u, ...optimistic } : u)));
    }
    try {
      const res = await fetch("/api/master-admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, customerUid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Action failed");
      }
    } catch {
      setUsers((prev) => prev);
    }
  }

  function changeStatus(id: string, status: SecurityStatus) {
    const optimistic: Partial<SecurityUser> = {
      status,
      activeSessions: status === "Blocked" || status === "Locked" ? 0 : undefined,
      risk: status === "Safe" ? "Low" : status === "Suspicious" ? "High" : undefined,
    };
    const apiAction = status === "Safe" ? "unlock" : status === "Locked" ? "lock" : "block";
    void callSecurityAction(id, apiAction, optimistic);
  }

  function forceLogout(id: string) {
    void callSecurityAction(id, "force_logout", { activeSessions: 0 });
  }

  function resetFailedLogins(id: string) {
    void callSecurityAction(id, "reset_failed_logins", { failedLogins: 0, risk: "Low" });
  }

  function toggle2FA(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    void callSecurityAction(id, "toggle_2fa", { twoFA: !user.twoFA });
  }

  function revokeApiKeys(id: string) {
    void callSecurityAction(id, "revoke_api_keys", { apiKeys: 0 });
    setConfirmRevokeId(null);
  }

  function exportCsv(start?: string, end?: string) {
    const itemsToExport = (start || end)
      ? filtered.filter((u) => isWithinDateRange(u.lastLogin, start || "", end || ""))
      : filtered;

    const header = [
      "Customer",
      "Email",
      "Plan",
      "Status",
      "Risk",
      "Failed Logins",
      "Active Sessions",
      "Last IP",
      "Device",
      "Location",
      "2FA",
      "API Keys",
      "Last Login",
    ];

    const rows = itemsToExport.map((u) => [
      u.customer,
      u.email,
      u.plan,
      u.status,
      u.risk,
      u.failedLogins,
      u.activeSessions,
      u.lastIp,
      u.lastDevice,
      u.lastLocation,
      u.twoFA ? "Enabled" : "Disabled",
      u.apiKeys,
      u.lastLogin,
    ]);

    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "security-report.csv";
    a.click();

    URL.revokeObjectURL(url);
    setIsExportOpen(false);
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Security Center"
        subtitle="Manage login limits, locked accounts, suspicious users, 2FA, sessions and API keys."
        actions={
          <button type="button" onClick={() => setIsExportOpen(true)} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
            <Download size={15} />
            Export Security Report
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UserMetricCard title="Failed Logins" value={String(failedToday)} icon={AlertTriangle} accent="amber" compact />
        <UserMetricCard title="Suspicious" value={String(suspiciousUsers)} icon={Shield} accent="rose" compact />
        <UserMetricCard title="Locked Accounts" value={String(lockedAccounts)} icon={Lock} accent="violet" compact />
        <UserMetricCard title="Blocked Users" value={String(blockedAccounts)} icon={Ban} accent="sky" compact />
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
              placeholder="Search customer, IP, risk, status..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <div className="ml-auto rounded-[12px] bg-[#FAFAFB] px-3 py-2 text-[11px] font-semibold text-[#6B7280]">
            Login Limit: 5 failed attempts → 30 min lock
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Risk</th>
                <th className="px-3 py-3">Failed</th>
                <th className="px-3 py-3">Sessions</th>
                <th className="px-3 py-3">Last IP</th>
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">2FA</th>
                <th className="px-3 py-3">API Keys</th>
                <th className="w-24 px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <AdminEmptyState title="No security records match your search." />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const actionItems = [
                    {
                      label: "Unlock / Mark Safe",
                      icon: <Unlock size={15} />,
                      onClick: () => changeStatus(u.id, "Safe"),
                    },
                    {
                      label: "Lock Account",
                      icon: <Lock size={15} />,
                      onClick: () => changeStatus(u.id, "Locked"),
                      isDangerous: true,
                    },
                    {
                      label: "Block Customer",
                      icon: <Ban size={15} />,
                      onClick: () => changeStatus(u.id, "Blocked"),
                      isDangerous: true,
                    },
                    {
                      label: "Force Logout",
                      icon: <MonitorSmartphone size={15} />,
                      onClick: () => forceLogout(u.id),
                    },
                    {
                      label: "Reset Failed Logins",
                      icon: <Shield size={15} />,
                      onClick: () => resetFailedLogins(u.id),
                    },
                    {
                      label: "Toggle 2FA",
                      icon: <KeyRound size={15} />,
                      onClick: () => toggle2FA(u.id),
                    },
                    {
                      label: "Revoke API Keys",
                      icon: <KeyRound size={15} />,
                      onClick: () => setConfirmRevokeId(u.id),
                      isDangerous: true,
                    },
                  ];

                  return (
                    <tr key={u.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-bold text-[#111827]">{u.customer}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{u.email}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{u.plan}</div>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(u.status)}`}>
                          {u.status}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${riskClass(u.risk)}`}>
                          {u.risk}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">{u.failedLogins}</td>
                      <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">{u.activeSessions}</td>

                      <td className="px-3 py-3">
                        <div className="text-[12px] font-semibold text-[#374151]">{u.lastIp}</div>
                        <div className="text-[11px] font-medium text-[#9CA3AF]">{u.lastLocation}</div>
                      </td>

                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{u.lastDevice}</td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${
                            u.twoFA ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {u.twoFA ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {u.twoFA ? "On" : "Off"}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-[12px] font-bold text-[#111827]">{u.apiKeys}</td>

                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelected(u)}
                            className="grid h-8 w-8 place-items-center rounded-[10px] text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          <AdminActionMenu items={actionItems} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmRevokeId && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">Revoke API Keys?</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 md:text-sm">
                  This will remove all API keys for this customer.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setConfirmRevokeId(null)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => revokeApiKeys(confirmRevokeId)}
                className="flex-1 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-600"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
        </ViewportPortal>
      )}

      {selected && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Security Details</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 md:text-sm">
                  {selected.customer} • {selected.email}
                </p>
              </div>

              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              {[
                ["Customer", selected.customer],
                ["Email", selected.email],
                ["Plan", selected.plan],
                ["Status", selected.status],
                ["Risk Level", selected.risk],
                ["Failed Logins", selected.failedLogins],
                ["Active Sessions", selected.activeSessions],
                ["Last IP", selected.lastIp],
                ["Device", selected.lastDevice],
                ["Location", selected.lastLocation],
                ["2FA", selected.twoFA ? "Enabled" : "Disabled"],
                ["API Keys", selected.apiKeys],
                ["Last Login", selected.lastLogin],
                ["Login Rule", "5 failed attempts → 30 min lock"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)]"
            >
              Done
            </button>
          </div>
        </div>
        </ViewportPortal>
      )}
      <ExportDateModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={exportCsv}
        title="Export Security Report"
      />
    </div>
  );
}
