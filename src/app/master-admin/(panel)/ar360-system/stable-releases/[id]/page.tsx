"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import { AdminLoadingState } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Readiness = {
  banner: string;
  releaseId: number;
  version: string | null;
  overall: string;
  checks: Array<{ key: string; label: string; verdict: string; reason: string }>;
  featureFlags: Array<{ key: string; enabled: boolean; note: string }>;
};

type Release = {
  id: number;
  version: string;
  channel: string;
  status: string;
  isActiveStable: boolean;
};

export default function Ar360StableReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [release, setRelease] = useState<Release | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const loadRelease = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load release");
      setRelease(data.release || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
      setRelease(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(() => {
    void loadRelease();
  }, [loadRelease]);

  async function runReadiness() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/readiness`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Readiness failed");
      setReadiness(data);
      setMessage(`Readiness: ${data.overall}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Readiness failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestStable() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/stable-request`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setReadiness(data.readiness || readiness);
      setMessage(data.warning || "Stable requested.");
      await loadRelease();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function activateStable() {
    if (confirmText.trim().toUpperCase() !== "ACTIVATE STABLE") {
      setError('Type ACTIVATE STABLE to confirm.');
      return;
    }
    if (
      !window.confirm(
        "Activate this release as the active stable pointer? Products will NOT be migrated.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/stable-activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      setMessage(data.warning || "Stable activated.");
      setConfirmText("");
      await loadRelease();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="master-admin-panel dash-premium p-4">
        <AdminLoadingState label="Loading release…" />
      </div>
    );
  }

  if (!release) {
    return (
      <div className="master-admin-panel dash-premium p-4 text-[13px] font-semibold text-[#991B1B]">
        {error || "Release not found"}
      </div>
    );
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title={`Release ${release.version}`}
        subtitle={`${release.channel} · ${release.status}`}
        backHref="/master-admin/ar360-system/stable-releases"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Stable Releases", href: "/master-admin/ar360-system/stable-releases" },
          { label: release.version },
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

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="dash-premium-card space-y-2 p-4 text-[13px]">
          <div>
            Release: <strong>{release.version}</strong>
          </div>
          <div>
            Status: <strong className="uppercase">{release.status}</strong>
          </div>
          <div>
            Stable: <strong>{release.isActiveStable ? "YES" : "NO"}</strong>
          </div>
          <div>
            Readiness: <strong>{readiness?.overall || "—"}</strong>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void runReadiness()}
            >
              Run Readiness Check
            </button>
            <button
              type="button"
              className="dash-premium-btn-secondary h-9 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void requestStable()}
            >
              Request Stable
            </button>
          </div>
        </div>

        <div className="dash-premium-card space-y-3 p-4 text-[13px]">
          <div className="font-semibold">Activate Stable</div>
          <div className="text-[12px] text-[#6B7280]">
            Requires prior Request Stable + confirm. Does not migrate products, QR, subscriptions, or
            enable VERSIONED.
          </div>
          <label className="block text-[12px] font-semibold">
            Type ACTIVATE STABLE
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ACTIVATE STABLE"
            />
          </label>
          <button
            type="button"
            className="dash-premium-btn-primary h-9 px-3 text-[12px]"
            disabled={busy}
            onClick={() => void activateStable()}
          >
            Activate Stable
          </button>
        </div>
      </div>

      {readiness ? (
        <div className="dash-premium-card space-y-3 p-4">
          <div className="font-semibold">
            {readiness.banner} — {readiness.overall}
          </div>
          <ul className="space-y-2 text-[12px]">
            {readiness.checks.map((c) => (
              <li key={c.key} className="rounded-lg border border-[#E5E7EB] px-3 py-2">
                <span className="font-bold">{c.verdict}</span> · {c.label}
                <div className="text-[#6B7280]">{c.reason}</div>
              </li>
            ))}
          </ul>
          <div className="pt-2 font-semibold">Feature flags (review only)</div>
          <ul className="space-y-1 text-[12px] text-[#6B7280]">
            {readiness.featureFlags.map((f) => (
              <li key={f.key}>
                {f.key}: {f.enabled ? "ON" : "OFF"} — {f.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
