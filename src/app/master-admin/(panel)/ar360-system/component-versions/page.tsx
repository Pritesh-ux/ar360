"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

const COMPONENT_KINDS = ["geometry", "material", "lighting", "viewer", "ar"] as const;
type ComponentKind = (typeof COMPONENT_KINDS)[number];

type ProductListItem = {
  id: string;
  title: string | null;
  customerUid: string | null;
};

type RevisionSummary = {
  id: number;
  productId: string;
  componentKind: string;
  revisionNumber: number;
  componentRevisionNumber: number | null;
  status: string;
  createdAt: string;
  isProductActivePointer: boolean;
  compatible: boolean;
};

type RollbackTarget = RevisionSummary & {
  eligible: boolean;
  rejectionCode: string | null;
  rejectionMessage: string | null;
  isCurrent: boolean;
};

const KIND_LABELS: Record<ComponentKind, string> = {
  geometry: "Geometry",
  material: "Material",
  lighting: "Lighting",
  viewer: "Viewer",
  ar: "AR",
};

export default function Ar360ComponentVersionsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackKind, setRollbackKind] = useState<
    "material" | "lighting" | "viewer" | "ar" | null
  >(null);
  const [rollbackTargets, setRollbackTargets] = useState<RollbackTarget[]>([]);
  const [currentRollbackId, setCurrentRollbackId] = useState<number | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [changeHistory, setChangeHistory] = useState<
    Array<{
      id: number;
      componentKind: string;
      fromRevisionId: number | null;
      toRevisionId: number | null;
      status: string;
      reason: string | null;
      blockReason: string | null;
      health: { ok: boolean } | null;
      adminId: number | null;
      createdAt: string;
    }>
  >([]);

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

  async function selectProduct(productId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    setSelectedId(productId);
    setRollbackOpen(false);
    setRollbackKind(null);
    setPreview(null);
    setSelectedTargetId(null);
    setChangeHistory([]);
    try {
      const [revRes, histRes] = await Promise.all([
        fetch(
          `/api/master-admin/ar360/component-revisions?productId=${encodeURIComponent(productId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/master-admin/ar360/change-history?productId=${encodeURIComponent(productId)}`,
          { cache: "no-store" },
        ),
      ]);
      const data = await revRes.json();
      if (!revRes.ok) throw new Error(data.error || "Failed to load revisions");
      setRevisions(data.revisions || []);
      const hist = await histRes.json();
      if (histRes.ok) setChangeHistory(hist.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load revisions");
      setRevisions([]);
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(kind: ComponentKind) {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/component-revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedId, kind, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create draft");
      setMessage(
        `Created ${kind} draft #${data.revision?.id} (v${data.revision?.componentRevisionNumber ?? "—"})`,
      );
      await selectProduct(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function openRollback(kind: "material" | "lighting" | "viewer" | "ar") {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setSelectedTargetId(null);
    setRollbackKind(kind);
    try {
      const pathMap = {
        material: `/api/master-admin/ar360/material-rollback?productId=${encodeURIComponent(selectedId)}`,
        lighting: `/api/master-admin/ar360/lighting-rollback?productId=${encodeURIComponent(selectedId)}`,
        viewer: `/api/master-admin/ar360/viewer-rollback?productId=${encodeURIComponent(selectedId)}`,
        ar: `/api/master-admin/ar360/ar-rollback?productId=${encodeURIComponent(selectedId)}`,
      } as const;
      const res = await fetch(pathMap[kind], { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load rollback targets");
      setRollbackTargets(data.targets || []);
      setCurrentRollbackId(
        kind === "material"
          ? (data.currentMaterialRevisionId ?? null)
          : kind === "lighting"
            ? (data.currentLightingRevisionId ?? null)
            : kind === "viewer"
              ? (data.currentViewerRevisionId ?? null)
              : (data.currentArRevisionId ?? null),
      );
      setRollbackOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open rollback");
      setRollbackKind(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadRollbackPreview(targetId: number) {
    if (!selectedId || !rollbackKind) return;
    setBusy(true);
    setError("");
    setSelectedTargetId(targetId);
    try {
      const baseMap = {
        material: `/api/master-admin/ar360/material-rollback/${targetId}`,
        lighting: `/api/master-admin/ar360/lighting-rollback/${targetId}`,
        viewer: `/api/master-admin/ar360/viewer-rollback/${targetId}`,
        ar: `/api/master-admin/ar360/ar-rollback/${targetId}`,
      } as const;
      const res = await fetch(`${baseMap[rollbackKind]}?productId=${encodeURIComponent(selectedId)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function executeRollback() {
    if (!selectedId || !selectedTargetId || !rollbackKind) return;
    setBusy(true);
    setError("");
    try {
      const pathMap = {
        material: `/api/master-admin/ar360/material-rollback/${selectedTargetId}`,
        lighting: `/api/master-admin/ar360/lighting-rollback/${selectedTargetId}`,
        viewer: `/api/master-admin/ar360/viewer-rollback/${selectedTargetId}`,
        ar: `/api/master-admin/ar360/ar-rollback/${selectedTargetId}`,
      } as const;
      const labels = {
        material: "Material",
        lighting: "Lighting",
        viewer: "Viewer",
        ar: "AR",
      } as const;
      const res = await fetch(pathMap[rollbackKind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedId,
          confirm: true,
          reason: `Master Admin ${rollbackKind} rollback`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rollback failed");
      setMessage(
        `${labels[rollbackKind]} rolled back #${data.from?.id} → #${data.to?.id}. Only ${rollbackKind} pointer changed.`,
      );
      setConfirmRollback(false);
      setRollbackOpen(false);
      setRollbackKind(null);
      setPreview(null);
      await selectProduct(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  function kindRevisions(kind: ComponentKind) {
    return revisions.filter((r) => r.componentKind === kind);
  }

  const materialHasActive =
    kindRevisions("material").some((r) => r.isProductActivePointer) ||
    revisions.some((r) => r.componentKind === "config" && r.isProductActivePointer);
  const lightingHasActive = kindRevisions("lighting").some((r) => r.isProductActivePointer);
  const viewerHasActive = kindRevisions("viewer").some((r) => r.isProductActivePointer);
  const arHasActive = kindRevisions("ar").some((r) => r.isProductActivePointer);

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Component Versions"
        subtitle="Draft, preview, activate, and component rollback (material/lighting/viewer/AR). Does not change legacy product settings."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Component Versions" },
        ]}
        actions={
          <button
            type="button"
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            onClick={() => void loadList(q)}
          >
            <RefreshCw size={15} />
            Refresh list
          </button>
        }
      />

      <div className="dash-premium-card border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-semibold text-[#1E40AF]">
        Creating or activating a revision updates only that product&apos;s component pointer. Runtime
        stays LEGACY unless canary is enabled separately. Phase 6B guards block unsafe activations.
        Rollback available for Material, Lighting, Viewer, and AR — not Geometry.
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

      <div className="grid gap-3 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)]">
        <div className="dash-premium-card min-w-0 overflow-hidden p-0">
          {loading ? (
            <AdminLoadingState label="Loading products…" />
          ) : products.length === 0 ? (
            <AdminEmptyState
              title="No products"
              description="No products matched the current search."
              action={
                <button
                  type="button"
                  className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                  onClick={() => void loadList(q)}
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
              }
            />
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-4 py-3">Product</th>
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
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void selectProduct(p.id)}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {!selectedId ? (
            <div className="dash-premium-card flex min-h-[280px] items-center justify-center p-6">
              <AdminEmptyState
                title="No product selected"
                description="Select a product from the list to view component revisions."
              />
            </div>
          ) : (
            COMPONENT_KINDS.map((kind) => {
              const rows = kindRevisions(kind);
              return (
                <div key={kind} className="dash-premium-card overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
                    <div className="text-[13px] font-semibold text-[#111827]">
                      {KIND_LABELS[kind]}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {kind === "material" && materialHasActive ? (
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void openRollback("material")}
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </button>
                      ) : null}
                      {kind === "lighting" && lightingHasActive ? (
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void openRollback("lighting")}
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </button>
                      ) : null}
                      {kind === "viewer" && viewerHasActive ? (
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void openRollback("viewer")}
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </button>
                      ) : null}
                      {kind === "ar" && arHasActive ? (
                        <button
                          type="button"
                          className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                          disabled={busy}
                          onClick={() => void openRollback("ar")}
                        >
                          <RotateCcw size={14} />
                          Rollback
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="dash-premium-btn-primary h-9 px-3 text-[11px]"
                        disabled={busy}
                        onClick={() => void createDraft(kind)}
                      >
                        <Plus size={14} />
                        Create Draft
                      </button>
                    </div>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-4 py-3 text-[12px] text-[#6B7280]">No revisions yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-[12px]">
                        <thead>
                          <tr className={adminTableHeadClass}>
                            <th className="px-4 py-2">Version</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Created</th>
                            <th className="px-4 py-2">Pointer</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id} className={adminTableRowClass}>
                              <td className="px-4 py-2 font-semibold">
                                #{r.id}
                                {r.componentRevisionNumber != null
                                  ? ` · v${r.componentRevisionNumber}`
                                  : r.componentKind === "config"
                                    ? " · foundation"
                                    : ""}
                              </td>
                              <td className="px-4 py-2 uppercase">{r.status}</td>
                              <td className="px-4 py-2 text-[#6B7280]">
                                {new Date(r.createdAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-2">
                                {r.isProductActivePointer ? (
                                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                    Active
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <Link
                                  href={`/master-admin/ar360-system/component-versions/${encodeURIComponent(selectedId)}/${r.id}`}
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
              );
            })
          )}

          {rollbackOpen && selectedId && rollbackKind ? (
            <div className="dash-premium-card space-y-3 border-[#FDE68A] bg-[#FFFBEB] p-4">
              <div className="text-[13px] font-semibold text-[#92400E]">
                {rollbackKind === "material"
                  ? "Material"
                  : rollbackKind === "lighting"
                    ? "Lighting"
                    : rollbackKind === "viewer"
                      ? "Viewer"
                      : "AR"}{" "}
                rollback · current #{currentRollbackId ?? "—"}
              </div>
              <p className="text-[12px] text-[#78350F]">
                This rollback changes ONLY{" "}
                <strong>
                  {rollbackKind === "material"
                    ? "Material"
                    : rollbackKind === "lighting"
                      ? "Lighting"
                      : rollbackKind === "viewer"
                        ? "Viewer"
                        : "AR"}
                </strong>
                . It does NOT change Geometry
                {rollbackKind !== "material" ? ", Material" : ""}
                {rollbackKind !== "lighting" ? ", Lighting" : ""}
                {rollbackKind !== "viewer" ? ", Viewer" : ""}
                {rollbackKind !== "ar" ? ", AR" : ""}, or Config. Preview does not mutate
                pointers.
              </p>
              <div className="overflow-x-auto rounded-xl border border-[#FDE68A] bg-white">
                <table className="min-w-full text-left text-[12px]">
                  <thead>
                    <tr className={adminTableHeadClass}>
                      <th className="px-3 py-2">Target</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Eligible</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rollbackTargets.map((t) => (
                      <tr key={t.id} className={adminTableRowClass}>
                        <td className="px-3 py-2 font-semibold">
                          #{t.id}
                          {t.componentRevisionNumber != null ? ` · v${t.componentRevisionNumber}` : ""}
                          {t.isCurrent ? " · CURRENT" : ""}
                        </td>
                        <td className="px-3 py-2 uppercase">{t.status}</td>
                        <td className="px-3 py-2">
                          {t.eligible ? (
                            <span className="font-semibold text-emerald-700">Yes</span>
                          ) : (
                            <span className="text-[#991B1B]">
                              {t.rejectionMessage || t.rejectionCode || "No"}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {t.eligible ? (
                            <button
                              type="button"
                              className="dash-premium-btn-secondary h-8 px-2 text-[11px]"
                              disabled={busy}
                              onClick={() => void loadRollbackPreview(t.id)}
                            >
                              Preview
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview ? (
                <div className="space-y-2 rounded-xl border border-[#F59E0B] bg-white p-3">
                  <div className="rounded-md bg-[#FEF3C7] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[#92400E]">
                    {(preview.banner as string) ||
                      (rollbackKind === "viewer"
                        ? "VIEWER ROLLBACK PREVIEW"
                        : rollbackKind === "ar"
                          ? "AR ROLLBACK PREVIEW"
                          : rollbackKind === "lighting"
                            ? "LIGHTING ROLLBACK PREVIEW"
                            : "ROLLBACK PREVIEW")}
                  </div>
                  <div className="grid gap-2 text-[12px] sm:grid-cols-2">
                    <div>
                      <div className="font-semibold">
                        CURRENT · #{String(preview.currentRevisionId)}
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-[#F8FAFC] p-2 text-[11px]">
                        {JSON.stringify(
                          rollbackKind === "lighting"
                            ? preview.currentLighting
                            : rollbackKind === "viewer"
                              ? preview.currentViewer
                              : rollbackKind === "ar"
                                ? preview.currentAr
                                : preview.currentMaterial0,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                    <div>
                      <div className="font-semibold">
                        ROLLBACK TARGET · #{String(preview.targetRevisionId)}
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-[#F8FAFC] p-2 text-[11px]">
                        {JSON.stringify(
                          rollbackKind === "lighting"
                            ? preview.proposedLighting
                            : rollbackKind === "viewer"
                              ? preview.proposedViewer
                              : rollbackKind === "ar"
                                ? preview.proposedAr
                                : preview.composedMaterial0,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>
                  <div className="text-[12px]">
                    Diff fields:{" "}
                    {Array.isArray(preview.differences) ? preview.differences.length : 0}
                  </div>
                  <button
                    type="button"
                    className="dash-premium-btn-primary h-9 px-3 text-[12px]"
                    disabled={busy || !selectedTargetId}
                    onClick={() => setConfirmRollback(true)}
                  >
                    Confirm rollback…
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="text-[12px] font-semibold text-[#6B7280] underline"
                onClick={() => {
                  setRollbackOpen(false);
                  setRollbackKind(null);
                  setPreview(null);
                  setSelectedTargetId(null);
                }}
              >
                Close rollback panel
              </button>
            </div>
          ) : null}

          {selectedId && changeHistory.length > 0 ? (
            <div className="dash-premium-card overflow-hidden p-0">
              <div className="border-b border-[#E5E7EB] px-4 py-3 text-[13px] font-semibold text-[#111827]">
                Change History
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead>
                    <tr className={adminTableHeadClass}>
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2">Admin</th>
                      <th className="px-4 py-2">Component</th>
                      <th className="px-4 py-2">From → To</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Health</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeHistory.map((h) => (
                      <tr key={h.id} className={adminTableRowClass}>
                        <td className="px-4 py-2 text-[#6B7280]">
                          {new Date(h.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">{h.adminId ?? "—"}</td>
                        <td className="px-4 py-2 uppercase">{h.componentKind}</td>
                        <td className="px-4 py-2 font-semibold">
                          #{h.fromRevisionId ?? "—"} → #{h.toRevisionId ?? "—"}
                        </td>
                        <td className="px-4 py-2 font-bold">{h.status}</td>
                        <td className="px-4 py-2">
                          {h.health == null ? "—" : h.health.ok ? "Healthy" : "Unhealthy"}
                        </td>
                        <td className="px-4 py-2 text-[#6B7280]">
                          {h.reason || h.blockReason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmRollback}
        title={`Rollback ${
          rollbackKind === "viewer"
            ? "viewer"
            : rollbackKind === "ar"
              ? "AR"
              : rollbackKind === "lighting"
                ? "lighting"
                : "material"
        }?`}
        description={
          rollbackKind === "viewer"
            ? `Rollback product ${selectedId}: viewer #${currentRollbackId} → #${selectedTargetId}. This rollback changes ONLY Viewer. It does NOT change Geometry, Material, Lighting, AR, or Config.`
            : rollbackKind === "ar"
              ? `Rollback product ${selectedId}: AR #${currentRollbackId} → #${selectedTargetId}. This rollback changes ONLY AR. It does NOT change Geometry, Material, Lighting, Viewer, or Config.`
              : rollbackKind === "lighting"
                ? `Rollback product ${selectedId}: lighting #${currentRollbackId} → #${selectedTargetId}. This rollback changes ONLY Lighting. It does NOT change Geometry, Material, Viewer, AR, or Config. Legacy lighting settings are not modified.`
                : `Rollback product ${selectedId}: material #${currentRollbackId} → #${selectedTargetId}. ONLY Material changes. Geometry, Lighting, Viewer, AR, and Config stay the same. Legacy material_settings are not modified.`
        }
        confirmText={
          busy
            ? "Rolling back…"
            : `Rollback ${
                rollbackKind === "viewer"
                  ? "viewer"
                  : rollbackKind === "ar"
                    ? "AR"
                    : rollbackKind === "lighting"
                      ? "lighting"
                      : "material"
              }`
        }
        onCancel={() => setConfirmRollback(false)}
        onConfirm={() => {
          if (!busy) void executeRollback();
        }}
      />
    </div>
  );
}
