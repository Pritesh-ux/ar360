"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Eye,
  X,
  Shield,
  Clock,
  Globe2,
  MonitorSmartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ban,
} from "lucide-react";
import AdminSearch from "@/components/features/master-admin/AdminSearch";
import AdminTable from "@/components/features/master-admin/AdminTable";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import AdminStatCard from "@/components/features/master-admin/AdminStatCard";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";

type LoginStatus = "Success" | "Failed" | "Blocked" | "Locked" | "Suspicious";
type LoginMethod = "Password" | "OTP" | "Google" | "Microsoft";
type SessionStatus = "Active" | "Expired" | "Logged Out" | "Force Logged Out";

type LoginLog = {
  id: string;
  customer: string;
  email: string;
  status: LoginStatus;
  reason: string;
  ip: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  loginMethod: LoginMethod;
  sessionStatus: SessionStatus;
  sessionDuration: string;
  logoutReason: string;
  time: string;
  risk: "Low" | "Medium" | "High";
};


export default function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/master-admin/live?kind=login", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((data) => setLogs(Array.isArray(data.rows) ? data.rows : []))
      .catch((error) => { if (error?.name !== "AbortError") console.error(error); });
    return () => controller.abort();
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selected, setSelected] = useState<LoginLog | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      l.customer.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q) ||
      l.ip.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      l.device.toLowerCase().includes(q) ||
      l.browser.toLowerCase().includes(q) ||
      l.os.toLowerCase().includes(q) ||
      l.risk.toLowerCase().includes(q);

    const matchStatus = statusFilter === "All" || l.status === statusFilter;
    const matchRisk = riskFilter === "All" || l.risk === riskFilter;

    return matchSearch && matchStatus && matchRisk;
  });

  const successCount = logs.filter((l) => l.status === "Success").length;
  const suspiciousCount = logs.filter((l) => l.status === "Suspicious").length;
  const lockedCount = logs.filter((l) => l.status === "Locked").length;
  const blockedCount = logs.filter((l) => l.status === "Blocked").length;

  function statusClass(status: LoginStatus) {
    if (status === "Success") return "bg-green-50 text-green-700";
    if (status === "Failed") return "bg-yellow-50 text-yellow-700";
    if (status === "Suspicious") return "bg-orange-50 text-orange-700";
    return "bg-red-50 text-red-700";
  }

  function riskClass(risk: LoginLog["risk"]) {
    if (risk === "Low") return "bg-green-50 text-green-700";
    if (risk === "Medium") return "bg-yellow-50 text-yellow-700";
    return "bg-red-50 text-red-700";
  }

  function sessionClass(status: SessionStatus) {
    if (status === "Active") return "bg-green-50 text-green-700";
    if (status === "Expired") return "bg-yellow-50 text-yellow-700";
    if (status === "Force Logged Out") return "bg-red-50 text-red-700";
    return "bg-slate-100 text-slate-600";
  }

  function blockIp(id: string) {
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: "Blocked",
              reason: "IP manually blocked by admin",
              risk: "High",
              sessionStatus: "Force Logged Out",
              logoutReason: "Blocked by master admin",
            }
          : l
      )
    );
  }

  function unlockAccount(id: string) {
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: "Success",
              reason: "Account unlocked by admin",
              risk: "Low",
            }
          : l
      )
    );
  }

  function forceLogout(id: string) {
    setLogs((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              sessionStatus: "Force Logged Out",
              logoutReason: "Force logout by master admin",
            }
          : l
      )
    );
  }

  function exportCsv(start?: string, end?: string) {
    const itemsToExport = (start || end)
      ? filtered.filter((l) => isWithinDateRange(l.time, start || "", end || ""))
      : filtered;

    const header = [
      "Customer",
      "Email",
      "Status",
      "Reason",
      "IP",
      "Country",
      "City",
      "Device",
      "Browser",
      "OS",
      "Login Method",
      "Session Status",
      "Session Duration",
      "Logout Reason",
      "Time",
      "Risk",
    ];

    const rows = itemsToExport.map((l) => [
      l.customer,
      l.email,
      l.status,
      l.reason,
      l.ip,
      l.country,
      l.city,
      l.device,
      l.browser,
      l.os,
      l.loginMethod,
      l.sessionStatus,
      l.sessionDuration,
      l.logoutReason,
      l.time,
      l.risk,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "login-logs-production.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-full p-4 md:p-6 2xl:p-8 pb-10 md:pb-12">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-[32px]">
            Login Logs
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Production login history, sessions, IP risk, device tracking and account protection.
          </p>
        </div>

        <button
          onClick={() => setIsExportOpen(true)}
          className="inline-flex items-center gap-2 rounded-[14px] bg-[var(--color-primary)] px-5 py-3 text-sm font-black text-[var(--color-text)] shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:gap-5">
        <AdminStatCard
          title="Successful"
          value={successCount}
          icon={<CheckCircle2 className="text-green-600" size={22} />}
        />
        <AdminStatCard
          title="Suspicious"
          value={suspiciousCount}
          icon={<Shield className="text-orange-500" size={22} />}
        />
        <AdminStatCard
          title="Locked"
          value={lockedCount}
          icon={<AlertTriangle className="text-red-500" size={22} />}
        />
        <AdminStatCard
          title="Blocked IP"
          value={blockedCount}
          icon={<Ban className="text-slate-950" size={22} />}
        />
      </section>

      <section className="rounded-[20px] border border-slate-200/60 bg-white p-4 shadow-[0_4px_14px_rgba(5,7,6,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <AdminSearch
            value={search}
            onChange={setSearch}
            placeholder="Search customer, email, IP, country, device..."
          />

          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-12 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all"
            >
              <option>All</option>
              <option>Success</option>
              <option>Failed</option>
              <option>Suspicious</option>
              <option>Locked</option>
              <option>Blocked</option>
            </select>

            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-12 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-[#A6FF2E] focus:ring-2 focus:ring-[#A6FF2E] transition-all"
            >
              <option>All</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <div className="rounded-[14px] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
              Rule: 5 failed attempts = 30 min lock
            </div>
          </div>
        </div>

        <AdminTable headers={["Customer", "Status", "Risk", "IP / Geo", "Device", "Browser / OS", "Method", "Session", "Time", "Action"]} alignRightIndex={[9]} minWidth="1350px">
          {filtered.map((l) => {
            const actionItems = [
              {
                label: "Force Logout",
                onClick: () => forceLogout(l.id),
              },
              {
                label: "Unlock Account",
                onClick: () => unlockAccount(l.id),
              },
              {
                label: "Block IP",
                onClick: () => blockIp(l.id),
                isDangerous: true,
              },
            ];

            return (
              <tr key={l.id} className="align-middle">
                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-950">{l.customer}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {l.email}
                  </div>
                </td>

                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(l.status)}`}>
                    {l.status}
                  </span>
                  <div className="mt-2 max-w-[180px] text-xs font-semibold text-slate-500">
                    {l.reason}
                  </div>
                </td>

                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${riskClass(l.risk)}`}>
                    {l.risk}
                  </span>
                </td>

                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-950">{l.ip}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Globe2 size={13} />
                    {l.city}, {l.country}
                  </div>
                </td>

                <td className="p-3 md:p-4">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <MonitorSmartphone size={16} className="text-slate-800" />
                    {l.device}
                  </div>
                </td>

                <td className="p-3 md:p-4">
                  <div className="font-black text-slate-900">{l.browser}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {l.os}
                  </div>
                </td>

                <td className="p-3 font-black md:p-4 text-slate-700">
                  {l.loginMethod}
                </td>

                <td className="p-3 md:p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${sessionClass(l.sessionStatus)}`}>
                    {l.sessionStatus}
                  </span>
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Clock size={13} />
                    {l.sessionDuration}
                  </div>
                </td>

                <td className="p-3 font-bold md:p-4 text-slate-600">{l.time}</td>

                <td className="p-3 md:p-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => setSelected(l)}
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Login Session Detail
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  ID: {selected.id} • {selected.customer}
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
                ["Email Address", selected.email],
                ["Login Status", selected.status],
                ["Reason / Message", selected.reason],
                ["IP Address", selected.ip],
                ["Geo Location", `${selected.city}, ${selected.country}`],
                ["Risk Rating", selected.risk],
                ["Login Method", selected.loginMethod],
                ["Session Status", selected.sessionStatus],
                ["Active Duration", selected.sessionDuration],
                ["Browser UserAgent", selected.browser],
                ["Operating System", selected.os],
                ["Logout Trigger", selected.logoutReason],
                ["Timestamp", selected.time],
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
        title="Export Login Logs"
      />
    </div>
  );
}