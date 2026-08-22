"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { RefreshCw, Search } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type ProductListItem = {
  id: string;
  title: string | null;
  customerUid: string | null;
  canary?: boolean;
};

type ShadowReport = {
  productId: string;
  title: string | null;
  customerUid: string;
  publicId: string | null;
  viewerSlug: string | null;
  resolved: {
    revisionId: number | null;
    revisionNumber: number | null;
    hasActiveRevision: boolean;
    rendererCompatibility: string;
    source: string;
    renderingSource: string;
  };
  comparison: { match: boolean; differences: Array<{ category: string; field: string }> } | null;
  categoryCounts: Record<string, number> | null;
  assets: { ok: boolean; items: Array<{ role: string; path: string; required: boolean; exists: boolean }> };
  note: string;
};

type ComponentsPayload = {
  geometry: { revisionId: number | null; revisionNumber: number | null; source: string; compatible: boolean };
  material: { revisionId: number | null; revisionNumber: number | null; source: string; compatible: boolean };
  lighting: { revisionId: number | null; revisionNumber: number | null; source: string; compatible: boolean };
  viewer: { revisionId: number | null; revisionNumber: number | null; source: string; compatible: boolean };
  ar: { revisionId: number | null; revisionNumber: number | null; source: string; compatible: boolean };
  compatibility: { pass: boolean; failures: Array<{ component: string; reason: string }> };
};

export default function Ar360ProductResolutionPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState<ShadowReport | null>(null);
  const [components, setComponents] = useState<ComponentsPayload | null>(null);
  const [runtime, setRuntime] = useState<{ mode: string; reason: string; canary: boolean } | null>(
    null,
  );
  const [scanSummary, setScanSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const loadList = useCallback(async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/master-admin/ar360/product-resolution?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load products");
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void loadList();
  }, [loadList]);

  async function inspect(productId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    setScanSummary(null);
    setSelectedId(productId);
    try {
      const res = await fetch(
        `/api/master-admin/ar360/product-resolution?productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to inspect product");
      setReport(data.report);
      setComponents(data.components || null);
      setRuntime(data.runtime || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspect failed");
      setReport(null);
      setComponents(null);
      setRuntime(null);
    } finally {
      setBusy(false);
    }
  }

  async function scanAll() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const res = await fetch(`/api/master-admin/ar360/product-resolution?scanAll=1`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setScanSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function setCanary(enabled: boolean) {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/runtime-canary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedId, enabled, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Canary update failed");
      setMessage(
        enabled
          ? `VERSIONED runtime enabled for ${selectedId} only. Other products remain LEGACY.`
          : `VERSIONED runtime disabled for ${selectedId}. Product returned to LEGACY.`,
      );
      setConfirmEnable(false);
      setConfirmDisable(false);
      await inspect(selectedId);
      await loadList(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Canary update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Product Resolution"
        subtitle="Shadow diagnostics + controlled canary. Default production runtime remains LEGACY."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Product Resolution" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
              onClick={() => void loadList(q)}
            >
              <RefreshCw size={15} />
              Refresh list
            </button>
            <button
              type="button"
              className="dash-premium-btn-primary h-10 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void scanAll()}
            >
              Scan all products
            </button>
          </div>
        }
      />

      <div className="dash-premium-card border-[#FEF3C7] bg-[#FFFBEB] px-4 py-3 text-[13px] font-semibold text-[#92400E]">
        Pointer existence alone does NOT switch runtime. VERSIONED is only for explicit canary
        products. Safe fallback to LEGACY on failure.
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

      <div className="dash-premium-card flex flex-wrap items-end gap-2 p-4">
        <label className="min-w-[240px] flex-1 text-[12px] font-semibold text-[#374151]">
          Search products
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product id, title, customer"
            />
            <button
              type="button"
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
              onClick={() => void loadList(q)}
            >
              <Search size={15} />
              Search
            </button>
          </div>
        </label>
      </div>

      {scanSummary ? (
        <div className="dash-premium-card space-y-1 p-4 text-[13px]">
          <div className="font-semibold">Shadow scan summary</div>
          <pre className="overflow-x-auto rounded-xl bg-[#F8FAFC] p-3 text-[12px]">
            {JSON.stringify(scanSummary, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="dash-premium-card overflow-hidden p-0">
          {loading ? (
            <AdminLoadingState label="Loading products…" />
          ) : products.length === 0 ? (
            <AdminEmptyState
              title="No products"
              description="No products matched the current search."
            />
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Canary</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={`${adminTableRowClass} ${selectedId === p.id ? "bg-[#F8FAFC]" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold">{p.title || "Untitled"}</div>
                        <div className="text-[11px] text-[#6B7280]">{p.id}</div>
                      </td>
                      <td className="px-4 py-3">{p.canary ? "ON" : "OFF"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void inspect(p.id)}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="dash-premium-card space-y-3 p-4 text-[13px]">
          {!report ? (
            <div className="text-[#6B7280]">Select a product to inspect resolution + canary controls.</div>
          ) : (
            <>
              <div className="font-semibold text-[#111827]">{report.title || report.productId}</div>
              <div>Product ID: {report.productId}</div>
              <div>Public ID: {report.publicId || "—"}</div>
              <div>Viewer slug: {report.viewerSlug || "—"}</div>
              <div>
                Runtime mode:{" "}
                <span className="font-semibold uppercase">
                  {runtime?.mode === "versioned" ? "VERSIONED" : "LEGACY"}
                </span>
              </div>
              <div>Canary: {runtime?.canary ? "ON" : "OFF"}</div>
              <div>Selection reason: {runtime?.reason || "—"}</div>
              <div>
                Shadow comparison:{" "}
                <span
                  className={`font-semibold ${
                    report.comparison?.match ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {!report.resolved.hasActiveRevision
                    ? "N/A"
                    : report.comparison?.match
                      ? "MATCH"
                      : `MISMATCH (${report.comparison?.differences.length || 0})`}
                </span>
              </div>
              <div>
                Compatibility:{" "}
                <span
                  className={`font-semibold ${
                    components?.compatibility.pass ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {components?.compatibility.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <div>Fallback: Available</div>

              {components ? (
                <div className="rounded-xl bg-[#F8FAFC] p-3 text-[12px]">
                  <div className="mb-1 font-semibold">Component versions</div>
                  {(["geometry", "material", "lighting", "viewer", "ar"] as const).map((key) => (
                    <div key={key}>
                      {key}:{" "}
                      {components[key].revisionId
                        ? `#${components[key].revisionId} (v${components[key].revisionNumber}) · ${components[key].source}`
                        : "legacy"}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!runtime?.canary ? (
                  <button
                    type="button"
                    className="dash-premium-btn-primary h-10 px-3 text-[12px]"
                    disabled={busy || !report.comparison?.match}
                    onClick={() => setConfirmEnable(true)}
                  >
                    Enable Versioned Runtime
                  </button>
                ) : (
                  <button
                    type="button"
                    className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                    disabled={busy}
                    onClick={() => setConfirmDisable(true)}
                  >
                    Disable Versioned Runtime
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-[#EFF6FF] p-3 text-[12px] text-[#1E40AF]">
                Preview: Shadow comparison above is Legacy vs Versioned config. Enabling canary applies
                versioned overlay only for this product ID.
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmEnable}
        title="Enable VERSIONED runtime?"
        description="This enables versioned runtime for ONE product only. All other products remain LEGACY. QR, public URL, and subscription are unchanged. Reversible."
        confirmText={busy ? "Enabling…" : "Enable canary"}
        onCancel={() => setConfirmEnable(false)}
        onConfirm={() => {
          if (!busy) void setCanary(true);
        }}
      />
      <ConfirmModal
        open={confirmDisable}
        title="Disable VERSIONED runtime?"
        description="Product returns to LEGACY runtime. Versioned revisions are kept (not deleted)."
        confirmText={busy ? "Disabling…" : "Disable canary"}
        danger
        onCancel={() => setConfirmDisable(false)}
        onConfirm={() => {
          if (!busy) void setCanary(false);
        }}
      />
    </div>
  );
}
