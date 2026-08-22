"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminLoadingState } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type RevisionSummary = {
  id: number;
  productId: string;
  componentKind: string;
  revisionNumber: number;
  componentRevisionNumber: number | null;
  status: string;
  parentRevisionId: number | null;
  compatibilityLabel: string;
  compatible: boolean;
  createdAt: string;
  updatedAt: string | null;
  createdByAdminId: number | null;
  notes: string | null;
  reason: string | null;
  isProductActivePointer: boolean;
};

type DetailPayload = {
  revision: RevisionSummary;
  configSummary: Record<string, unknown> | null;
  assetRefs: Record<string, unknown> | null;
  compatibility: { label: string; expected: string; pass: boolean };
};

type DiffPayload = {
  match: boolean;
  against: string;
  differences: Array<{ category?: string; field?: string; path?: string }>;
  leftRevisionId: number;
  rightRevisionId: number;
};

type PreviewPayload = {
  draftPreview: boolean;
  banner: string;
  modelUrl: string | null;
  fileName: string | null;
  material0Keys: string[];
  kind: string;
  settingsKeys: string[];
  note?: string;
  currentVsProposed?: Record<
    string,
    { current: number | null; proposed: number | null }
  >;
  activationGate?: { ok: boolean; code?: string; message?: string };
  status?: string;
  health?: { ok: boolean };
};

function readMaterial0(configSummary: Record<string, unknown> | null): Record<string, unknown> {
  if (!configSummary) return {};
  const ms = configSummary.materialSettings;
  if (Array.isArray(ms) && ms[0] && typeof ms[0] === "object") {
    return ms[0] as Record<string, unknown>;
  }
  if (ms && typeof ms === "object" && !Array.isArray(ms)) {
    const obj = ms as Record<string, unknown>;
    const first = obj["0"] ?? obj[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
    // Flat single-material object (no numeric key)
    if ("renderOrder" in obj || "bumpSoftness" in obj) return obj;
  }
  return {};
}

export default function Ar360ComponentRevisionDetailPage() {
  const params = useParams<{ productId: string; revisionId: string }>();
  const productId = params?.productId ? decodeURIComponent(params.productId) : "";
  const revisionId = params?.revisionId || "";

  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [diff, setDiff] = useState<DiffPayload | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [renderOrder, setRenderOrder] = useState("");
  const [bumpSoftness, setBumpSoftness] = useState("");

  const load = useCallback(async () => {
    if (!revisionId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/component-revisions/${revisionId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load revision");
      setDetail(data);
      const m0 = readMaterial0(data.configSummary);
      setRenderOrder(
        m0.renderOrder == null || m0.renderOrder === "" ? "" : String(m0.renderOrder),
      );
      setBumpSoftness(
        m0.bumpSoftness == null || m0.bumpSoftness === "" ? "" : String(m0.bumpSoftness),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load revision");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [revisionId]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function saveMaterialDraft() {
    if (!detail || detail.revision.status !== "draft") return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const existing = readMaterial0(detail.configSummary);
      const nextMaterial0 = {
        ...existing,
        ...(renderOrder !== "" ? { renderOrder: Number(renderOrder) } : {}),
        ...(bumpSoftness !== "" ? { bumpSoftness: Number(bumpSoftness) } : {}),
      };

      const currentMs = detail.configSummary?.materialSettings;
      let materialSettings: Record<string, unknown> | unknown[];
      if (Array.isArray(currentMs)) {
        const arr = [...currentMs];
        arr[0] = nextMaterial0;
        materialSettings = arr;
      } else if (currentMs && typeof currentMs === "object") {
        const obj = { ...(currentMs as Record<string, unknown>) };
        if ("0" in obj || 0 in obj) {
          obj["0"] = nextMaterial0;
          materialSettings = obj;
        } else if ("renderOrder" in obj || "bumpSoftness" in obj || Object.keys(obj).length === 0) {
          materialSettings = nextMaterial0;
        } else {
          obj["0"] = nextMaterial0;
          materialSettings = obj;
        }
      } else {
        materialSettings = { "0": nextMaterial0 };
      }

      const res = await fetch(`/api/master-admin/ar360/component-revisions/${revisionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: true,
          patch: { materialSettings },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage("Draft updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function runDiff() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/master-admin/ar360/component-revisions/${revisionId}/diff?against=active`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diff failed");
      setDiff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diff failed");
      setDiff(null);
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/component-revisions/${revisionId}/preview`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `/api/master-admin/ar360/component-revisions/${revisionId}/activate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      const status = String(data.status || "ACTIVE");
      setMessage(
        data.warning ||
          (status === "UNHEALTHY"
            ? "Activated but UNHEALTHY — rollback available for material only; no automatic rollback."
            : "Revision activated."),
      );
      setConfirmActivate(false);
      setPreview({
        ...(preview || {
          draftPreview: false,
          banner: status,
          modelUrl: null,
          fileName: null,
          material0Keys: [],
          kind: detail?.revision.componentKind || "",
          settingsKeys: [],
        }),
        status,
        health: data.health,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/component-revisions/${revisionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");
      setMessage("Revision archived.");
      setConfirmArchive(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium p-4">
        <AdminLoadingState label="Loading revision…" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="master-admin-panel dash-premium p-4 text-[13px] font-semibold text-[#991B1B]">
        {error || "Revision not found"}
      </div>
    );
  }

  const { revision } = detail;
  const isDraft = revision.status === "draft";
  const isMaterial = revision.componentKind === "material";
  const canArchive = !revision.isProductActivePointer && revision.status !== "archived";

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title={`${revision.componentKind} · #${revision.id}`}
        subtitle={`Product ${productId || revision.productId}${
          revision.componentRevisionNumber != null
            ? ` · component v${revision.componentRevisionNumber}`
            : ""
        }`}
        backHref="/master-admin/ar360-system/component-versions"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Component Versions", href: "/master-admin/ar360-system/component-versions" },
          { label: `#${revision.id}` },
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

      <div className="dash-premium-card grid gap-2 p-4 text-[13px] sm:grid-cols-2">
        <div>
          <span className="text-[#6B7280]">Component:</span>{" "}
          <span className="font-semibold uppercase">{revision.componentKind}</span>
        </div>
        <div>
          <span className="text-[#6B7280]">Status:</span>{" "}
          <span className="font-semibold uppercase">{revision.status}</span>
          {revision.isProductActivePointer ? (
            <span className="ml-2 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              Active pointer
            </span>
          ) : null}
        </div>
        <div>
          <span className="text-[#6B7280]">Created:</span>{" "}
          {new Date(revision.createdAt).toLocaleString()}
        </div>
        <div>
          <span className="text-[#6B7280]">Created by admin:</span>{" "}
          {revision.createdByAdminId ?? "—"}
        </div>
        <div>
          <span className="text-[#6B7280]">Compatibility:</span>{" "}
          <span
            className={`font-semibold ${
              detail.compatibility.pass ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {detail.compatibility.pass ? "PASS" : "FAIL"} ({detail.compatibility.label})
          </span>
        </div>
        <div>
          <span className="text-[#6B7280]">Parent:</span> {revision.parentRevisionId ?? "—"}
        </div>
        {revision.reason ? (
          <div className="sm:col-span-2">
            <span className="text-[#6B7280]">Reason:</span> {revision.reason}
          </div>
        ) : null}
      </div>

      <div className="dash-premium-card space-y-2 p-4">
        <div className="text-[13px] font-semibold">Config summary</div>
        <pre className="max-h-[320px] overflow-auto rounded-xl bg-[#F8FAFC] p-3 text-[12px]">
          {JSON.stringify(detail.configSummary, null, 2)}
        </pre>
      </div>

      <div className="dash-premium-card space-y-2 p-4">
        <div className="text-[13px] font-semibold">Asset refs</div>
        <pre className="max-h-[240px] overflow-auto rounded-xl bg-[#F8FAFC] p-3 text-[12px]">
          {JSON.stringify(detail.assetRefs, null, 2)}
        </pre>
      </div>

      {isDraft && isMaterial ? (
        <div className="dash-premium-card space-y-3 p-4">
          <div className="text-[13px] font-semibold">Edit draft (material · safe fields)</div>
          <p className="text-[12px] text-[#6B7280]">
            Only renderOrder and bumpSoftness on materialSettings[0]. Metalness/roughness editors are
            intentionally not exposed here.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-[12px] font-semibold text-[#374151]">
              renderOrder
              <input
                type="number"
                className="mt-1 block w-36 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={renderOrder}
                onChange={(e) => setRenderOrder(e.target.value)}
              />
            </label>
            <label className="text-[12px] font-semibold text-[#374151]">
              bumpSoftness
              <input
                type="number"
                step="0.01"
                className="mt-1 block w-36 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
                value={bumpSoftness}
                onChange={(e) => setBumpSoftness(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="dash-premium-btn-primary h-10 px-3 text-[12px]"
            disabled={busy}
            onClick={() => void saveMaterialDraft()}
          >
            Save draft
          </button>
        </div>
      ) : null}

      <div className="dash-premium-card flex flex-wrap gap-2 p-4">
        <button
          type="button"
          className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
          disabled={busy}
          onClick={() => void runDiff()}
        >
          Diff vs active
        </button>
        {isDraft ? (
          <button
            type="button"
            className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            disabled={busy}
            onClick={() => void runPreview()}
          >
            Draft preview
          </button>
        ) : null}
        {isDraft ? (
          <button
            type="button"
            className="dash-premium-btn-primary h-10 px-3 text-[12px]"
            disabled={busy}
            onClick={() => setConfirmActivate(true)}
          >
            Activate
          </button>
        ) : null}
        {canArchive ? (
          <button
            type="button"
            className="dash-premium-btn-secondary h-10 px-3 text-[12px] text-[#991B1B]"
            disabled={busy}
            onClick={() => setConfirmArchive(true)}
          >
            Archive
          </button>
        ) : null}
        <Link
          href="/master-admin/ar360-system/component-versions"
          className="dash-premium-btn-secondary inline-flex h-10 items-center px-3 text-[12px]"
        >
          Back to list
        </Link>
      </div>

      {diff ? (
        <div className="dash-premium-card space-y-2 p-4 text-[13px]">
          <div className="font-semibold">
            Diff vs {diff.against}:{" "}
            <span className={diff.match ? "text-emerald-700" : "text-amber-700"}>
              {diff.match ? "MATCH" : `MISMATCH (${diff.differences.length})`}
            </span>
          </div>
          <div className="text-[12px] text-[#6B7280]">
            Left #{diff.leftRevisionId} vs right #{diff.rightRevisionId}
          </div>
          {!diff.match ? (
            <pre className="max-h-[240px] overflow-auto rounded-xl bg-[#F8FAFC] p-3 text-[12px]">
              {JSON.stringify(diff.differences.slice(0, 40), null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className="dash-premium-card space-y-2 border-[#FDE68A] bg-[#FFFBEB] p-4 text-[13px]">
          <div className="rounded-lg bg-[#F59E0B] px-3 py-2 text-center text-[12px] font-black tracking-wide text-white">
            {preview.banner || "DRAFT PREVIEW"}
          </div>
          <div>
            Kind: <span className="font-semibold uppercase">{preview.kind}</span>
            {preview.status ? (
              <>
                {" "}
                · Status: <span className="font-semibold">{preview.status}</span>
              </>
            ) : null}
          </div>
          {preview.currentVsProposed ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                <div className="mb-1 text-[11px] font-black uppercase text-[#6B7280]">CURRENT</div>
                {Object.entries(preview.currentVsProposed).map(([k, v]) => (
                  <div key={`c-${k}`}>
                    {k}: #{v.current ?? "—"}
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                <div className="mb-1 text-[11px] font-black uppercase text-[#92400E]">PROPOSED</div>
                {Object.entries(preview.currentVsProposed).map(([k, v]) => (
                  <div key={`p-${k}`}>
                    {k}: #{v.proposed ?? "—"}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {preview.activationGate && preview.activationGate.ok === false ? (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]">
              Activation would be blocked: {preview.activationGate.message} (
              {preview.activationGate.code})
            </div>
          ) : null}
          <div>modelUrl: {preview.modelUrl || "—"}</div>
          <div>fileName: {preview.fileName || "—"}</div>
          <div>material0 keys: {preview.material0Keys?.length ? preview.material0Keys.join(", ") : "—"}</div>
          <div>settings keys: {preview.settingsKeys?.length ? preview.settingsKeys.join(", ") : "—"}</div>
          {preview.note ? <div className="text-[12px] text-[#92400E]">{preview.note}</div> : null}
        </div>
      ) : null}

      <ConfirmModal
        open={confirmActivate}
        title="Activate this revision?"
        description="Updates only this product's component pointer. Legacy settings columns are unchanged. Other products are not affected. Runtime stays LEGACY unless canary is enabled."
        confirmText={busy ? "Activating…" : "Activate"}
        onCancel={() => setConfirmActivate(false)}
        onConfirm={() => {
          if (!busy) void activate();
        }}
      />
      <ConfirmModal
        open={confirmArchive}
        title="Archive this revision?"
        description="Archived revisions cannot be activated. Active product pointers cannot be archived."
        confirmText={busy ? "Archiving…" : "Archive"}
        danger
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          if (!busy) void archive();
        }}
      />
    </div>
  );
}
