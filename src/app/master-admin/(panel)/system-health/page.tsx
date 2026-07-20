"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { fmtDateTime } from "@/components/features/master-admin/support-tickets-utils";

type HealthItem = {
  label: string;
  status: "healthy" | "warning" | "error";
  note: string;
};

type Snapshot = {
  checks: HealthItem[];
  resources: {
    storageUsedMB: number;
    storageUsedPct: number;
    bandwidthUsedMB: number;
    adminUsers: number;
    suspendedUsers: number;
    openSupportTickets: number;
    failedEmails24h: number;
    uptimeSec: number;
  };
  db: { connected: boolean; latencyMs: number | null };
  objectCapture: {
    activeWorkers: number; latestHeartbeatAt: string | null; queueDepth: number;
    oldestQueuedAgeSec: number; staleLeases: number; successRate24h: number;
    failed24h: number; averageDurationSec24h: number; storageUsedBytes: number;
  };
  checkedAt: string;
};

function statusBadge(status: string) {
  if (status === "healthy") return "bg-emerald-100 text-emerald-700";
  if (status === "warning") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export default function SystemHealthPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/master-admin/system-health", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load health data");
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load system health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const resources = snapshot?.resources;

  return (
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader
        title="System Health"
        subtitle={
          snapshot
            ? `Last checked ${fmtDateTime(snapshot.checkedAt)} · auto-refreshes every 60s`
            : "Live monitoring for core platform services."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              href="/api/health"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
            >
              <Activity size={16} />
              Public Health API
            </Link>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(snapshot?.checks || []).map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">{item.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusBadge(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-slate-500">{item.note}</p>
          </div>
        ))}
        {loading && !snapshot && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Resource Usage</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: "Storage Used", value: resources ? `${Math.round(resources.storageUsedMB / 1024)} GB (${resources.storageUsedPct}%)` : "—" },
              { label: "Bandwidth Used", value: resources ? `${Math.round(resources.bandwidthUsedMB / 1024)} GB` : "—" },
              { label: "Active Admins", value: resources ? String(resources.adminUsers) : "—" },
              { label: "Suspended Accounts", value: resources ? String(resources.suspendedUsers) : "—" },
              { label: "Open Support Tickets", value: resources ? String(resources.openSupportTickets) : "—" },
              { label: "Failed Emails (24h)", value: resources ? String(resources.failedEmails24h) : "—" },
              { label: "Process Uptime", value: resources ? `${Math.floor(resources.uptimeSec / 3600)}h ${Math.floor((resources.uptimeSec % 3600) / 60)}m` : "—" },
              { label: "DB Latency", value: snapshot?.db.connected ? `${snapshot.db.latencyMs ?? "—"}ms` : "Unreachable" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <span className="font-semibold text-slate-600">{row.label}</span>
                <span className="font-black text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Related Monitoring</h2>
          <div className="mt-4 space-y-2">
            {[
              { label: "Audit Logs", href: "/master-admin/audit-logs" },
              { label: "Activity Logs", href: "/master-admin/activity-logs" },
              { label: "Login Logs", href: "/master-admin/login-logs" },
              { label: "Email Center", href: "/master-admin/email-center" },
              { label: "Storage Manager", href: "/master-admin/storage" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {link.label}
                <span className="text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {snapshot && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Object Capture Operations</h2>
              <p className="text-xs font-medium text-slate-500">
                Worker, queue, reliability, duration, and private capture storage.
              </p>
            </div>
            <Link href="/master-admin/object-capture" className="text-xs font-bold text-[#4D9A00]">
              Open queue →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Active workers", snapshot.objectCapture.activeWorkers],
              ["Queue depth", snapshot.objectCapture.queueDepth],
              ["Oldest queued", `${Math.round(snapshot.objectCapture.oldestQueuedAgeSec / 60)}m`],
              ["Stale leases", snapshot.objectCapture.staleLeases],
              ["Success (24h)", `${snapshot.objectCapture.successRate24h}%`],
              ["Failures (24h)", snapshot.objectCapture.failed24h],
              ["Average duration", `${Math.round(snapshot.objectCapture.averageDurationSec24h / 60)}m`],
              ["Capture storage", `${(snapshot.objectCapture.storageUsedBytes / 1024 / 1024 / 1024).toFixed(2)} GB`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-3">
                <p className="text-[11px] font-bold uppercase text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Latest worker heartbeat: {snapshot.objectCapture.latestHeartbeatAt
              ? fmtDateTime(snapshot.objectCapture.latestHeartbeatAt)
              : "none recorded"}
          </p>
        </div>
      )}
    </div>
  );
}
