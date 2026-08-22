"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import "@/components/dashboard/dashboard-premium.css";

type ProductRow = {
  productId: string;
  title: string | null;
  eligibility: string;
  message: string;
  compatibility: string;
  currentLabels: Record<string, string>;
  proposedLabels: Record<string, string>;
  changedComponents: string[];
  unchangedComponents: string[];
};

type Review = {
  release: { id: number; version: string; title: string };
  updatePolicy: string;
  approvalRequired: boolean;
  products: ProductRow[];
  note: string;
};

export default function ProductUpdateReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const releaseId = Number(params?.id);
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!Number.isInteger(releaseId) || releaseId <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/account/platform/releases/${releaseId}/update-review`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setReview(json);
      setSelected([]);
      setAck(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  const eligibleIds = useMemo(
    () => (review?.products || []).filter((p) => p.eligibility === "ELIGIBLE").map((p) => p.productId),
    [review],
  );

  function toggle(id: string) {
    if (!eligibleIds.includes(id)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/account/platform/releases/${releaseId}/update-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: selected,
          acknowledged: ack,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.code || "Request failed");
      setMessage(json.warning || "Request submitted.");
      router.push(`/dashboard/platform/update-requests/${json.request.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading label="Loading product update review…" />
      </UserPanelPageShell>
    );
  }

  if (!review) {
    return (
      <UserPanelPageShell>
        <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error || "Update review unavailable"}
        </div>
        <Link href="/dashboard/platform" className="mt-3 inline-block font-semibold text-[var(--color-primary)]">
          Back to Platform
        </Link>
      </UserPanelPageShell>
    );
  }

  const cta = review.approvalRequired ? "Submit for Approval" : "Request Product Update";

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Product Update Review"
        subtitle={`Platform ${review.release.version} — product configuration changes are separate from the platform update.`}
        actions={
          <Link
            href={`/dashboard/platform/releases/${releaseId}`}
            className="inline-flex h-11 items-center rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold"
          >
            Back to release
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

      <div className="dash-premium-card mb-4 space-y-2 p-5 text-[13px]">
        <div className="font-bold">Release</div>
        <div className="text-[20px] font-black">{review.release.version}</div>
        <div>{review.release.title}</div>
        <div className="text-[#6B7280]">
          Policy: {review.updatePolicy}
          {review.approvalRequired ? " · Approval required" : ""}
        </div>
        {review.updatePolicy === "AUTO" ? (
          <div className="rounded-xl bg-[#FFFBEB] px-3 py-2 font-semibold text-[#92400E]">
            AUTO is stored but not active. Automatic updates never run.
          </div>
        ) : null}
        <p className="text-[#6B7280]">{review.note}</p>
      </div>

      <div className="dash-premium-card mb-4 overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-5 py-3 text-[15px] font-bold">
          Product eligibility
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                <th className="px-4 py-2">Select</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Current</th>
                <th className="px-4 py-2">Proposed</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {review.products.map((p) => {
                const canSelect = p.eligibility === "ELIGIBLE";
                return (
                  <tr key={p.productId} className="border-b border-[#F3F4F6] align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={selected.includes(p.productId)}
                        onChange={() => toggle(p.productId)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.title || "Untitled"}</div>
                      <div className="text-[11px] text-[#6B7280]">{p.productId}</div>
                      <div className="mt-1 text-[11px] text-[#6B7280]">{p.message}</div>
                    </td>
                    <td className="px-4 py-3">
                      Material {p.currentLabels.material} · Lighting {p.currentLabels.lighting}
                      <br />
                      Viewer {p.currentLabels.viewer} · AR {p.currentLabels.ar}
                    </td>
                    <td className="px-4 py-3">
                      {p.changedComponents.length ? (
                        <>
                          Material {p.proposedLabels.material} · Lighting {p.proposedLabels.lighting}
                          <br />
                          Viewer {p.proposedLabels.viewer} · AR {p.proposedLabels.ar}
                          <div className="mt-1 text-[11px] font-semibold text-[#166534]">
                            Changes: {p.changedComponents.join(", ")}
                          </div>
                        </>
                      ) : (
                        <span className="text-[#6B7280]">No changes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {p.eligibility}
                      <div className="font-normal text-[#6B7280]">{p.compatibility}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dash-premium-card mb-4 space-y-3 p-5">
        <div className="text-[15px] font-bold">Confirmation</div>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I reviewed the proposed product updates.</span>
        </label>
        <button
          type="button"
          disabled={busy || !ack || selected.length === 0 || review.updatePolicy === "AUTO"}
          onClick={() => void submit()}
          className="inline-flex h-11 items-center rounded-2xl bg-[#B6FF38] px-5 text-sm font-semibold text-[#102000] disabled:opacity-50"
        >
          {cta}
        </button>
        <p className="text-[12px] text-[#6B7280]">
          This does not update products automatically. Master Admin uses the existing controlled
          rollout process after your request.
        </p>
      </div>
    </UserPanelPageShell>
  );
}
