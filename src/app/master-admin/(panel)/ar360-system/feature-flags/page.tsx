"use client";

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

type Flag = {
  id: number;
  key: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function Ar360FeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ key: "", description: "" });
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/feature-flags", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load flags");
      setFlags(data.flags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  async function createFlag() {
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setShowCreate(false);
      setForm({ key: "", description: "" });
      setMessage(`Created ${data.flag.key} (disabled).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function toggleFlag(flag: Flag) {
    setBusyId(flag.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/master-admin/ar360/feature-flags/${flag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage(
        `${data.flag.key} is now ${data.flag.enabled ? "ON" : "OFF"}. Viewer is not wired to these flags yet.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Feature Flags"
        subtitle="Not subscription entitlements. Flags default OFF and are not consumed by the viewer yet."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Feature Flags" },
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
              New Flag
            </button>
          </div>
        }
      />

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="dash-premium-card border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[13px] font-semibold text-[#1E40AF]">
          {message}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading feature flags…" />
        ) : flags.length === 0 ? (
          <AdminEmptyState title="No flags" description="Create a flag or re-run Phase 1 seed." />
        ) : (
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className={adminTableRowClass}>
                  <td className="px-4 py-3 font-semibold">{flag.key}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{flag.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                        flag.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {flag.enabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{flag.createdAt}</td>
                  <td className="px-4 py-3">{flag.updatedAt}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="dash-premium-btn-secondary h-9 px-3 text-[11px]"
                      disabled={busyId === flag.id}
                      onClick={() => void toggleFlag(flag)}
                    >
                      {flag.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={showCreate}
        title="Create feature flag"
        description="New flags are created DISABLED. They are not wired into the viewer or plan entitlements."
        confirmText="Create (disabled)"
        onCancel={() => setShowCreate(false)}
        onConfirm={() => void createFlag()}
      >
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-semibold text-[#374151]">
            Key
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="new_viewer_engine"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#374151]">
            Description
            <input
              className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
      </ConfirmModal>
    </div>
  );
}
