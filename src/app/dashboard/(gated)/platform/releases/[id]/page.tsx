"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import "@/components/dashboard/dashboard-premium.css";

type Detail = {
  release: { id: number; version: string; title: string; publishedAt: string | null };
  currentVersion: string | null;
  targetVersion: string;
  releaseNotes: {
    title: string;
    summary: string;
    newFeatures: string[];
    improvements: string[];
    bugFixes: string[];
    compatibilityNotes: string[];
    breakingChanges: string[];
    customerImpact: string;
  };
  overallCompatibility: string;
  products: Array<{
    productId: string;
    title: string | null;
    compatibility: string;
    productMigration: string;
    actionLabel: string;
    material: { label: string };
    lighting: { label: string };
    viewer: { label: string };
    ar: { label: string };
  }>;
  updatePolicy: string;
  approvalRequired: boolean;
  openRollouts: Array<{
    id: number;
    status: string;
    migrationPlanId: number;
    progress: { pending: number; pass: number } | null;
  }>;
  note: string;
};

export default function CustomerPlatformReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rolloutPreview, setRolloutPreview] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/account/platform/releases/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setDetail(json);
      await fetch(`/api/account/platform/releases/${id}/view`, { method: "POST" }).catch(
        () => undefined,
      );
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

  async function reviewProductUpdate(rolloutId?: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/account/platform/releases/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_product_update",
          rolloutId: rolloutId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Review failed");
      setMessage(json.warning || "Review recorded.");
      if (rolloutId) {
        const prev = await fetch(`/api/account/platform/rollouts/${rolloutId}`, {
          cache: "no-store",
        });
        const prevJson = await prev.json();
        if (prev.ok) setRolloutPreview(prevJson);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading label="Loading platform update…" />
      </UserPanelPageShell>
    );
  }

  if (!detail) {
    return (
      <UserPanelPageShell>
        <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error || "Release not found"}
        </div>
        <Link href="/dashboard/platform" className="mt-3 inline-block font-semibold text-[var(--color-primary)]">
          Back to Platform
        </Link>
      </UserPanelPageShell>
    );
  }

  const notes = detail.releaseNotes;
  const allCompatible = detail.products.every((p) => p.productMigration === "NOT_REQUIRED");

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title={`Platform Update ${detail.release.version}`}
        subtitle="Review only — your products are not changed by opening this page."
        actions={
          <Link
            href="/dashboard/platform"
            className="inline-flex h-11 items-center rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold"
          >
            Back
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] px-4 py-3 text-[13px] font-semibold text-[#065F46]">
          {message}
        </div>
      ) : null}

      <div className="dash-premium-card mb-4 grid gap-3 p-5 sm:grid-cols-3">
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Your version</div>
          <div className="text-[22px] font-black">{detail.currentVersion || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">This release</div>
          <div className="text-[22px] font-black">{detail.targetVersion}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Compatibility</div>
          <div className="text-[18px] font-black">{detail.overallCompatibility}</div>
        </div>
      </div>

      <div className="dash-premium-card mb-4 space-y-3 p-5 text-[13px]">
        <div className="text-[15px] font-bold">Release notes</div>
        <div className="font-semibold">{notes.title || detail.release.title}</div>
        <p className="text-[#4B5563]">{notes.summary}</p>
        {notes.newFeatures.length ? (
          <ul className="list-disc pl-5">
            {notes.newFeatures.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-[#6B7280]">{notes.customerImpact}</p>
        {notes.breakingChanges.length ? (
          <div className="rounded-xl bg-[#FFFBEB] px-3 py-2 text-[#92400E]">
            <div className="font-bold">Breaking changes</div>
            <ul className="mt-1 list-disc pl-5">
              {notes.breakingChanges.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {allCompatible ? (
        <div className="dash-premium-card mb-4 border-[#BBF7D0] bg-[#F0FDF4] px-5 py-4 text-[13px] font-semibold text-[#166534]">
          Your products are compatible. No product update is required for this platform release.
        </div>
      ) : (
        <div className="dash-premium-card mb-4 border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 text-[13px] font-semibold text-[#92400E]">
          Some products may need a product review. This is separate from the platform update itself.
        </div>
      )}

      <div className="dash-premium-card mb-4 overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-5 py-3 text-[15px] font-bold">
          Product compatibility
        </div>
        <table className="min-w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Compatibility</th>
              <th className="px-4 py-2">Product update</th>
            </tr>
          </thead>
          <tbody>
            {detail.products.map((p) => (
              <tr key={p.productId} className="border-b border-[#F3F4F6]">
                <td className="px-4 py-3 font-semibold">{p.title || p.productId}</td>
                <td className="px-4 py-3 font-bold">{p.compatibility}</td>
                <td className="px-4 py-3">{p.actionLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dash-premium-card mb-4 space-y-3 p-5">
        <div className="text-[15px] font-bold">Product updates</div>
        <p className="text-[13px] text-[#6B7280]">
          A platform update is not the same as a product configuration update. Review eligible products
          and request a controlled update when appropriate.
        </p>
        <Link
          href={`/dashboard/platform/releases/${id}/update-review`}
          className="inline-flex h-11 items-center rounded-2xl bg-[#B6FF38] px-5 text-sm font-semibold text-[#102000]"
        >
          Review Product Updates
        </Link>
      </div>

      {detail.openRollouts.length > 0 ? (
        <div className="dash-premium-card mb-4 space-y-3 p-5">
          <div className="text-[15px] font-bold">Product review available</div>
          <p className="text-[13px] text-[#6B7280]">
            A controlled product update was prepared using the existing AR360 rollout process. Reviewing
            does not start migration. AUTO never runs automatically.
          </p>
          {detail.approvalRequired ? (
            <div className="text-[12px] font-semibold text-[#1E40AF]">
              Your account requires approval before product updates can start.
            </div>
          ) : null}
          {detail.openRollouts.map((r) => (
            <div key={r.id} className="rounded-xl border border-[#E5E7EB] px-4 py-3 text-[13px]">
              <div className="font-semibold">
                Prepared update · {r.status}
                {r.progress ? ` · ${r.progress.pass} done / ${r.progress.pending} pending` : ""}
              </div>
              <button
                type="button"
                className="mt-2 inline-flex h-10 items-center rounded-2xl bg-[#B6FF38] px-4 text-sm font-semibold text-[#102000] disabled:opacity-50"
                disabled={busy}
                onClick={() => void reviewProductUpdate(r.id)}
              >
                Review Product Changes
              </button>
            </div>
          ))}
          {rolloutPreview ? (
            <pre className="max-h-48 overflow-auto rounded-xl bg-[#F9FAFB] p-3 text-[11px]">
              {JSON.stringify(rolloutPreview, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      <p className="text-[12px] text-[#6B7280]">{detail.note}</p>
    </UserPanelPageShell>
  );
}
