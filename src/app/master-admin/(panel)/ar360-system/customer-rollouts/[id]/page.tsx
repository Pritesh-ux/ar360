"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminLoadingState, adminTableHeadClass, adminTableRowClass } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Detail = {
  rollout: {
    id: number;
    customerUid: string;
    companyName: string | null;
    status: string;
    updatePolicySnapshot: string;
    livePolicy: string;
    currentReleaseVersion: string | null;
    targetReleaseVersion: string | null;
    migrationPlanId: number;
    approvedAt: string | null;
    upToDateLabel: string | null;
  };
  progress: {
    total: number;
    eligible: number;
    migrated: number;
    pending: number;
    blocked: number;
    unhealthy: number;
  };
  products: Array<{
    productId: string;
    status: string;
    displayStatus: string;
    snapshotBefore: Record<string, number | null> | null;
    proposed: Record<string, number>;
    validationCode: string | null;
    validationMessage: string | null;
    rollbackAvailable: Record<string, boolean>;
  }>;
  migrationPlan: { id: number; status: string; batchSize: number };
  autoNote: string;
};

export default function Ar360CustomerRolloutDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [canaryIds, setCanaryIds] = useState("");

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/customer-rollouts/${id}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setDetail(data);
      setCanaryIds((prev) => prev || String(data.products?.[0]?.productId || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function postAction(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/customer-rollouts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (body.action === "preview") {
        setPreview(data);
        setMessage("Preview ready — no mutations.");
      } else {
        setMessage(data.warning || "Done.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium p-4">
        <AdminLoadingState label="Loading customer rollout…" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="master-admin-panel dash-premium p-4 text-[13px] font-semibold text-[#991B1B]">
        {error || "Rollout not found"}
      </div>
    );
  }

  const { rollout, progress, products, migrationPlan, autoNote } = detail;

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title={`Rollout #${rollout.id}`}
        subtitle={`${rollout.companyName || rollout.customerUid} · ${rollout.status}`}
        backHref="/master-admin/ar360-system/customer-rollouts"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Customer Rollouts", href: "/master-admin/ar360-system/customer-rollouts" },
          { label: `#${rollout.id}` },
        ]}
      />

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

      <div className="dash-premium-card border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 text-[12px] font-semibold text-[#92400E]">
        {autoNote}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="dash-premium-card space-y-2 p-4 text-[13px]">
          <div className="font-semibold">Client</div>
          <div>{rollout.companyName || "—"}</div>
          <div className="text-[11px] text-[#6B7280]">{rollout.customerUid}</div>
          <div>
            Current: <strong>{rollout.currentReleaseVersion || "—"}</strong>
          </div>
          <div>
            Target: <strong>{rollout.targetReleaseVersion || "—"}</strong>
          </div>
          <div>
            Policy snapshot: <strong>{rollout.updatePolicySnapshot}</strong> · live:{" "}
            <strong>{rollout.livePolicy}</strong>
          </div>
          {rollout.approvedAt ? (
            <div className="text-[12px] text-[#065F46]">
              Approved {new Date(rollout.approvedAt).toLocaleString()}
            </div>
          ) : null}
          {rollout.upToDateLabel ? (
            <div className="rounded-lg bg-[#ECFDF5] px-3 py-2 text-[12px] font-bold text-[#065F46]">
              {rollout.upToDateLabel}
            </div>
          ) : null}
          <div className="text-[12px] text-[#6B7280]">
            Migration plan{" "}
            <Link
              href={`/master-admin/ar360-system/migrations/${migrationPlan.id}`}
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              #{migrationPlan.id}
            </Link>{" "}
            ({migrationPlan.status})
          </div>
        </div>

        <div className="dash-premium-card space-y-3 p-4 text-[13px]">
          <div className="font-semibold">Controls</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void postAction({ action: "preview" })}
            >
              Preview
            </button>
            <button
              type="button"
              className="dash-premium-btn-primary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() =>
                void postAction({
                  action: "canary",
                  confirm: true,
                  productIds: canaryIds
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            >
              Start Canary
            </button>
            <button
              type="button"
              className="dash-premium-btn-primary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void postAction({ action: "batch", confirm: true })}
            >
              Start Next Batch
            </button>
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void postAction({ action: "pause" })}
            >
              Pause
            </button>
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void postAction({ action: "resume" })}
            >
              Resume
            </button>
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void postAction({ action: "cancel" })}
            >
              Cancel
            </button>
          </div>
          <label className="block text-[12px] font-semibold">
            Canary product IDs (comma-separated)
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={canaryIds}
              onChange={(e) => setCanaryIds(e.target.value)}
            />
          </label>
          <div className="text-[12px] text-[#6B7280]">
            No Auto Rollout. Failures pause without undoing PASS products. Use component rollback tools
            for unhealthy products.
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ["Eligible", progress.eligible],
            ["Migrated", progress.migrated],
            ["Pending", progress.pending],
            ["Blocked", progress.blocked],
            ["Unhealthy", progress.unhealthy],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="dash-premium-card p-3">
            <div className="text-[11px] font-bold uppercase text-[#6B7280]">{label}</div>
            <div className="text-[18px] font-black">{value}</div>
          </div>
        ))}
      </div>

      {preview ? (
        <div className="dash-premium-card p-4 text-[12px]">
          <div className="mb-2 font-semibold">CUSTOMER ROLLOUT PREVIEW</div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-3">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-4 py-3 text-[13px] font-semibold">
          Products
        </div>
        <table className="min-w-full text-left text-[12px]">
          <thead>
            <tr className={adminTableHeadClass}>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Current → Proposed</th>
              <th className="px-4 py-2">Validation</th>
              <th className="px-4 py-2">Rollback</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productId} className={adminTableRowClass}>
                <td className="px-4 py-2 font-semibold">{p.productId}</td>
                <td className="px-4 py-2 font-bold">{p.displayStatus}</td>
                <td className="px-4 py-2 text-[#6B7280]">
                  {JSON.stringify(p.snapshotBefore)} → {JSON.stringify(p.proposed)}
                </td>
                <td className="px-4 py-2 text-[#6B7280]">
                  {p.validationCode || p.validationMessage || "—"}
                </td>
                <td className="px-4 py-2">
                  <Link
                    href="/master-admin/ar360-system/component-versions"
                    className="font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    Component tools
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
