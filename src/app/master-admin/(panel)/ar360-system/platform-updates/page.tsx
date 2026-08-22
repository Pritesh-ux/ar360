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

type Row = {
  id: number;
  version: string;
  channel: string;
  status: string;
  isActiveStable: boolean;
  customerVisible: boolean;
  title: string;
  summary: string;
  viewedCount: number;
  publishedAt: string | null;
};

type Summary = {
  customers: number;
  current: number;
  updateAvailable: number;
  requiringReview: number;
  activeStable: { id: number; version: string } | null;
};

export default function Ar360PlatformUpdatesAdminPage() {
  const [releases, setReleases] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/platform-updates", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setReleases(data.releases || []);
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
        title="Platform Updates"
        subtitle="Customer-visible platform releases. No Force Update. No Auto Rollout. No Migrate All."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Platform Updates" },
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

      <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
        No AUTO ROLLOUT · No FORCE UPDATE · No MIGRATE ALL CUSTOMERS
      </div>

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["Customers", summary.customers],
              ["Current", summary.current],
              ["Update Available", summary.updateAvailable],
              ["Requiring Review", summary.requiringReview],
              ["Active Stable", summary.activeStable?.version || "—"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="dash-premium-card p-3">
              <div className="text-[11px] font-bold uppercase text-[#6B7280]">{label}</div>
              <div className="text-[18px] font-black">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading platform updates…" />
        ) : releases.length === 0 ? (
          <AdminEmptyState title="No releases" description="Create a platform release first." />
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-4 py-3">Release</th>
                <th className="px-4 py-3">Stable</th>
                <th className="px-4 py-3">Customer visibility</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Viewed</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className={adminTableRowClass}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.version}</div>
                    <div className="text-[11px] text-[#6B7280]">
                      {r.channel} · {r.status}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold">{r.isActiveStable ? "YES" : "NO"}</td>
                  <td className="px-4 py-3">
                    {r.customerVisible ? "Published (visible)" : "Hidden (draft/archived)"}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-[#6B7280]">
                    {r.title || r.summary || "—"}
                  </td>
                  <td className="px-4 py-3">{r.viewedCount}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/master-admin/ar360-system/stable-releases/${r.id}`}
                      className="font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      Stable
                    </Link>
                    {" · "}
                    <Link
                      href="/master-admin/ar360-system/platform-compatibility"
                      className="font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      Compatibility
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
