"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminLoadingState, adminTableHeadClass, adminTableRowClass } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Summary = {
  plan: {
    id: number;
    title: string;
    status: string;
    batchSize: number;
    pausedReason: string | null;
    components: string[];
  };
  counts: {
    total: number;
    pending: number;
    pass: number;
    unhealthy: number;
    blocked: number;
  };
  paused: boolean;
  products: Array<{
    productId: string;
    status: string;
    proposed: Record<string, number>;
    applied: Record<string, number> | null;
    snapshotBefore: Record<string, number | null> | null;
    validationCode: string | null;
    validationMessage: string | null;
    errorMessage: string | null;
    health: { ok: boolean } | null;
    rollbackAvailable: {
      material: boolean;
      lighting: boolean;
      viewer: boolean;
      ar: boolean;
      geometry: false;
    };
  }>;
};

export default function Ar360MigrationDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = params?.id || "";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<"canary" | "batch" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/migrations/${planId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load plan");
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load plan");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useDeferredEffect(() => {
    if (planId) void load();
  }, [load, planId]);

  async function runPreview() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/migrations/${planId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "canary" | "batch" | "resume") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/migrations/${planId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirm: action !== "resume" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setMessage(
        action === "resume"
          ? "Plan resumed."
          : data.paused
            ? `Paused: ${data.pausedReason}`
            : `${action} completed.`,
      );
      setConfirmAction(null);
      setPreview(null);
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
        <AdminLoadingState label="Loading migration plan…" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="master-admin-panel dash-premium p-4 text-[13px] font-semibold text-[#991B1B]">
        {error || "Plan not found"}
      </div>
    );
  }

  const { plan, counts, products } = summary;

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title={plan.title}
        subtitle={`Plan #${plan.id} · ${plan.status}`}
        backHref="/master-admin/ar360-system/migrations"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Migrations", href: "/master-admin/ar360-system/migrations" },
          { label: `Plan #${plan.id}` },
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Products", counts.total],
          ["PASS", counts.pass],
          ["UNHEALTHY", counts.unhealthy],
          ["BLOCKED", counts.blocked],
          ["PAUSED", summary.paused ? "YES" : "NO"],
        ].map(([label, value]) => (
          <div key={String(label)} className="dash-premium-card p-3">
            <div className="text-[11px] font-bold uppercase text-[#6B7280]">{label}</div>
            <div className="text-[20px] font-black text-[#111827]">{value}</div>
          </div>
        ))}
      </div>

      {plan.pausedReason ? (
        <div className="dash-premium-card border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[13px] text-[#92400E]">
          {plan.pausedReason}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
          disabled={busy}
          onClick={() => void runPreview()}
        >
          Preview
        </button>
        <button
          type="button"
          className="dash-premium-btn-primary h-9 px-3 text-[12px]"
          disabled={busy || plan.status === "COMPLETED"}
          onClick={() => setConfirmAction("canary")}
        >
          Run canary
        </button>
        <button
          type="button"
          className="dash-premium-btn-primary h-9 px-3 text-[12px]"
          disabled={busy || plan.status === "COMPLETED" || plan.status === "PAUSED"}
          onClick={() => setConfirmAction("batch")}
        >
          Run next batch
        </button>
        {plan.status === "PAUSED" ? (
          <button
            type="button"
            className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
            disabled={busy}
            onClick={() => void runAction("resume")}
          >
            Resume
          </button>
        ) : null}
        <Link
          href="/master-admin/ar360-system/component-versions"
          className="dash-premium-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
        >
          Component rollbacks
        </Link>
      </div>

      {preview ? (
        <div className="dash-premium-card space-y-3 border-[#FDE68A] bg-[#FFFBEB] p-4">
          <div className="rounded-md bg-[#F59E0B] px-3 py-2 text-center text-[12px] font-black tracking-wide text-white">
            {(preview.banner as string) || "MIGRATION PREVIEW"}
          </div>
          {Array.isArray(preview.products)
            ? (preview.products as Array<Record<string, unknown>>).map((p) => (
                <div key={String(p.productId)} className="rounded-xl border border-[#FDE68A] bg-white p-3 text-[12px]">
                  <div className="font-semibold">{String(p.productId)}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <pre className="overflow-auto rounded bg-[#F8FAFC] p-2">
                      CURRENT{"\n"}
                      {JSON.stringify(p.current, null, 2)}
                    </pre>
                    <pre className="overflow-auto rounded bg-[#F8FAFC] p-2">
                      PROPOSED{"\n"}
                      {JSON.stringify(p.proposed, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-2">
                    Changes: {JSON.stringify(p.changes)}
                    {" · "}
                    Validation:{" "}
                    {(p.validation as { ok?: boolean; code?: string })?.ok
                      ? "OK"
                      : (p.validation as { code?: string; message?: string })?.code || "FAIL"}
                  </div>
                </div>
              ))
            : null}
          <div className="text-[12px] text-[#92400E]">Preview does not mutate pointers.</div>
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-4 py-3 text-[13px] font-semibold">
          Product results
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Proposed</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Health</th>
                <th className="px-4 py-2">Error</th>
                <th className="px-4 py-2">Rollback</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId} className={adminTableRowClass}>
                  <td className="px-4 py-2 font-semibold">{p.productId}</td>
                  <td className="px-4 py-2">{JSON.stringify(p.proposed)}</td>
                  <td className="px-4 py-2 font-bold">{p.status}</td>
                  <td className="px-4 py-2">
                    {p.health == null ? "—" : p.health.ok ? "PASS" : "UNHEALTHY"}
                  </td>
                  <td className="px-4 py-2 text-[#991B1B]">
                    {p.errorMessage || p.validationMessage || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {[
                      p.rollbackAvailable.material && "material",
                      p.rollbackAvailable.lighting && "lighting",
                      p.rollbackAvailable.viewer && "viewer",
                      p.rollbackAvailable.ar && "ar",
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={confirmAction != null}
        title={confirmAction === "canary" ? "Run canary migration?" : "Run next batch?"}
        description="Changes ONLY selected component pointers for selected products. Does not enable VERSIONED globally. Does not change QR, subscriptions, billing, or public URLs. No automatic rollback."
        confirmText={busy ? "Running…" : confirmAction === "canary" ? "Run canary" : "Run batch"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!busy && confirmAction) void runAction(confirmAction);
        }}
      />
    </div>
  );
}
