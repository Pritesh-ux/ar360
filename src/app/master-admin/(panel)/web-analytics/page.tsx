"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Eye,
  Filter,
  Globe2,
  Monitor,
  RefreshCw,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import AdminActiveFilterChips from "@/components/features/master-admin/AdminActiveFilterChips";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminAreaChart,
  AdminBarChart,
} from "@/components/features/master-admin/AdminSparkline";
import { AdminActionMessage, AdminLoadingState } from "@/components/ui/admin";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import UserDateRangePicker, {
  defaultDateRange,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import "@/components/dashboard/dashboard-premium.css";
import {
  buildFilterChips,
  useAdminFilterQuery,
  useDebouncedValue,
} from "@/lib/master-admin/admin-filter-query";
import type { ActivityFeedItem, LiveVisitorRow } from "@/lib/web-analytics/types";

type Overview = {
  liveNow: number;
  todayVisitors: number;
  todaySessions: number;
  todayPageViews: number;
  newVisitors: number;
  returningVisitors: number;
};

type TabId = "live" | "overview" | "pages" | "sources" | "devices" | "locations";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function statusDot(status: string) {
  if (status === "live") return "bg-emerald-500";
  if (status === "idle") return "bg-amber-400";
  return "bg-slate-300";
}

export default function WebAnalyticsPage() {
  const [tab, setTab] = useState<TabId>("live");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [visitors, setVisitors] = useState<LiveVisitorRow[]>([]);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [hourly, setHourly] = useState<{ hour: number; visitors: number }[]>([]);
  const [timeseries, setTimeseries] = useState<
    { day: string; visitors: number; sessions: number; views: number }[]
  >([]);
  const [pages, setPages] = useState<
    { path: string; views: number; uniqueVisitors: number; avgSeconds: number }[]
  >([]);
  const [sources, setSources] = useState<{ source: string; sessions: number; percent: number }[]>([]);
  const [devices, setDevices] = useState<{ label: string; count: number; percent: number }[]>([]);
  const [browsers, setBrowsers] = useState<{ label: string; count: number; percent: number }[]>([]);
  const [locations, setLocations] = useState<{ country: string; sessions: number; percent: number }[]>(
    [],
  );
  const [cities, setCities] = useState<
    { city: string; country: string; label: string; sessions: number; percent: number }[]
  >([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [browserFilter, setBrowserFilter] = useState("all");
  const [osFilter, setOsFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [visitorTypeFilter, setVisitorTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [showFilters, setShowFilters] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("7d"));
  const [applying, setApplying] = useState(false);
  const [drawer, setDrawer] = useState<null | {
    label: string;
    firstSeenAt: string;
    lastActiveAt: string;
    location: string;
    device: string;
    browser: string;
    os: string;
    pages: { path: string; title: string; viewedAt: string; durationSeconds: number | null }[];
  }>(null);

  useAdminFilterQuery(
    ["status", "device", "browser", "os", "country", "source", "visitorType", "q", "from", "to", "tab"],
    {
      status: statusFilter,
      device: deviceFilter,
      browser: browserFilter,
      os: osFilter,
      country: countryFilter,
      source: sourceFilter,
      visitorType: visitorTypeFilter,
      q: debouncedSearch,
      from: dateRange.from,
      to: dateRange.to,
      tab,
    },
    (fromUrl) => {
      if (fromUrl.status) setStatusFilter(fromUrl.status);
      if (fromUrl.device) setDeviceFilter(fromUrl.device);
      if (fromUrl.browser) setBrowserFilter(fromUrl.browser);
      if (fromUrl.os) setOsFilter(fromUrl.os);
      if (fromUrl.country) setCountryFilter(fromUrl.country);
      if (fromUrl.source) setSourceFilter(fromUrl.source);
      if (fromUrl.visitorType) setVisitorTypeFilter(fromUrl.visitorType);
      if (fromUrl.q) setSearch(fromUrl.q);
      if (fromUrl.tab && ["live", "overview", "pages", "sources", "devices", "locations"].includes(fromUrl.tab)) {
        setTab(fromUrl.tab as TabId);
      }
      if (fromUrl.from || fromUrl.to) {
        setDateRange({
          preset: "custom",
          from: fromUrl.from || null,
          to: fromUrl.to || null,
        });
      }
    },
  );

  const dateQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (dateRange.preset === "today") params.set("range", "1");
    else if (dateRange.preset === "30d") params.set("range", "30");
    else if (dateRange.preset === "7d") params.set("range", "7");
    return params;
  }, [dateRange.from, dateRange.to, dateRange.preset]);

  const loadLive = useCallback(async () => {
    const params = new URLSearchParams({ section: "live" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (deviceFilter !== "all") params.set("device", deviceFilter);
    if (browserFilter !== "all") params.set("browser", browserFilter);
    if (osFilter !== "all") params.set("os", osFilter);
    if (countryFilter !== "all") params.set("country", countryFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (visitorTypeFilter !== "all") params.set("visitorType", visitorTypeFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const res = await fetch(`/api/master-admin/web-analytics?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load live analytics");
    setVisitors(data.visitors || []);
    setFeed(data.feed || []);
  }, [
    statusFilter,
    deviceFilter,
    browserFilter,
    osFilter,
    countryFilter,
    sourceFilter,
    visitorTypeFilter,
    debouncedSearch,
  ]);

  const loadOverview = useCallback(async () => {
    const params = new URLSearchParams({ section: "overview" });
    dateQuery.forEach((v, k) => params.set(k, v));
    const res = await fetch(`/api/master-admin/web-analytics?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load overview");
    setOverview(data.overview || null);
    setHourly(data.hourly || []);
    setTimeseries(data.timeseries || []);
  }, [dateQuery]);

  const loadSection = useCallback(
    async (section: TabId) => {
      if (section === "live" || section === "overview") return;
      const params = new URLSearchParams({ section });
      dateQuery.forEach((v, k) => params.set(k, v));
      const res = await fetch(`/api/master-admin/web-analytics?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics");
      if (section === "pages") setPages(data.pages || []);
      if (section === "sources") setSources(data.sources || []);
      if (section === "devices") {
        setDevices(data.devices || []);
        setBrowsers(data.browsers || []);
      }
      if (section === "locations") {
        setLocations(data.locations || []);
        setCities(data.cities || []);
      }
    },
    [dateQuery],
  );

  const refresh = useCallback(async () => {
    setError("");
    setApplying(true);
    try {
      await Promise.all([loadLive(), loadOverview(), loadSection(tab)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics temporarily unavailable");
    } finally {
      setLoading(false);
      setApplying(false);
    }
  }, [loadLive, loadOverview, loadSection, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadLive().catch(() => {});
      void loadOverview().catch(() => {});
    }, 8000);
    return () => window.clearInterval(id);
  }, [loadLive, loadOverview]);

  async function openVisitor(visitorId: string) {
    try {
      const res = await fetch(
        `/api/master-admin/web-analytics?section=visitor&visitorId=${encodeURIComponent(visitorId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Visitor not found");
      setDrawer(data.visitor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load visitor");
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "live", label: "Live" },
    { id: "overview", label: "Overview" },
    { id: "pages", label: "Pages" },
    { id: "sources", label: "Traffic Sources" },
    { id: "devices", label: "Devices" },
    { id: "locations", label: "Locations" },
  ];

  const hasLiveFilters =
    statusFilter !== "all" ||
    deviceFilter !== "all" ||
    browserFilter !== "all" ||
    osFilter !== "all" ||
    countryFilter !== "all" ||
    sourceFilter !== "all" ||
    visitorTypeFilter !== "all" ||
    Boolean(search.trim());

  function resetLiveFilters() {
    setStatusFilter("all");
    setDeviceFilter("all");
    setBrowserFilter("all");
    setOsFilter("all");
    setCountryFilter("all");
    setSourceFilter("all");
    setVisitorTypeFilter("all");
    setSearch("");
    setShowFilters(true);
  }

  const filterChips = buildFilterChips([
    { id: "status", active: statusFilter !== "all", label: `Status: ${statusFilter}` },
    { id: "device", active: deviceFilter !== "all", label: `Device: ${deviceFilter}` },
    { id: "browser", active: browserFilter !== "all", label: `Browser: ${browserFilter}` },
    { id: "os", active: osFilter !== "all", label: `OS: ${osFilter}` },
    { id: "country", active: countryFilter !== "all", label: `Country: ${countryFilter}` },
    { id: "source", active: sourceFilter !== "all", label: `Source: ${sourceFilter}` },
    { id: "visitorType", active: visitorTypeFilter !== "all", label: `Visitors: ${visitorTypeFilter}` },
    { id: "q", active: Boolean(search.trim()), label: `Search: ${search.trim()}` },
  ]);

  function removeChip(id: string) {
    if (id === "status") setStatusFilter("all");
    if (id === "device") setDeviceFilter("all");
    if (id === "browser") setBrowserFilter("all");
    if (id === "os") setOsFilter("all");
    if (id === "country") setCountryFilter("all");
    if (id === "source") setSourceFilter("all");
    if (id === "visitorType") setVisitorTypeFilter("all");
    if (id === "q") setSearch("");
  }

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visitors) if (v.country) set.add(v.country);
    for (const l of locations) if (l.country) set.add(l.country);
    return ["all", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [visitors, locations]);

  const browserOptions = useMemo(() => {
    const set = new Set<string>();
    for (const v of visitors) if (v.browser && v.browser !== "unknown") set.add(v.browser);
    for (const b of browsers) if (b.label && b.label !== "unknown") set.add(b.label);
    return ["all", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [visitors, browsers]);

  const hourlyRows = useMemo(
    () =>
      hourly.map((h) => ({
        label: String(h.hour).padStart(2, "0"),
        value: h.visitors,
      })),
    [hourly],
  );

  const timeseriesRows = useMemo(
    () =>
      timeseries.map((row) => ({
        label: row.day.slice(5),
        value: row.visitors,
      })),
    [timeseries],
  );

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Live Visitors"
        subtitle="Real website traffic across marketing, viewers, and customer surfaces."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <UserDateRangePicker value={dateRange} onChange={setDateRange} compact />
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? <AdminActionMessage message={error} variant="error" /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard
          layout="compact"
          title="Live Now"
          value={overview?.liveNow ?? 0}
          iconComponent={Activity}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <AdminMetricCard
          layout="compact"
          title="Today's Visitors"
          value={overview?.todayVisitors ?? 0}
          iconComponent={Users}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <AdminMetricCard
          layout="compact"
          title="Today's Sessions"
          value={overview?.todaySessions ?? 0}
          iconComponent={Monitor}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <AdminMetricCard
          layout="compact"
          title="Page Views"
          value={overview?.todayPageViews ?? 0}
          iconComponent={Eye}
          iconClassName="bg-amber-50 text-amber-600"
        />
        <AdminMetricCard
          layout="compact"
          title="New Visitors"
          value={overview?.newVisitors ?? 0}
          iconComponent={Users}
          iconClassName="bg-lime-50 text-lime-700"
        />
        <AdminMetricCard
          layout="compact"
          title="Returning"
          value={overview?.returningVisitors ?? 0}
          iconComponent={RefreshCw}
          iconClassName="bg-slate-100 text-slate-600"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#ECECEC] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              void loadSection(t.id).catch((err) =>
                setError(err instanceof Error ? err.message : "Load failed"),
              );
            }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              tab === t.id
                ? "bg-[#84D400] text-[#102000]"
                : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoadingState label="Loading live analytics…" />
      ) : tab === "live" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#E8EBE6] bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ECECEC] px-4 py-3">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-semibold transition ${
                  showFilters || hasLiveFilters
                    ? "border-[#84D400] bg-[#F7FCE8] text-[#3D6600]"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
                aria-expanded={showFilters}
                aria-controls="live-visitors-filters"
              >
                <Filter size={14} />
                Filters
                {hasLiveFilters ? (
                  <span className="ml-0.5 rounded-full bg-[#84D400] px-1.5 py-0.5 text-[10px] font-bold text-[#102000]">
                    On
                  </span>
                ) : null}
              </button>
              {hasLiveFilters ? (
                <button
                  type="button"
                  onClick={resetLiveFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3 text-[12px] font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
                >
                  Clear
                </button>
              ) : null}
              <p className="ml-auto text-[11px] font-medium text-[#9CA3AF]">
                {applying ? "Applying filters…" : `${visitors.length} shown · polls every 8s`}
              </p>
            </div>
            {showFilters ? (
              <div
                id="live-visitors-filters"
                className="space-y-2 border-b border-[#F3F4F6] bg-[#FAFBFC] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    <option value="all">All statuses</option>
                    <option value="live">Live</option>
                    <option value="idle">Idle</option>
                  </select>
                  <select
                    value={visitorTypeFilter}
                    onChange={(e) => setVisitorTypeFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    <option value="all">All visitors</option>
                    <option value="new">New today</option>
                    <option value="returning">Returning</option>
                  </select>
                  <select
                    value={deviceFilter}
                    onChange={(e) => setDeviceFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    <option value="all">All devices</option>
                    <option value="desktop">Desktop</option>
                    <option value="mobile">Mobile</option>
                    <option value="tablet">Tablet</option>
                  </select>
                  <select
                    value={browserFilter}
                    onChange={(e) => setBrowserFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    {browserOptions.map((b) => (
                      <option key={b} value={b}>
                        {b === "all" ? "All browsers" : b}
                      </option>
                    ))}
                  </select>
                  <select
                    value={osFilter}
                    onChange={(e) => setOsFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    <option value="all">All OS</option>
                    <option value="windows">Windows</option>
                    <option value="macos">macOS</option>
                    <option value="ios">iOS</option>
                    <option value="android">Android</option>
                    <option value="linux">Linux</option>
                  </select>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c === "all" ? "All countries" : c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12px]"
                  >
                    <option value="all">All sources</option>
                    <option value="direct">Direct</option>
                    <option value="google">Google</option>
                    <option value="social">Social</option>
                    <option value="referral">Referral</option>
                  </select>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search visitor / page / city"
                    className="min-w-[200px] flex-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px]"
                  />
                </div>
                <AdminActiveFilterChips
                  chips={filterChips}
                  onRemove={removeChip}
                  onClearAll={resetLiveFilters}
                />
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#FAFAFA] text-[#6B7280]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Visitor</th>
                    <th className="px-3 py-2 font-semibold">Location</th>
                    <th className="px-3 py-2 font-semibold">Device</th>
                    <th className="px-3 py-2 font-semibold">Browser</th>
                    <th className="px-3 py-2 font-semibold">Page</th>
                    <th className="px-3 py-2 font-semibold">Started</th>
                    <th className="px-3 py-2 font-semibold">Last Active</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[#9CA3AF]">
                        No results found
                        <span className="mt-1 block text-[11px]">
                          Try changing or clearing your filters.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    visitors.map((v) => (
                      <tr
                        key={`${v.sessionId}:${v.visitorId}`}
                        className="cursor-pointer border-t border-[#F3F4F6] hover:bg-[#F9FAFB]"
                        onClick={() => void openVisitor(v.visitorId)}
                      >
                        <td className="px-3 py-2 font-semibold text-[#111827]">{v.label}</td>
                        <td className="px-3 py-2 text-[#4B5563]">{v.location}</td>
                        <td className="px-3 py-2 capitalize text-[#4B5563]">{v.device}</td>
                        <td className="px-3 py-2 text-[#4B5563]">{v.browser}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-[#4B5563]">{v.currentPage}</td>
                        <td className="px-3 py-2 text-[#6B7280]">{fmtTime(v.startedAt)}</td>
                        <td className="px-3 py-2 text-[#6B7280]">{fmtTime(v.lastActiveAt)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 capitalize">
                            <span className={`h-2 w-2 rounded-full ${statusDot(v.status)}`} />
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E8EBE6] bg-white p-4">
            <h3 className="mb-3 text-[13px] font-bold text-[#111827]">Live activity</h3>
            <div className="space-y-3">
              {feed.length === 0 ? (
                <p className="text-[12px] text-[#9CA3AF]">No recent activity.</p>
              ) : (
                feed.map((item) => (
                  <div key={item.id} className="border-b border-[#F3F4F6] pb-2 last:border-0">
                    <p className="text-[12px] font-semibold text-[#111827]">
                      {item.label} {item.summary}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">{fmtTime(item.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#E8EBE6] bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[13px] font-bold">Visitors by hour (today)</h3>
            </div>
            <AdminBarChart rows={hourlyRows} className="mt-2 h-40 w-full" />
          </section>
          <section className="rounded-2xl border border-[#E8EBE6] bg-white p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold">Visitors over time</h3>
              <UserDateRangePicker value={dateRange} onChange={setDateRange} compact />
            </div>
            {timeseriesRows.length === 0 ? (
              <p className="mt-6 text-center text-[12px] text-[#9CA3AF]">No data yet.</p>
            ) : (
              <>
                <AdminAreaChart rows={timeseriesRows} className="mt-2 h-40 w-full" />
                <div className="mt-2 space-y-1.5 border-t border-[#F3F4F6] pt-2">
                  {timeseries.map((row) => (
                    <div key={row.day} className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#374151]">{row.day}</span>
                      <span className="text-[#6B7280]">
                        {row.visitors} vis · {row.sessions} sess · {row.views} views
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      ) : tab === "pages" ? (
        <section className="overflow-hidden rounded-2xl border border-[#E8EBE6] bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#FAFAFA] text-[#6B7280]">
              <tr>
                <th className="px-3 py-2">Page</th>
                <th className="px-3 py-2">Views</th>
                <th className="px-3 py-2">Unique</th>
                <th className="px-3 py-2">Avg. Time</th>
              </tr>
            </thead>
            <tbody>
              {pages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[#9CA3AF]">
                    No page data yet.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr key={p.path} className="border-t border-[#F3F4F6]">
                    <td className="px-3 py-2 font-medium">{p.path}</td>
                    <td className="px-3 py-2">{p.views}</td>
                    <td className="px-3 py-2">{p.uniqueVisitors}</td>
                    <td className="px-3 py-2">{fmtDuration(p.avgSeconds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : tab === "sources" ? (
        <BreakdownList
          empty="No traffic sources yet."
          items={sources.map((s) => ({ label: s.source, value: s.sessions, percent: s.percent }))}
        />
      ) : tab === "devices" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownList
            title="Devices"
            empty="No device data."
            items={devices.map((d) => ({ label: d.label, value: d.count, percent: d.percent }))}
            icon={<Smartphone size={14} />}
          />
          <BreakdownList
            title="Browsers"
            empty="No browser data."
            items={browsers.map((d) => ({ label: d.label, value: d.count, percent: d.percent }))}
            icon={<Globe2 size={14} />}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownList
            title="Cities"
            empty="No city data yet. New visits after geo lookup will appear here."
            items={cities.map((c) => ({
              label: c.label || c.city,
              value: c.sessions,
              percent: c.percent,
            }))}
            icon={<Globe2 size={14} />}
          />
          <BreakdownList
            title="Countries"
            empty="No location data."
            items={locations.map((l) => ({
              label: l.country,
              value: l.sessions,
              percent: l.percent,
            }))}
            icon={<Globe2 size={14} />}
          />
        </div>
      )}

      {drawer ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-3">
              <h3 className="text-[15px] font-bold">{drawer.label}</h3>
              <button type="button" onClick={() => setDrawer(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-4 text-[13px]">
              <Row label="First seen" value={new Date(drawer.firstSeenAt).toLocaleString()} />
              <Row label="Last active" value={new Date(drawer.lastActiveAt).toLocaleString()} />
              <Row label="Location" value={drawer.location} />
              <Row label="Device" value={drawer.device} />
              <Row label="Browser" value={drawer.browser} />
              <Row label="OS" value={drawer.os} />
              <div>
                <p className="mb-2 font-semibold text-[#111827]">Page history</p>
                <div className="space-y-2">
                  {drawer.pages.length === 0 ? (
                    <p className="text-[#9CA3AF]">No pages recorded.</p>
                  ) : (
                    drawer.pages.map((p, i) => (
                      <div key={`${p.path}-${i}`} className="rounded-lg bg-[#F9FAFB] px-3 py-2">
                        <p className="font-medium">{p.path}</p>
                        <p className="text-[11px] text-[#6B7280]">
                          {fmtTime(p.viewedAt)}
                          {p.durationSeconds != null ? ` · ${fmtDuration(p.durationSeconds)}` : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#F3F4F6] pb-2">
      <span className="text-[#6B7280]">{label}</span>
      <span className="text-right font-medium text-[#111827]">{value}</span>
    </div>
  );
}

function BreakdownList({
  title,
  empty,
  items,
  icon,
}: {
  title?: string;
  empty: string;
  items: { label: string; value: number; percent: number }[];
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8EBE6] bg-white p-4">
      {title ? (
        <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold">
          {icon}
          {title}
        </h3>
      ) : null}
      {items.length === 0 ? (
        <p className="text-[12px] text-[#9CA3AF]">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span className="font-medium capitalize">{item.label}</span>
                <span className="text-[#6B7280]">
                  {item.value} · {item.percent}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div
                  className="h-full rounded-full bg-[#84D400]"
                  style={{ width: `${Math.min(100, item.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
