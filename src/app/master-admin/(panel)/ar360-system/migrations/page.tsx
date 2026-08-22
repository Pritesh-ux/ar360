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

type Plan = {
  id: number;
  title: string;
  status: string;
  releaseId: number | null;
  batchSize: number;
  components: string[];
  createdAt: string;
};

export default function Ar360MigrationsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    productId: "PRD_3XTVLF8X",
    component: "viewer",
    targetRevisionId: "",
    batchSize: "10",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/migrations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load plans");
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function createPlan() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const targetId = Number(form.targetRevisionId);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        throw new Error("targetRevisionId is required");
      }
      if (form.component === "geometry") {
        throw new Error("Geometry migration is blocked in Phase 7");
      }
      const res = await fetch("/api/master-admin/ar360/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || `Migration ${form.component} → #${targetId}`,
          batchSize: Number(form.batchSize) || 10,
          notes: form.notes || undefined,
          products: [
            {
              productId: form.productId.trim(),
              proposed: { [form.component]: targetId },
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMessage(`Created plan #${data.plan?.id}`);
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
        title="Migrations"
        subtitle="Controlled product upgrade plans. Selected products only. No scope=all. Geometry blocked."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Migrations" },
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
              onClick={() => setShowCreate(true)}
            >
              <Plus size={15} />
              Create Plan
            </button>
          </>
        }
      />

      <div className="dash-premium-card border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-semibold text-[#1E40AF]">
        Migration changes versioned component pointers only. LEGACY remains default. No automatic
        VERSIONED global enable. No automatic rollback — use Component Versions rollbacks.
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
        <div className="dash-premium-card space-y-3 p-4">
          <div className="text-[13px] font-semibold">Create migration plan</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold">
              Title
              <input
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="text-[12px] font-semibold">
              Product ID
              <input
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              />
            </label>
            <label className="text-[12px] font-semibold">
              Component
              <select
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.component}
                onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))}
              >
                <option value="material">Material</option>
                <option value="lighting">Lighting</option>
                <option value="viewer">Viewer</option>
                <option value="ar">AR</option>
                <option value="config">Config</option>
                <option value="geometry">Geometry (blocked)</option>
              </select>
            </label>
            <label className="text-[12px] font-semibold">
              Target revision ID
              <input
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.targetRevisionId}
                onChange={(e) => setForm((f) => ({ ...f, targetRevisionId: e.target.value }))}
                placeholder="e.g. archived viewer revision id"
              />
            </label>
            <label className="text-[12px] font-semibold">
              Batch size
              <input
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.batchSize}
                onChange={(e) => setForm((f) => ({ ...f, batchSize: e.target.value }))}
              />
            </label>
            <label className="text-[12px] font-semibold">
              Notes
              <input
                className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="dash-premium-btn-primary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void createPlan()}
            >
              Create
            </button>
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading migration plans…" />
        ) : plans.length === 0 ? (
          <AdminEmptyState
            title="No migration plans yet"
            description="Create a selected-product migration plan. Geometry migrations remain blocked."
            action={
              <button
                type="button"
                className="dash-premium-btn-primary h-10 px-4 text-[12px]"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={15} />
                Create Plan
              </button>
            }
          />
        ) : (
          <div className="ma-table-scroll">
            <table className="min-w-[720px] w-full text-left text-[13px]">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Components</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className={adminTableRowClass}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">#{p.id} · {p.title}</div>
                      {p.releaseId ? (
                        <div className="text-[11px] text-[#6B7280]">Release #{p.releaseId}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-bold">{p.status}</td>
                    <td className="px-4 py-3 text-[12px] uppercase">{(p.components || []).join(", ")}</td>
                    <td className="px-4 py-3">{p.batchSize}</td>
                    <td className="px-4 py-3 text-[#6B7280]">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/master-admin/ar360-system/migrations/${p.id}`}
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
