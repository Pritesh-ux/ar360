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
  AlertTriangle,
  Ban,
  Search,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminActionMenu from "@/components/features/master-admin/AdminActionMenu";
import ExportDateModal, { isWithinDateRange } from "@/components/features/master-admin/ExportDateModal";
import ViewportPortal from "@/components/shared/ViewportPortal";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserFilterDropdown from "@/components/user-panel/UserFilterDropdown";
import { AdminEmptyState } from "@/components/ui/admin";

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

const STATUS_OPTIONS = ["All", "Success", "Failed", "Suspicious", "Locked", "Blocked"];
const RISK_OPTIONS = ["All", "Low", "Medium", "High"];

export default function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selected, setSelected] = useState<LoginLog | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ kind: "login", page: String(page), pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "All") params.set("status", statusFilter);
      if (riskFilter !== "All") params.set("risk", riskFilter);
      fetch(`/api/master-admin/live?${params}`, { cache: "no-store", signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(response)))
        .then((data) => {
          setLogs(Array.isArray(data.rows) ? data.rows : []);
          setTotal(Number(data.pagination?.total || 0));
        })
        .catch((error) => {
          if (error?.name !== "AbortError") console.error(error);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search, statusFilter, riskFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, riskFilter]);

  const filtered = logs;

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

  async function callLoginAction(customerUid: string, action: string, optimistic?: Partial<LoginLog>) {
    if (optimistic) {
      setLogs((prev) => prev.map((l) => (l.id === customerUid ? { ...l, ...optimistic } : l)));
    }
    try {
      const res = await fetch("/api/master-admin/login-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, customerUid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Action failed");
      }
    } catch {
      setLogs((prev) => prev);
    }
  }

  function blockIp(id: string) {
    void callLoginAction(id, "block_ip", {
      status: "Blocked",
      reason: "IP manually blocked by admin",
      risk: "High",
      sessionStatus: "Force Logged Out",
      logoutReason: "Blocked by master admin",
    });
  }

  function unlockAccount(id: string) {
    void callLoginAction(id, "unlock", {
      status: "Success",
      reason: "Account unlocked by admin",
      risk: "Low",
    });
  }

  function forceLogout(id: string) {
    void callLoginAction(id, "force_logout", {
      sessionStatus: "Force Logged Out",
      logoutReason: "Force logout by master admin",
    });
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

    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "login-logs-production.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Login Logs"
        subtitle="Production login history, sessions, IP risk, device tracking and account protection."
        actions={
          <button type="button" onClick={() => setIsExportOpen(true)} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
            <Download size={15} />
            Export CSV
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UserMetricCard title="Successful" value={String(successCount)} icon={CheckCircle2} accent="emerald" compact />
        <UserMetricCard title="Suspicious" value={String(suspiciousCount)} icon={Shield} accent="amber" compact />
        <UserMetricCard title="Locked" value={String(lockedCount)} icon={AlertTriangle} accent="rose" compact />
        <UserMetricCard title="Blocked IP" value={String(blockedCount)} icon={Ban} accent="sky" compact />
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
              placeholder="Search customer, email, IP, country, device..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white pl-9 pr-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[138px] shrink-0"
            label="Status"
            menuTitle="Login status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />

          <UserFilterDropdown
            hideLabel
            compact
            className="w-[128px] shrink-0"
            label="Risk"
            menuTitle="Risk level"
            value={riskFilter}
            options={RISK_OPTIONS}
            onChange={setRiskFilter}
          />

          {(search || statusFilter !== "All" || riskFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
                setRiskFilter("All");
                setPage(1);
              }}
              className="h-10 rounded-[14px] border border-[#ECECEC] px-3 text-[12px] font-semibold text-[#6B7280] hover:bg-[#FAFAFB]"
            >
              Clear
            </button>
          )}
          <p className="ml-auto text-[11px] font-medium text-[#9CA3AF]">
            {loading ? "Applying filters…" : `${total.toLocaleString("en-IN")} matches`}
          </p>
          <div className="ml-auto rounded-[12px] bg-[#FAFAFB] px-3 py-2 text-[11px] font-semibold text-[#6B7280]">
            Rule: 5 failed attempts = 30 min lock
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1350px] text-left">
            <thead>
              <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Risk</th>
                <th className="px-3 py-3">IP / Geo</th>
                <th className="px-3 py-3">Device</th>
                <th className="px-3 py-3">Browser / OS</th>
                <th className="px-3 py-3">Method</th>
                <th className="px-3 py-3">Session</th>
                <th className="px-3 py-3">Time</th>
                <th className="w-24 px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <AdminEmptyState title="No login logs match your filters." />
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const actionItems = [
                    { label: "Force Logout", onClick: () => forceLogout(l.id) },
                    { label: "Unlock Account", onClick: () => unlockAccount(l.id) },
                    { label: "Block IP", onClick: () => blockIp(l.id), isDangerous: true },
                  ];

                  return (
                    <tr key={l.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-bold text-[#111827]">{l.customer}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{l.email}</div>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusClass(l.status)}`}>
                          {l.status}
                        </span>
                        <div className="mt-1 max-w-[180px] text-[11px] font-medium text-[#9CA3AF]">{l.reason}</div>
                      </td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${riskClass(l.risk)}`}>
                          {l.risk}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-[13px] font-bold text-[#111827]">{l.ip}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#9CA3AF]">
                          <Globe2 size={13} />
                          {l.city}, {l.country}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-[#374151]">
                          <MonitorSmartphone size={16} className="text-[#6B7280]" />
                          {l.device}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="text-[12px] font-semibold text-[#374151]">{l.browser}</div>
                        <div className="text-[11px] font-medium text-[#9CA3AF]">{l.os}</div>
                      </td>

                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{l.loginMethod}</td>

                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${sessionClass(l.sessionStatus)}`}>
                          {l.sessionStatus}
                        </span>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#9CA3AF]">
                          <Clock size={13} />
                          {l.sessionDuration}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-[12px] font-semibold text-[#374151]">{l.time}</td>

                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelected(l)}
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

      {selected && (
        <ViewportPortal>
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/40 p-6">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Login Session Detail</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  ID: {selected.id} • {selected.customer}
                </p>
              </div>

              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
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
        title="Export Login Logs"
      />
    </div>
  );
}
