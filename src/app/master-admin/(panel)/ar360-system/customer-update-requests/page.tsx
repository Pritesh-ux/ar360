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
  customerUid: string;
  companyName: string | null;
  releaseId: number;
  releaseVersion: string | null;
  status: string;
  productSelection: string[];
  approvalRequired: boolean;
  rolloutId: number | null;
  requestedAt: string | null;
};

export default function CustomerUpdateRequestsAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/customer-update-requests", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, action: "approve" | "reject" | "prepare-rollout") {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/customer-update-requests/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: "Rejected by admin" } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.code || "Action failed");
      setMessage(data.warning || `${action} ok`);
      if (data.openRolloutHref) {
        setMessage(`${data.warning || "Rollout ready"} → ${data.openRolloutHref}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Customer Update Requests"
        subtitle="Customer approval gateway. Open Rollout uses existing Phase 9 — no second migration engine."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Customer Update Requests" },
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
        No AUTO execution · No Force Update · Approval does not mutate product pointers
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

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading requests…" />
        ) : rows.length === 0 ? (
          <AdminEmptyState title="No requests" description="Customer product update requests appear here." />
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Release</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Rollout</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={adminTableRowClass}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.companyName || r.customerUid}</div>
                    <div className="text-[11px] text-[#6B7280]">{r.customerUid}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.releaseVersion || r.releaseId}</td>
                  <td className="px-4 py-3">{r.productSelection?.length ?? 0}</td>
                  <td className="px-4 py-3 font-bold">{r.status}</td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    {r.requestedAt ? String(r.requestedAt).slice(0, 19) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.rolloutId ? (
                      <Link
                        href={`/master-admin/ar360-system/customer-rollouts/${r.rolloutId}`}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        #{r.rolloutId}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        className="rounded-lg border border-[#E5E7EB] px-2 py-1 font-semibold"
                        onClick={() => void act(r.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        className="rounded-lg border border-[#E5E7EB] px-2 py-1 font-semibold"
                        onClick={() => void act(r.id, "reject")}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        className="rounded-lg border border-[#E5E7EB] px-2 py-1 font-semibold"
                        onClick={() => void act(r.id, "prepare-rollout")}
                      >
                        Open Rollout
                      </button>
                      {r.rolloutId ? (
                        <Link
                          href={`/master-admin/ar360-system/customer-rollouts/${r.rolloutId}`}
                          className="rounded-lg bg-[#B6FF38] px-2 py-1 font-semibold text-[#102000]"
                        >
                          Phase 9
                        </Link>
                      ) : null}
                    </div>
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
