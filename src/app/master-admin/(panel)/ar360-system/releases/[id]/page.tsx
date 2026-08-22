"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import { AdminLoadingState } from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Release = {
  id: number;
  version: string;
  channel: string;
  status: string;
  title: string;
  releaseNotes: string;
  createdByName: string;
  createdAt: string;
  publishedAt: string | null;
  isActiveStable: boolean;
};

export default function Ar360ReleaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [channel, setChannel] = useState("preview");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load release");
      setRelease(data.release);
      setTitle(data.release.title || "");
      setNotes(data.release.releaseNotes || "");
      setChannel(data.release.channel || "preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load release");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    if (!id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, releaseNotes: notes, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setRelease(data.release);
      setMessage("Draft updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setRelease(data.release);
      setMessage(data.warning || "Published.");
      setConfirmPublish(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/releases/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Archive failed");
      setRelease(data.release);
      setMessage("Release archived.");
      setConfirmArchive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
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
        title={`${release.version} · ${release.channel}`}
        subtitle={release.title}
        backHref="/master-admin/ar360-system/releases"
        backLabel="All releases"
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Releases", href: "/master-admin/ar360-system/releases" },
          { label: release.version },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {release.status === "draft" ? (
              <button
                type="button"
                className="dash-premium-btn-primary h-10 px-3 text-[12px]"
                onClick={() => setConfirmPublish(true)}
              >
                Publish
              </button>
            ) : null}
            {release.status !== "archived" ? (
              <button
                type="button"
                className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
                onClick={() => setConfirmArchive(true)}
              >
                Archive
              </button>
            ) : null}
          </div>
        }
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
          <div><span className="font-semibold text-[#6B7280]">Status:</span> {release.status}</div>
          <div><span className="font-semibold text-[#6B7280]">Created by:</span> {release.createdByName || "—"}</div>
          <div><span className="font-semibold text-[#6B7280]">Created at:</span> {release.createdAt}</div>
          <div><span className="font-semibold text-[#6B7280]">Published at:</span> {release.publishedAt || "—"}</div>
          <div><span className="font-semibold text-[#6B7280]">Active stable pointer:</span> {release.isActiveStable ? "Yes" : "No"}</div>
          <div className="rounded-xl bg-[#F8FAFC] p-3 text-[12px] text-[#475569]">
            Compatibility enforcement is not active in Phase 2. This page manages release metadata only.
          </div>
        </div>

        <div className="dash-premium-card space-y-3 p-4">
          <label className="block text-[12px] font-semibold text-[#374151]">
            Title
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={title}
              disabled={release.status !== "draft" || busy}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Channel
            <select
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={channel}
              disabled={release.status !== "draft" || busy}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="preview">Preview</option>
              <option value="beta">Beta</option>
              <option value="stable">Stable</option>
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Release notes
            <textarea
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              rows={6}
              value={notes}
              disabled={release.status !== "draft" || busy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {release.status === "draft" ? (
            <button
              type="button"
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              Save draft
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmPublish}
        title={`Publish AR360 ${release.version} ${release.channel}?`}
        description="This publishes a platform release record only. Existing customer products will NOT be migrated. Active product revision pointers, QR codes, public URLs, and subscriptions will NOT change."
        confirmText={busy ? "Publishing…" : "Publish release"}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => {
          if (!busy) void publish();
        }}
      >
        <div className="mt-3 rounded-xl bg-[#FFFBEB] p-3 text-[12px] font-medium text-[#92400E]">
          Version {release.version} · Channel {release.channel}
          <div className="mt-2 whitespace-pre-wrap text-[#78350F]">{notes || "No release notes."}</div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={confirmArchive}
        title={`Archive AR360 ${release.version}?`}
        description="Archiving hides the release from active draft/publish workflows. It does not migrate or roll back products."
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
