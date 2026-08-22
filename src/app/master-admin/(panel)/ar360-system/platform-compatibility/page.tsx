"use client";

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

type Row = {
  productId: string;
  title: string | null;
  customerUid: string;
  companyName: string | null;
  platformVersion: string | null;
  config: { label: string };
  material: { label: string };
  lighting: { label: string };
  viewer: { label: string };
  ar: { label: string };
  compatibility: string;
  reason: string;
};

export default function Ar360PlatformCompatibilityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [platform, setPlatform] = useState<{ version: string; id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerUid, setCustomerUid] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (customerUid.trim()) qs.set("customerUid", customerUid.trim());
      const res = await fetch(
        `/api/master-admin/ar360/platform-compatibility?${qs.toString()}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.rows || []);
      setPlatform(
        data.platformRelease
          ? { version: data.platformRelease.version, id: data.platformRelease.id }
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, [customerUid]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Platform Compatibility"
        subtitle="Read-only diagnostic. Platform release ≠ product versions ≠ subscriptions. No mutations."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Platform Compatibility" },
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
        Platform Release: {platform?.version || "— (no stable / published fallback)"}
        {platform ? ` (#${platform.id})` : ""}. Different component revision numbers are expected.
        This view never migrates products.
      </div>

      <div className="dash-premium-card flex flex-wrap items-end gap-3 p-4">
        <label className="text-[12px] font-semibold">
          Filter customer UID
          <input
            className="mt-1 block w-64 rounded-xl border border-[#E5E7EB] px-3 py-2"
            value={customerUid}
            onChange={(e) => setCustomerUid(e.target.value)}
            placeholder="CUS-…"
          />
        </label>
        <button
          type="button"
          className="dash-premium-btn-primary h-10 px-3 text-[12px]"
          onClick={() => void load()}
        >
          Check
        </button>
      </div>

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading compatibility…" />
        ) : rows.length === 0 ? (
          <AdminEmptyState title="No products" description="No products matched the filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Config</th>
                  <th className="px-3 py-3">Material</th>
                  <th className="px-3 py-3">Lighting</th>
                  <th className="px-3 py-3">Viewer</th>
                  <th className="px-3 py-3">AR</th>
                  <th className="px-3 py-3">Compatibility</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId} className={adminTableRowClass}>
                    <td className="px-3 py-2">{r.platformVersion || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.companyName || r.customerUid}</div>
                      <div className="text-[11px] text-[#6B7280]">{r.customerUid}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.title || "Untitled"}</div>
                      <div className="text-[11px] text-[#6B7280]">{r.productId}</div>
                    </td>
                    <td className="px-3 py-2">{r.config.label}</td>
                    <td className="px-3 py-2">{r.material.label}</td>
                    <td className="px-3 py-2">{r.lighting.label}</td>
                    <td className="px-3 py-2">{r.viewer.label}</td>
                    <td className="px-3 py-2">{r.ar.label}</td>
                    <td className="px-3 py-2 font-bold">{r.compatibility}</td>
                    <td className="px-3 py-2 text-[#6B7280]">{r.reason}</td>
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
