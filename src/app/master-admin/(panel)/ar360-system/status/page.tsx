"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { RefreshCw } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import { AdminLoadingState } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type StatusPayload = {
  phase: number;
  activeStableReleaseId: number | null;
  legacyRuntimeActive: boolean;
  channels: Array<{ code: string; displayName: string; isCustomerFacing: boolean }>;
  releases: { total: number; draft: number; published: number; archived: number };
  featureFlags: { total: number; enabled: number };
  safety: {
    products: number;
    productsWithActivePointer: number;
    qr: number;
    subscriptions: number;
  };
  note: string;
};

export default function Ar360SystemStatusPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/system-status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load status");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load status");
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
        title="AR360 System Status"
        subtitle="Release manager foundation. Legacy runtime remains active for all customers."
        breadcrumbs={[{ label: "AR360 System" }, { label: "System Status" }]}
        actions={
          <button type="button" onClick={load} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {loading || !status ? (
        <AdminLoadingState label="Loading system status…" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricCard title="Phase" value={String(status.phase)} />
            <AdminMetricCard
              title="Runtime"
              value={status.legacyRuntimeActive ? "Legacy" : `Release #${status.activeStableReleaseId}`}
            />
            <AdminMetricCard title="Published releases" value={String(status.releases.published)} />
            <AdminMetricCard title="Flags enabled" value={String(status.featureFlags.enabled)} />
          </div>

          <div className="dash-premium-card space-y-2 p-4 text-[13px]">
            <div className="font-semibold text-[#111827]">Safety counters (must stay stable during Phase 2)</div>
            <div>Products: {status.safety.products}</div>
            <div>Products with revision pointer: {status.safety.productsWithActivePointer}</div>
            <div>QR codes: {status.safety.qr}</div>
            <div>Subscriptions: {status.safety.subscriptions}</div>
            <div className="pt-2 text-[12px] text-[#64748B]">{status.note}</div>
          </div>

          <div className="dash-premium-card p-4 text-[13px]">
            <div className="mb-2 font-semibold">Channels</div>
            <ul className="space-y-1 text-[#475569]">
              {status.channels.map((c) => (
                <li key={c.code}>
                  {c.displayName} ({c.code})
                  {c.isCustomerFacing ? " · customer-facing" : " · non-customer"}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
