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

type StableStatus = {
  currentStable: { id: number; version: string; channel: string; status: string } | null;
  previousStable: { id: number; version: string } | null;
  activatedAt: string | null;
  activatedByAdminId: number | null;
  requestedStable: { id: number; version: string } | null;
  lastHealth: unknown;
  releases: Array<{
    id: number;
    version: string;
    channel: string;
    status: string;
    isActiveStable: boolean;
    createdAt: string;
    publishedAt: string | null;
  }>;
  note: string;
};

export default function Ar360StableReleasesPage() {
  const [status, setStatus] = useState<StableStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [readinessById, setReadinessById] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/stable", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function runReadiness(id: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/readiness`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Readiness failed");
      setReadinessById((prev) => ({ ...prev, [id]: data.overall }));
      setMessage(`Readiness for #${id}: ${data.overall}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Readiness failed");
    } finally {
      setBusy(false);
    }
  }

  async function restorePrevious() {
    if (
      !window.confirm(
        "Restore previous stable pointer? This does NOT migrate products. Confirm?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/master-admin/ar360/stable/restore-previous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setMessage(data.warning || "Previous stable restored.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Stable Releases"
        subtitle="Stable pointer governance only. Does not migrate products or enable VERSIONED."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Stable Releases" },
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
        Activating stable changes only ar360_active_stable_release_id. Customers stay on Phase 8/9
        policy. AUTO remains non-executable.
      </div>

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="dash-premium-card border-[#D1FAE5] bg-[#ECFDF5] px-4 py-3 text-[13px] font-semibold text-[#065F46]">
          {message}
        </div>
      ) : null}

      {loading || !status ? (
        <AdminLoadingState label="Loading stable status…" />
      ) : (
        <>
          <div className="dash-premium-card space-y-2 border-[#BBF7D0] bg-[#F0FDF4] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#166534]">
              Current Stable
            </div>
            <div className="text-[28px] font-black text-[#14532D]">
              {status.currentStable?.version || "— (LEGACY / empty)"}
            </div>
            <div className="text-[13px] text-[#166534]">
              Previous Stable: {status.previousStable?.version || "—"}
            </div>
            <div className="text-[12px] text-[#6B7280]">
              Activated: {status.activatedAt || "—"} · by admin{" "}
              {status.activatedByAdminId ?? "—"}
            </div>
            {status.requestedStable ? (
              <div className="text-[12px] font-semibold text-[#92400E]">
                Requested: {status.requestedStable.version} (#{status.requestedStable.id})
              </div>
            ) : null}
            <button
              type="button"
              className="dash-premium-btn-secondary mt-2 h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void restorePrevious()}
            >
              Restore Previous Stable
            </button>
          </div>

          <div className="dash-premium-card overflow-hidden p-0">
            {status.releases.length === 0 ? (
              <AdminEmptyState
                title="No releases"
                description="Create a platform release first."
              />
            ) : (
              <div className="ma-table-scroll">
                <table className="min-w-[900px] w-full text-left text-[12px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-4 py-3">Release</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Stable</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Published</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {status.releases.map((r) => (
                    <tr key={r.id} className={adminTableRowClass}>
                      <td className="px-4 py-3 font-semibold">
                        {r.version}
                        <div className="text-[11px] font-normal text-[#6B7280]">#{r.id}</div>
                      </td>
                      <td className="px-4 py-3">{r.channel}</td>
                      <td className="px-4 py-3 uppercase">{r.status}</td>
                      <td className="px-4 py-3 font-bold">{r.isActiveStable ? "YES" : "NO"}</td>
                      <td className="px-4 py-3">{readinessById[r.id] || "—"}</td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280]">
                        {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="font-semibold text-[var(--color-primary)] hover:underline"
                            disabled={busy}
                            onClick={() => void runReadiness(r.id)}
                          >
                            Readiness
                          </button>
                          <Link
                            href={`/master-admin/ar360-system/stable-releases/${r.id}`}
                            className="font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
