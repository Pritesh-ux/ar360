"use client";

import { useCallback, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import { RefreshCw } from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminEmptyState,
  AdminLoadingState,
  adminTableHeadClass,
  adminTableRowClass,
} from "@/components/ui/admin";
import "@/components/dashboard/dashboard-premium.css";

type Channel = {
  id: number;
  code: string;
  displayName: string;
  isDefault: boolean;
  isCustomerFacing: boolean;
};

export default function Ar360ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master-admin/ar360/channels", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load channels");
      setChannels(data.channels || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <AdminPageHeader
        title="Channels"
        subtitle="Preview / Beta / Stable. Production customers remain on legacy runtime until a later activation phase."
        breadcrumbs={[
          { label: "AR360 System", href: "/master-admin/ar360-system/status" },
          { label: "Channels" },
        ]}
        actions={
          <button type="button" onClick={load} className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {error ? (
        <div className="dash-premium-card border-[#FEE2E2] bg-[#FEF2F2] px-4 py-3 text-[13px] font-semibold text-[#991B1B]">
          {error}
        </div>
      ) : null}

      <div className="dash-premium-card overflow-hidden p-0">
        {loading ? (
          <AdminLoadingState label="Loading channels…" />
        ) : channels.length === 0 ? (
          <AdminEmptyState title="No channels" description="Run Phase 1 migration to seed channels." />
        ) : (
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className={adminTableHeadClass}>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Default</th>
                <th className="px-4 py-3">Customer facing</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className={adminTableRowClass}>
                  <td className="px-4 py-3 font-semibold">{channel.code}</td>
                  <td className="px-4 py-3">{channel.displayName}</td>
                  <td className="px-4 py-3">{channel.isDefault ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{channel.isCustomerFacing ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
