"use client";

import Link from "next/link";
import { useEffect, useCallback, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Activity,
  ArrowLeft,
  Camera,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Share2,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserStatCard from "@/components/user-panel/UserStatCard";
import { panelTable } from "@/components/user-panel/panel-table";

type AnalyticsEvent = {
  id: number;
  product_uid: string;
  session_id: string;
  event: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  city: string;
  created_at: string;
};

type RealtimeData = {
  activeViewers: number;
  viewsLastHour: number;
  arLaunchesLastHour: number;
  screenshotsLastHour: number;
  sharesLastHour: number;
  recentEvents: AnalyticsEvent[];
};

function emptyRealtime(): RealtimeData {
  return {
    activeViewers: 0,
    viewsLastHour: 0,
    arLaunchesLastHour: 0,
    screenshotsLastHour: 0,
    sharesLastHour: 0,
    recentEvents: [],
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(Number(n || 0));
}

function eventLabel(event: string) {
  return event.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeAgo(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function LiveAnalyticsPage() {
  const [data, setData] = useState<RealtimeData>(emptyRealtime());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const fetchRealtime = useCallback(async (silent = false) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await fetch("/api/analytics/realtime", { cache: "no-store" });
      if (!response.ok) throw new Error("Realtime analytics failed");
      const json = (await response.json()) as RealtimeData;
      setData({ ...emptyRealtime(), ...json });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Realtime analytics failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useDeferredEffect(() => {
    void fetchRealtime(false);
  }, [fetchRealtime]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void fetchRealtime(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchRealtime]);

  const latestEvent = useMemo(() => data.recentEvents[0], [data.recentEvents]);

  async function cleanupOldData() {
    const ok = window.confirm("Delete analytics events older than 180 days for this customer?");
    if (!ok) return;

    setCleanupLoading(true);
    try {
      const response = await fetch("/api/analytics/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysToKeep: 180 }),
      });
      if (!response.ok) throw new Error("Cleanup failed");
      await fetchRealtime(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleanupLoading(false);
    }
  }

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Realtime Viewer Activity"
        subtitle="Active viewers, AR launches, screenshots and recent customer events."
        actions={
          <>
            <Link
              href="/dashboard/analytics"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <ArrowLeft size={16} />
              Overview
            </Link>
            <button
              type="button"
              onClick={() => setAutoRefresh((value) => !value)}
              className={`h-11 rounded-2xl px-4 text-sm font-semibold ${
                autoRefresh
                  ? "bg-[#EEF9E0] text-[#5FA800] ring-1 ring-[#84D400]/30"
                  : "border border-[#ECECEC] bg-white text-[#737373]"
              }`}
            >
              Auto Refresh {autoRefresh ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => fetchRealtime(true)}
              className="flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111]"
            >
              {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh
            </button>
            <button
              type="button"
              onClick={cleanupOldData}
              className="flex h-11 items-center gap-2 rounded-2xl border border-red-100 bg-white px-4 text-sm font-semibold text-red-500"
            >
              {cleanupLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Cleanup
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[20px] border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : null}

      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <UserStatCard label="Active Viewers" value={fmt(data.activeViewers)} icon={Users} accent="lime" />
        <UserStatCard label="Views / Hour" value={fmt(data.viewsLastHour)} icon={Eye} accent="sky" />
        <UserStatCard label="AR / Hour" value={fmt(data.arLaunchesLastHour)} icon={Smartphone} accent="orange" />
        <UserStatCard label="Screenshots / Hour" value={fmt(data.screenshotsLastHour)} icon={Camera} accent="violet" />
        <UserStatCard label="Shares / Hour" value={fmt(data.sharesLastHour)} icon={Share2} accent="amber" />
      </section>

      <section className="dash-premium-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECECEC] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Recent Events</h2>
                <p className="mt-0.5 text-xs font-medium text-[#737373]">Last 50 analytics events</p>
              </div>
              <Activity size={20} className="text-[#84D400]" />
            </div>

            {loading ? (
              <div className="flex min-h-[240px] flex-1 items-center justify-center text-[#737373]">
                <Loader2 className="animate-spin" />
              </div>
            ) : data.recentEvents.length === 0 ? (
              <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center px-5 py-12 text-center">
                <Activity className="text-[#D4D4D4]" size={42} />
                <p className="mt-3 text-sm font-semibold text-[#111111]">No live events yet</p>
                <p className="mt-1 max-w-sm text-xs font-medium text-[#737373]">
                  Open a product in a new tab, then tap View in AR, Share, Copy, or Screenshot. Events show up here within a few seconds.
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className={`${panelTable.table} min-w-[820px]`}>
                  <thead>
                    <tr className={panelTable.theadRow}>
                      <th className={panelTable.th}>Event</th>
                      <th className={panelTable.th}>Product</th>
                      <th className={panelTable.th}>Device</th>
                      <th className={panelTable.th}>Browser</th>
                      <th className={panelTable.th}>Country</th>
                      <th className={panelTable.th}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.map((event) => (
                      <tr key={event.id} className={panelTable.row}>
                        <td className={panelTable.tdStrong}>{eventLabel(event.event)}</td>
                        <td className={panelTable.tdMuted}>{event.product_uid}</td>
                        <td className={panelTable.tdMuted}>{event.device}</td>
                        <td className={panelTable.tdMuted}>{event.browser}</td>
                        <td className={panelTable.tdMuted}>{event.country || "—"}</td>
                        <td className={panelTable.tdMuted}>{timeAgo(event.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="flex w-full shrink-0 flex-col border-t border-[#ECECEC] p-5 xl:w-[320px] xl:min-h-0 xl:border-l xl:border-t-0">
            <div className="flex shrink-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FFFBEB]">
                <Clock size={20} strokeWidth={2.2} className="text-[#F59E0B]" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Live Status</h2>
                <p className="text-xs font-medium text-[#737373]">Updated every 10 seconds</p>
              </div>
            </div>

            <div className="mt-5 flex min-h-[140px] flex-1 flex-col rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">Latest Event</p>
              {latestEvent ? (
                <div className="mt-3 flex flex-1 flex-col">
                  <p className="font-semibold text-[#111111]">{eventLabel(latestEvent.event)}</p>
                  <p className="mt-1 break-all text-sm font-medium text-[#737373]">{latestEvent.product_uid}</p>
                  <p className="mt-auto pt-3 text-xs font-medium text-[#A3A3A3]">{timeAgo(latestEvent.created_at)}</p>
                </div>
              ) : (
                <p className="mt-3 flex flex-1 items-center text-sm font-medium text-[#737373]">No events yet.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </UserPanelPageShell>
  );
}
