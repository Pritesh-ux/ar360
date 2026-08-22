"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserWorkspaceLoading from "@/components/user-panel/UserWorkspaceLoading";
import "@/components/dashboard/dashboard-premium.css";

type Center = {
  currentVersion: string | null;
  latestStableVersion: string | null;
  latestStableReleaseId: number | null;
  status: string;
  updatePolicy: string;
  releaseNotes: {
    title: string;
    summary: string;
    newFeatures: string[];
    improvements: string[];
    bugFixes: string[];
    compatibilityNotes: string[];
    breakingChanges: string[];
    customerImpact: string;
  } | null;
  compatibilitySummary: {
    total: number;
    compatible: number;
    warning: number;
    blocked: number;
  };
  products: Array<{
    productId: string;
    title: string | null;
    config: { label: string };
    material: { label: string };
    lighting: { label: string };
    viewer: { label: string };
    ar: { label: string };
    compatibility: string;
    productMigration: string;
    actionLabel: string;
  }>;
  releaseHistory: Array<{
    id: number;
    version: string;
    title: string;
    publishedAt: string | null;
    isLatestStable: boolean;
    isCurrentForCustomer: boolean;
    viewState: string;
  }>;
  openRollouts: Array<{ id: number; status: string; targetReleaseId: number }>;
  note: string;
};

function NotesList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[12px] font-bold uppercase text-[#6B7280]">{title}</div>
      <ul className="mt-1 list-disc pl-5 text-[13px]">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CustomerPlatformPage() {
  const [data, setData] = useState<Center | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/platform-status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <UserPanelPageShell>
        <UserWorkspaceLoading label="Loading platform update center…" />
      </UserPanelPageShell>
    );
  }

  const notes = data?.releaseNotes;
  const statusLabel =
    data?.status === "UPDATE_AVAILABLE"
      ? "UPDATE AVAILABLE"
      : data?.status === "COMPATIBILITY_REVIEW"
        ? "COMPATIBILITY REVIEW"
        : "CURRENT";

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="AR360 Platform"
        subtitle="Platform updates are separate from product configuration updates."
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <div className="dash-premium-card mb-4 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Current Version</div>
          <div className="text-[24px] font-black">{data?.currentVersion || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Latest Stable</div>
          <div className="text-[24px] font-black">{data?.latestStableVersion || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-[#6B7280]">Status</div>
          <div className="text-[18px] font-black text-[var(--color-primary)]">{statusLabel}</div>
          <div className="text-[11px] text-[#6B7280]">Policy: {data?.updatePolicy}</div>
        </div>
        <div className="flex items-end">
          {data?.latestStableReleaseId ? (
            <Link
              href={`/dashboard/platform/releases/${data.latestStableReleaseId}`}
              className="inline-flex h-11 items-center rounded-2xl bg-[#B6FF38] px-5 text-sm font-semibold text-[#102000]"
            >
              Review Update
            </Link>
          ) : (
            <div className="text-[13px] font-semibold text-[#6B7280]">
              Your AR360 platform is up to date.
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-[13px] text-[#6B7280]">{data?.note}</p>

      <div className="dash-premium-card mb-4 space-y-4 p-5">
        <div className="text-[15px] font-bold">What&apos;s New</div>
        {notes ? (
          <>
            <div className="text-[20px] font-black">
              {data?.latestStableVersion || notes.title || "Release"}
            </div>
            {notes.title ? <div className="font-semibold">{notes.title}</div> : null}
            <p className="text-[13px] text-[#4B5563]">{notes.summary || "No summary yet."}</p>
            <NotesList title="Features" items={notes.newFeatures} />
            <NotesList title="Improvements" items={notes.improvements} />
            <NotesList title="Bug Fixes" items={notes.bugFixes} />
          </>
        ) : (
          <p className="text-[13px] text-[#6B7280]">No platform release notes available.</p>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="dash-premium-card space-y-2 p-5">
          <div className="text-[15px] font-bold">Compatibility</div>
          <div className="text-[18px] font-black">
            {data?.compatibilitySummary.blocked
              ? "BLOCKED"
              : data?.compatibilitySummary.warning
                ? "WARNING"
                : data?.compatibilitySummary.compatible
                  ? "COMPATIBLE"
                  : "UNKNOWN"}
          </div>
          <div className="text-[12px] text-[#6B7280]">
            Compatible {data?.compatibilitySummary.compatible ?? 0} · Warning{" "}
            {data?.compatibilitySummary.warning ?? 0} · Blocked{" "}
            {data?.compatibilitySummary.blocked ?? 0}
          </div>
          <NotesList title="Notes" items={notes?.compatibilityNotes || []} />
        </div>
        <div className="dash-premium-card space-y-2 p-5">
          <div className="text-[15px] font-bold">Customer Impact</div>
          <p className="text-[13px] text-[#4B5563]">
            {notes?.customerImpact ||
              "Platform updates do not change your products unless a controlled product update is run."}
          </p>
          <NotesList title="Breaking changes" items={notes?.breakingChanges || []} />
          {data?.updatePolicy === "AUTO" ? (
            <div className="rounded-xl bg-[#FFFBEB] px-3 py-2 text-[12px] font-semibold text-[#92400E]">
              AUTO policy is stored but not active — updates never run automatically.
            </div>
          ) : null}
          {data?.updatePolicy === "APPROVAL_REQUIRED" ? (
            <div className="rounded-xl bg-[#EFF6FF] px-3 py-2 text-[12px] font-semibold text-[#1E40AF]">
              Approval is required before any product update can start.
            </div>
          ) : null}
        </div>
      </div>

      <div className="dash-premium-card mb-4 overflow-hidden p-0">
        <div className="border-b border-[#E5E7EB] px-5 py-3 text-[15px] font-bold">
          Your Products
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280]">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Config</th>
                <th className="px-4 py-2">Material</th>
                <th className="px-4 py-2">Lighting</th>
                <th className="px-4 py-2">Viewer</th>
                <th className="px-4 py-2">AR</th>
                <th className="px-4 py-2">Compatibility</th>
                <th className="px-4 py-2">Product update</th>
              </tr>
            </thead>
            <tbody>
              {(data?.products || []).map((p) => (
                <tr key={p.productId} className="border-b border-[#F3F4F6]">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.title || "Untitled"}</div>
                    <div className="text-[11px] text-[#6B7280]">{p.productId}</div>
                  </td>
                  <td className="px-4 py-3">{p.config.label}</td>
                  <td className="px-4 py-3">{p.material.label}</td>
                  <td className="px-4 py-3">{p.lighting.label}</td>
                  <td className="px-4 py-3">{p.viewer.label}</td>
                  <td className="px-4 py-3">{p.ar.label}</td>
                  <td className="px-4 py-3 font-bold">{p.compatibility}</td>
                  <td className="px-4 py-3">{p.actionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.products || []).every((p) => p.productMigration === "NOT_REQUIRED") ? (
          <div className="bg-[#ECFDF5] px-5 py-3 text-[13px] font-semibold text-[#065F46]">
            Your products are compatible. No product update is required for this platform release.
          </div>
        ) : null}
        {(data?.openRollouts || []).length > 0 ? (
          <div className="border-t border-[#E5E7EB] px-5 py-3 text-[13px]">
            <div className="font-semibold">Product review available</div>
            <p className="text-[#6B7280]">
              A controlled product update was prepared for your account. Review it on the release
              page — it does not run automatically.
            </p>
            {data?.latestStableReleaseId ? (
              <Link
                href={`/dashboard/platform/releases/${data.latestStableReleaseId}`}
                className="mt-2 inline-flex font-semibold text-[var(--color-primary)] hover:underline"
              >
                Review Product Changes
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="dash-premium-card p-5">
        <div className="mb-3 text-[15px] font-bold">Release History</div>
        <ul className="space-y-2">
          {(data?.releaseHistory || []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-[13px]">
              <div>
                <span className="font-bold">{r.version}</span>
                {r.isLatestStable ? (
                  <span className="ml-2 text-[11px] font-semibold text-[#166534]">Latest</span>
                ) : null}
                {r.isCurrentForCustomer ? (
                  <span className="ml-2 text-[11px] font-semibold text-[#1E40AF]">Current</span>
                ) : null}
                <div className="text-[11px] text-[#6B7280]">{r.title}</div>
              </div>
              <Link
                href={`/dashboard/platform/releases/${r.id}`}
                className="font-semibold text-[var(--color-primary)] hover:underline"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </UserPanelPageShell>
  );
}
