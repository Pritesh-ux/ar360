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
} from "lucide-react";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import AdminTable from "@/components/features/master-admin/AdminTable";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";

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
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((data) => setUsers(Array.isArray(data.rows) ? data.rows : []))
      .catch((error) => { if (error?.name !== "AbortError") console.error(error); });
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
    // Locked and Blocked are soft red
    return "bg-red-50 text-red-700";
  }

  function riskClass(risk: SecurityUser["risk"]) {
    if (risk === "Low") return "bg-green-50 text-green-700";
    if (risk === "Medium") return "bg-yellow-50 text-yellow-700";
    return "bg-red-50 text-red-700";
  }

  function changeStatus(id: string, status: SecurityStatus) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              status,
              activeSessions:
                status === "Blocked" || status === "Locked"
                  ? 0
                  : u.activeSessions,
              risk:
                status === "Safe"
                  ? "Low"
                  : status === "Suspicious"
                    ? "High"
                    : u.risk,
            }
          : u
      )
    );
  }

  function forceLogout(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, activeSessions: 0 } : u))
    );
  }

  function resetFailedLogins(id: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              failedLogins: 0,
              status: u.status === "Locked" ? "Safe" : u.status,
              risk: "Low",
            }
          : u
      )
    );
  }

  function toggle2FA(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, twoFA: !u.twoFA } : u))
    );
  }

  function revokeApiKeys(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, apiKeys: 0 } : u))
    );
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

    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

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
    <div className="min-h-full p-4 md:p-6 2xl:p-8 pb-10 md:pb-12">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-[32px]">
            Security Center
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Manage login limits, locked accounts, suspicious users, 2FA, sessions and API keys.
          </p>
        </div>

        <button
          onClick={() => setIsExportOpen(true)}
          className="inline-flex items-center gap-2 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <X className="rotate-45" size={18} />
          Export Security Report
        </button>
      </div>

      {/* Spacing improved, 20px card radius, soft shadow, no heavy border, lime icons on soft lime circles */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:gap-5">
        {[
          { label: "Failed Logins", value: failedToday, icon: <AlertTriangle size={20} /> },
          { label: "Suspicious", value: suspiciousUsers, icon: <Shield size={20} /> },
          { label: "Locked Accounts", value: lockedAccounts, icon: <Lock size={20} /> },
          { label: "Blocked Users", value: blockedAccounts, icon: <Ban size={20} /> },
        ].map((card, idx) => (
          <div key={idx} className="rounded-[20px] border border-slate-200/60 bg-white p-5 shadow-[0_4px_14px_rgba(5,7,6,0.03)] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500">{card.label}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#A6FF2E]/10 text-slate-800">
                {card.icon}
              </div>
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
              {card.value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[20px] border border-slate-200/60 bg-white p-4 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <AdminSearch
            value={search}
            onChange={setSearch}
            placeholder="Search customer, IP, risk, status..."
          />

          <div className="rounded-[14px] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
            Login Limit: 5 failed attempts → 30 min lock
          </div>
        </div>

        <AdminTable headers={["Customer", "Status", "Risk", "Failed", "Sessions", "Last IP", "Device", "2FA", "API Keys", "Action"]} alignRightIndex={[9]}>
          {filtered.map((u) => {
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
              <tr key={u.id} className="align-middle">
                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-950">{u.customer}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{u.email}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">{u.plan}</div>
                </td>

                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(u.status)}`}>
                    {u.status}
                  </span>
                </td>

                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${riskClass(u.risk)}`}>
                    {u.risk}
                  </span>
                </td>

                <td className="p-3 font-black md:p-4">{u.failedLogins}</td>
                <td className="p-3 font-black md:p-4">{u.activeSessions}</td>

                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-900">{u.lastIp}</div>
                  <div className="text-xs font-semibold text-slate-500">{u.lastLocation}</div>
                </td>

                <td className="p-3 font-bold md:p-4 text-slate-600">{u.lastDevice}</td>

                <td className="p-3 md:p-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                    u.twoFA ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}>
                    {u.twoFA ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {u.twoFA ? "On" : "Off"}
                  </span>
                </td>

                <td className="p-3 font-black md:p-4">{u.apiKeys}</td>

                <td className="p-3 md:p-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => setSelected(u)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#A6FF2E]/10 text-slate-950 transition hover:bg-[#A6FF2E]"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <AdminActionMenu items={actionItems} />
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </section>

      {confirmRevokeId && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Revoke API Keys?
                </h2>
                <p className="mt-1 text-xs font-semibold md:text-sm text-slate-500">
                  This will remove all API keys for this customer.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmRevokeId(null)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600"
              >
                Cancel
              </button>

              <button
                onClick={() => revokeApiKeys(confirmRevokeId)}
                className="flex-1 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-600"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Security Details
                </h2>
                <p className="mt-1 text-xs font-semibold md:text-sm text-slate-500">
                  {selected.customer} • {selected.email}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
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
                <div
                  key={label}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)]"
            >
              Done
            </button>
          </div>
        </div>
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