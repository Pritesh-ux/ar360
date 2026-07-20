"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
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
    <>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Viewers" value={fmt(data.activeViewers)} icon={Users} iconClass="bg-[#EEF9E0] text-[#84D400]" />
        <StatCard label="Views / Hour" value={fmt(data.viewsLastHour)} icon={Eye} iconClass="bg-sky-50 text-sky-600" />
        <StatCard label="AR / Hour" value={fmt(data.arLaunchesLastHour)} icon={Smartphone} iconClass="bg-orange-50 text-orange-600" />
        <StatCard label="Screenshots / Hour" value={fmt(data.screenshotsLastHour)} icon={Camera} iconClass="bg-violet-50 text-violet-600" />
        <StatCard label="Shares / Hour" value={fmt(data.sharesLastHour)} icon={Share2} iconClass="bg-amber-50 text-amber-600" />
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
        <div className="flex min-h-[560px] flex-col xl:flex-row">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between border-b border-[#ECECEC] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Recent Events</h2>
                <p className="mt-0.5 text-xs font-medium text-[#737373]">Last 50 analytics events</p>
              </div>
              <Activity size={20} className="text-[#84D400]" />
            </div>

            {loading ? (
              <div className="grid h-80 place-items-center text-[#737373]">
                <Loader2 className="animate-spin" />
              </div>
            ) : data.recentEvents.length === 0 ? (
              <div className="grid h-80 place-items-center text-center">
                <Activity className="mx-auto text-[#D4D4D4]" size={42} />
                <p className="mt-3 text-sm font-semibold text-[#111111]">No live events yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECECEC] bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                      <th className="px-5 py-3.5">Event</th>
                      <th className="px-5 py-3.5">Product</th>
                      <th className="px-5 py-3.5">Device</th>
                      <th className="px-5 py-3.5">Browser</th>
                      <th className="px-5 py-3.5">Country</th>
                      <th className="px-5 py-3.5">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentEvents.map((event) => (
                      <tr key={event.id} className="border-b border-[#ECECEC] hover:bg-[#FAFAFA]">
                        <td className="px-5 py-3.5 font-semibold text-[#111111]">{eventLabel(event.event)}</td>
                        <td className="px-5 py-3.5 text-[#737373]">{event.product_uid}</td>
                        <td className="px-5 py-3.5 text-[#737373]">{event.device}</td>
                        <td className="px-5 py-3.5 text-[#737373]">{event.browser}</td>
                        <td className="px-5 py-3.5 text-[#737373]">{event.country || "—"}</td>
                        <td className="px-5 py-3.5 text-[#737373]">{timeAgo(event.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 border-t border-[#ECECEC] p-5 xl:w-[320px] xl:border-l xl:border-t-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#EEF9E0] text-[#84D400]">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111111]">Live Status</h2>
                <p className="text-xs font-medium text-[#737373]">Updated every 10 seconds</p>
              </div>
            </div>

            <div className="mt-5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">Latest Event</p>
              {latestEvent ? (
                <div className="mt-3">
                  <p className="font-semibold text-[#111111]">{eventLabel(latestEvent.event)}</p>
                  <p className="mt-1 break-all text-sm font-medium text-[#737373]">{latestEvent.product_uid}</p>
                  <p className="mt-3 text-xs font-medium text-[#A3A3A3]">{timeAgo(latestEvent.created_at)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm font-medium text-[#737373]">No events yet.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">{label}</p>
          <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-[#111111]">{value}</p>
        </div>
      </div>
    </div>
  );
}
