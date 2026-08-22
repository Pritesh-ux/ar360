"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type RolloutRow = {
  id: number;
  customerUid: string;
  companyName: string | null;
  currentReleaseVersion: string | null;
  targetReleaseVersion: string | null;
  updatePolicySnapshot: string;
  status: string;
  progress: { total: number; pending: number; pass: number; blocked: number; unhealthy: number };
  lastActivityAt: string | null;
};

export default function Ar360CustomerRolloutsPage() {
  const [rollouts, setRollouts] = useState<RolloutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customerUid: "CUS-169432",
    productId: "PRD_3XTVLF8X",
    component: "viewer",
    targetRevisionId: "",
    targetReleaseId: "2",
    batchSize: "1",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/customer-rollouts", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRollouts(data.rollouts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function createRollout() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const targetRevisionId = Number(form.targetRevisionId);
      if (!Number.isInteger(targetRevisionId) || targetRevisionId <= 0) {
        throw new Error("targetRevisionId is required");
      }
      if (form.component === "geometry") {
        throw new Error("Geometry migration is blocked");
      }
      const res = await fetch("/api/master-admin/ar360/customer-rollouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerUid: form.customerUid.trim(),
          targetReleaseId: Number(form.targetReleaseId) || undefined,
          batchSize: Number(form.batchSize) || 1,
          notes: form.notes || undefined,
          products: [
            {
              productId: form.productId.trim(),
              proposed: { [form.component]: targetRevisionId },
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMessage(`Created rollout #${data.rollout?.id} → migration plan #${data.migrationPlanId}`);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Customer Rollouts"
        subtitle="One client + selected products. Reuses Phase 7 Migration Engine. No Auto Rollout."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Customer Rollouts" },
        ]}
        actions={
          <>
            <button
              type="button"
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
              onClick={() => void load()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            <button
              type="button"
              className="dash-premium-btn-primary h-10 px-3 text-[12px]"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus size={15} />
              Create Rollout
            </button>
          </>
        }
      />

      <div className="dash-premium-card border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-semibold text-[#1E40AF]">
        Controlled customer rollout only. AUTO is not executable. Global VERSIONED stays disabled.
        Actual pointer changes go through Phase 7 Preview → Canary → Batch → Health.
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

      {showCreate ? (
        <div className="dash-premium-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[12px] font-semibold">
            Client UID
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.customerUid}
              onChange={(e) => setForm((f) => ({ ...f, customerUid: e.target.value }))}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Product ID
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Component
            <select
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.component}
              onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))}
            >
              <option value="viewer">viewer</option>
              <option value="material">material</option>
              <option value="lighting">lighting</option>
              <option value="ar">ar</option>
            </select>
          </label>
          <label className="text-[12px] font-semibold">
            Target revision ID
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.targetRevisionId}
              onChange={(e) => setForm((f) => ({ ...f, targetRevisionId: e.target.value }))}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Target release ID
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.targetReleaseId}
              onChange={(e) => setForm((f) => ({ ...f, targetReleaseId: e.target.value }))}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Batch size
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={form.batchSize}
              onChange={(e) => setForm((f) => ({ ...f, batchSize: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              className="dash-premium-btn-primary h-9 px-4 text-[12px]"
              disabled={busy}
              onClick={() => void createRollout()}
            >
              Create Rollout
            </button>
          </div>
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading rollouts…" />
        ) : rollouts.length === 0 ? (
          <AdminEmptyState
            title="No rollouts"
            description="Create a one-client selected-product rollout to begin."
          />
        ) : (
          <div className="ma-table-scroll">
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rollouts.map((r) => (
                  <tr key={r.id} className={adminTableRowClass}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.companyName || r.customerUid}</div>
                      <div className="text-[11px] text-[#6B7280]">#{r.id}</div>
                    </td>
                    <td className="px-4 py-3">{r.currentReleaseVersion || "—"}</td>
                    <td className="px-4 py-3">{r.targetReleaseVersion || "—"}</td>
                    <td className="px-4 py-3 font-bold">{r.updatePolicySnapshot}</td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">{r.progress.total}</td>
                    <td className="px-4 py-3">
                      {r.progress.pass}/{r.progress.total}
                      {r.progress.unhealthy ? ` · ${r.progress.unhealthy} unhealthy` : ""}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/master-admin/ar360-system/customer-rollouts/${r.id}`}
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
