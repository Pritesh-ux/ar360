"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type ClientRow = {
  customerUid: string;
  companyName: string | null;
  updatePolicy: string;
  status: string;
  currentReleaseVersion: string | null;
  targetReleaseVersion: string | null;
  productCounts: { total: number; eligible: number; pending: number };
  lastUpdateAt: string | null;
  autoLabel: string;
};

type Summary = {
  clients: number;
  current: number;
  updatesAvailable: number;
  pendingApproval: number;
  blocked: number;
  upToDate: number;
};

export default function Ar360ClientUpdatesPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/client-updates", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load clients");
      setClients(data.clients || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Client Updates"
        subtitle="Release eligibility and update policy. Does not migrate products. AUTO is not active."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Client Updates" },
        ]}
        actions={
          <button
            type="button"
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />

      <div className="dash-premium-card border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-semibold text-[#1E40AF]">
        Policy layer only. Actual upgrades require Phase 7 Migrations (Preview → Canary → Batch).
        AUTO — NOT ACTIVE IN PHASE 8.
      </div>

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Clients", summary.clients],
              ["Current", summary.current],
              ["Updates Available", summary.updatesAvailable],
              ["Pending Approval", summary.pendingApproval],
              ["Blocked", summary.blocked],
              ["Up To Date", summary.upToDate],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="dash-premium-card ma-stat-card min-w-0 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{label}</div>
              <div className="mt-2 text-[22px] font-black tabular-nums leading-none text-[#111827]">{value}</div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="dash-premium-card ma-stat-card animate-pulse bg-slate-50 p-4">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="mt-3 h-6 w-10 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading clients…" />
        ) : clients.length === 0 ? (
          <AdminEmptyState
            title="No clients"
            description="No customers matched this client-update view."
            action={
              <button type="button" className="dash-premium-btn-secondary h-10 px-3 text-[12px]" onClick={() => void load()}>
                <RefreshCw size={15} />
                Refresh
              </button>
            }
          />
        ) : (
          <div className="ma-table-scroll">
            <table className="min-w-[960px] w-full text-left text-[12px]">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Eligible</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Last Update</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.customerUid} className={adminTableRowClass}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{c.companyName || c.customerUid}</div>
                      <div className="text-[11px] text-[#6B7280]">{c.customerUid}</div>
                    </td>
                    <td className="px-4 py-3">{c.currentReleaseVersion || "—"}</td>
                    <td className="px-4 py-3">{c.targetReleaseVersion || "—"}</td>
                    <td className="px-4 py-3 font-bold">
                      {c.updatePolicy}
                      {c.updatePolicy === "AUTO" ? (
                        <div className="text-[10px] font-semibold text-[#92400E]">{c.autoLabel}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{c.status}</td>
                    <td className="px-4 py-3">
                      {c.productCounts.eligible}/{c.productCounts.total}
                    </td>
                    <td className="px-4 py-3">{c.productCounts.pending}</td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {c.lastUpdateAt ? new Date(c.lastUpdateAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/master-admin/ar360-system/client-updates/${encodeURIComponent(c.customerUid)}`}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
