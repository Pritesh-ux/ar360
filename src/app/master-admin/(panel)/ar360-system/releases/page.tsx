"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { Plus, RefreshCw } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import ConfirmModal from "@/components/features/master-admin/ConfirmModal";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
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

function statusClass(status: string) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

export default function Ar360ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    version: "",
    channel: "preview",
    title: "",
    releaseNotes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/releases", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load releases");
      setReleases(data.releases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load releases");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function createRelease() {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setShowCreate(false);
      setForm({ version: "", channel: "preview", title: "", releaseNotes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Releases"
        subtitle="Platform release records only. Publishing does not migrate customer products."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Releases" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="dash-premium-btn-primary h-10 px-3 text-[12px]"
            >
              <Plus size={15} />
              New Release
            </button>
          </div>
        }
      />

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading releases…" />
        ) : releases.length === 0 ? (
          <AdminEmptyState title="No releases yet" description="Create a draft Preview/Beta/Stable release record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Active Stable</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Published At</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr key={release.id} className={adminTableRowClass}>
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/master-admin/ar360-system/releases/${release.id}`}
                        className="text-[#111827] hover:underline"
                      >
                        {release.version}
                      </Link>
                      <div className="text-[11px] font-medium text-[#6B7280]">{release.title}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{release.channel}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${statusClass(release.status)}`}>
                        {release.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{release.isActiveStable ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{release.createdByName || "—"}</td>
                    <td className="px-4 py-3">{release.publishedAt || "—"}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-[#6B7280]">
                      {release.releaseNotes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showCreate}
        title="Create platform release"
        description="Creates a draft release record only. Does not change product rendering, QR, or subscriptions."
        confirmText={creating ? "Creating…" : "Create Draft"}
        onCancel={() => setShowCreate(false)}
        onConfirm={() => {
          if (!creating) void createRelease();
        }}
      >
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-semibold text-[#374151]">
            Version (MAJOR.MINOR.PATCH)
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="2.0.0"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Channel
            <select
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            >
              <option value="preview">Preview</option>
              <option value="beta">Beta</option>
              <option value="stable">Stable</option>
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Title
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="AR360 2027 Preview"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Release notes
            <textarea
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              rows={4}
              value={form.releaseNotes}
              onChange={(e) => setForm((f) => ({ ...f, releaseNotes: e.target.value }))}
            />
          </label>
        </div>
      </ConfirmModal>
    </div>
  );
}
