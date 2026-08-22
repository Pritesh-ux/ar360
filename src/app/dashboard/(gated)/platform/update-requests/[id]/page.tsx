"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import "@/components/dashboard/dashboard-premium.css";

type RequestDto = {
  id: number;
  status: string;
  releaseId: number;
  productSelection: string[];
  updatePolicySnapshot: string;
  approvalRequired: boolean;
  previewSnapshot: {
    releaseVersion: string;
    products: Array<{
      productId: string;
      proposed: Record<string, number>;
      current: Record<string, number | null>;
    }>;
  };
  rolloutId: number | null;
  requestedAt: string | null;
};

export default function CustomerUpdateRequestStatusPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [request, setRequest] = useState<RequestDto | null>(null);
  const [progress, setProgress] = useState<{
    status: string;
    progress: { pending: number; migrated: number; unhealthy: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/account/platform/update-requests/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRequest(json.request);
      setProgress(json.rolloutProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function cancel() {
    setError("");
    setMessage("");
    const res = await fetch(`/api/account/platform/update-requests/${id}/cancel`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Cancel failed");
      return;
    }
    setMessage("Request cancelled.");
    setRequest(json.request);
  }

  if (loading) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading label="Loading request…" />
      </UserPanelPageShell>
    );
  }

  if (!request) {
    return (
      <UserPanelPageShell>
        <div className="rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error || "Request not found"}
        </div>
      </UserPanelPageShell>
    );
  }

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title={`Product Update Request #${request.id}`}
        subtitle="Status of your request. Product configuration changes only happen through the controlled rollout."
        actions={
          <Link
            href="/dashboard/platform"
            className="inline-flex h-11 items-center rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold"
          >
            Platform
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
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Status</div>
          <div className="text-[20px] font-black">{request.status.replace(/_/g, " ")}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Release</div>
          <div className="text-[20px] font-black">
            {request.previewSnapshot.releaseVersion || `#${request.releaseId}`}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Products</div>
          <div className="text-[20px] font-black">{request.productSelection.length}</div>
        </div>
      </div>

      {progress ? (
        <div className="dash-premium-card mb-4 p-5 text-[13px]">
          <div className="font-bold">Rollout progress</div>
          <div className="mt-1 text-[#6B7280]">
            {progress.status} · {progress.progress.migrated}/{progress.progress.total} updated ·{" "}
            {progress.progress.pending} pending
            {progress.progress.unhealthy
              ? ` · ${progress.progress.unhealthy} unhealthy (not auto-rolled back)`
              : ""}
          </div>
        </div>
      ) : null}

      <div className="dash-premium-card mb-4 p-5 text-[13px]">
        <div className="mb-2 font-bold">Selected products</div>
        <ul className="list-disc pl-5">
          {request.productSelection.map((pid) => (
            <li key={pid}>{pid}</li>
          ))}
        </ul>
      </div>

      {["REQUESTED", "AWAITING_APPROVAL", "APPROVED", "STALE"].includes(request.status) ? (
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold"
          onClick={() => void cancel()}
        >
          Cancel request
        </button>
      ) : null}
    </UserPanelPageShell>
  );
}
