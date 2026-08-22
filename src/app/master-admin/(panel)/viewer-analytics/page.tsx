"use client";

import Link from "next/link";
import AppImage from "@/components/shared/AppImage";
import { useEffect, useMemo, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Activity,
  Box,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Filter,
  MousePointerClick,
  QrCode,
  RotateCcw,
  Smartphone,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminAreaChart,
  AdminBarChart,
} from "@/components/features/master-admin/AdminSparkline";
import {
  AdminActionMessage,
  AdminLoadingState,
  AdminPagination,
} from "@/components/ui/admin";
import AdminMetricCard from "@/components/ui/admin/AdminMetricCard";
import "@/components/dashboard/dashboard-premium.css";
import type { PaginationMeta } from "@/lib/master-admin/pagination";

type Trend = { label: string; up: boolean };

type Summary = {
  totalViews: number;
  arOpens: number;
  qrScans: number;
  uniqueVisitors: number;
  avgSessionTime: string;
  bounceRate: number;
  totalViewsFmt: string;
  arOpensFmt: string;
  qrScansFmt: string;
  trends?: {
    views?: Trend;
    arOpens?: Trend;
    qrScans?: Trend;
    avgSession?: Trend;
    bounceRate?: Trend;
  };
  sparklines?: {
    views?: number[];
    arOpens?: number[];
    qrScans?: number[];
    avgSession?: number[];
    bounceRate?: number[];
  };
};

type BreakdownItem = { label: string; value: number; percent: number; color?: string };
type ProductRank = {
  rank: number;
  id: string;
  name: string;
  code: string;
  poster: string;
  owner: string;
  views: number;
  arOpens: number;
  qrScans: number;
  avgSessionTime: string;
  bounceRate: number;
  shareOfViews: number;
};

type TrafficSource = { referrer: string; views: number; percent: number };

const COLORS = ["#7AE02E", "#0EA5E9", "#8B5CF6", "#F472B6", "#6366F1", "#94A3B8", "#F59E0B", "#EF4444"];

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function MiniAreaChart({ rows }: { rows: { label: string; value: number }[] }) {
  return <AdminAreaChart rows={rows} />;
}

function MiniBarChart({ rows }: { rows: { label: string; value: number }[] }) {
  return <AdminBarChart rows={rows} />;
}

function DonutPanel({ title, items }: { title: string; items: BreakdownItem[] }) {
  return (
    <div className="dash-premium-card p-4">
      <h3 className="text-[14px] font-black text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                <span className="font-semibold capitalize text-slate-600">{item.label}</span>
              </div>
              <span className="font-bold text-slate-800">{item.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${item.percent}%`, background: COLORS[index % COLORS.length] }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-[12px] text-slate-400">No data yet.</p>}
      </div>
    </div>
  );
}

export default function ViewerAnalyticsPage() {
  const initialRange = defaultDateRange();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [realtime, setRealtime] = useState({ activeViewers: 0, viewsLastHour: 0 });
  const [dailyViews, setDailyViews] = useState<{ label: string; value: number }[]>([]);
  const [monthlyViews, setMonthlyViews] = useState<{ label: string; value: number }[]>([]);
  const [devices, setDevices] = useState<BreakdownItem[]>([]);
  const [browsers, setBrowsers] = useState<BreakdownItem[]>([]);
  const [countries, setCountries] = useState<BreakdownItem[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [productRanking, setProductRanking] = useState<ProductRank[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [customerUid, setCustomerUid] = useState("");
  const [productUid, setProductUid] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  async function load(nextPage = page) {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", "10");
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (search.trim()) params.set("search", search.trim());
    if (customerUid.trim()) params.set("customerUid", customerUid.trim());
    if (productUid.trim()) params.set("productUid", productUid.trim());

    try {
      const res = await fetch(`/api/master-admin/viewer-analytics?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics");
      setSummary(data.summary || null);
      setRealtime(data.realtime || { activeViewers: 0, viewsLastHour: 0 });
      setDailyViews(data.dailyViews || []);
      setMonthlyViews(data.monthlyViews || []);
      setDevices(
        (data.devices || []).map((d: { device: string; percent: number; views: number }) => ({
          label: d.device,
          percent: d.percent,
          value: d.views,
        })),
      );
      setBrowsers(
        (data.browsers || []).map((b: { browser: string; percent: number; views: number }) => ({
          label: b.browser,
          percent: b.percent,
          value: b.views,
        })),
      );
      setCountries(
        (data.countries || []).map((c: { country: string; percent: number; views: number }) => ({
          label: c.country || "Unknown",
          percent: c.percent,
          value: c.views,
        })),
      );
      setTrafficSources(data.trafficSources || []);
      setProductRanking(data.productRanking || []);
      if (data.pagination) setPagination(data.pagination);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useDeferredEffect(() => {
    setPage(1);
  }, [search, customerUid, productUid, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 250);
    return () => window.clearTimeout(timer);
  }, [search, customerUid, productUid, dateFrom, dateTo, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const statCards = useMemo(
    () => [
      {
        title: "Total Views",
        value: summary?.totalViewsFmt ?? "0",
        trend: summary?.trends?.views,
        icon: Eye,
        spark: summary?.sparklines?.views ?? dailyViews.map((r) => r.value),
      },
      {
        title: "AR Opens",
        value: summary?.arOpensFmt ?? "0",
        trend: summary?.trends?.arOpens,
        icon: Smartphone,
        spark: summary?.sparklines?.arOpens ?? [],
      },
      {
        title: "QR Scans",
        value: summary?.qrScansFmt ?? "0",
        trend: summary?.trends?.qrScans,
        icon: QrCode,
        spark: summary?.sparklines?.qrScans ?? [],
      },
      {
        title: "Avg Session",
        value: summary?.avgSessionTime ?? "00:00",
        trend: summary?.trends?.avgSession,
        icon: Clock,
        isText: true,
        spark: summary?.sparklines?.avgSession ?? [],
      },
      {
        title: "Bounce Rate",
        value: `${Math.round(summary?.bounceRate ?? 0)}%`,
        trend: summary?.trends?.bounceRate,
        noteDown: summary?.trends?.bounceRate?.up,
        icon: MousePointerClick,
        isText: true,
        spark: summary?.sparklines?.bounceRate ?? [],
      },
    ],
    [summary, dailyViews],
  );

  function resetFilters() {
    const range = defaultDateRange();
    setDateFrom(range.from);
    setDateTo(range.to);
    setSearch("");
    setCustomerUid("");
    setProductUid("");
  }

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("export", "csv");
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (search.trim()) params.set("search", search.trim());
    if (customerUid.trim()) params.set("customerUid", customerUid.trim());
    if (productUid.trim()) params.set("productUid", productUid.trim());
    window.open(`/api/master-admin/viewer-analytics?${params}`, "_blank");
  }

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3 pb-10">
      <AdminPageHeader
        title="Viewer Analytics"
        subtitle="Platform-wide viewer, AR, and QR performance from analytics events."
        actions={
          <>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] outline-none focus:border-[#84D400]"
              />
              <span className="text-[12px] text-[#9CA3AF]">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[12px] font-semibold text-[#374151] outline-none focus:border-[#84D400]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="dash-premium-btn-secondary h-10 px-3 text-[12px]"
            >
              <Filter size={15} />
              Filters
            </button>
            <button type="button" onClick={exportCsv} className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <Download size={15} strokeWidth={2.2} />
              Export CSV
              <ChevronDown size={14} />
            </button>
          </>
        }
      />

      {loadError ? <AdminActionMessage message={loadError} variant="error" /> : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          layout="compact"
          title="Live (5 min)"
          value={realtime.activeViewers}
          note="Active viewer sessions"
          iconComponent={Activity}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <AdminMetricCard
          layout="compact"
          title="Last hour"
          value={realtime.viewsLastHour.toLocaleString("en-IN")}
          note="Viewer opens"
          iconComponent={Eye}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <AdminMetricCard
          layout="compact"
          title="Unique visitors"
          value={(summary?.uniqueVisitors ?? 0).toLocaleString("en-IN")}
          note="In selected range"
          iconComponent={Users}
          iconClassName="bg-violet-50 text-violet-600"
        />
        <div className="dash-premium-card flex flex-col justify-center p-4">
          <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 text-[12px] font-bold text-[#374151]">
            <RotateCcw size={14} />
            Reset filters
          </button>
          <p className="mt-3 text-[11px] font-semibold text-[#9CA3AF]">
            {dateFrom} – {dateTo}
          </p>
        </div>
      </section>

      {showFilters ? (
        <section className="dash-premium-card grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Search product / owner</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Product name, owner, email..."
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Customer UID</label>
            <input
              value={customerUid}
              onChange={(e) => setCustomerUid(e.target.value)}
              placeholder="CUS-123456"
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">Product UID</label>
            <input
              value={productUid}
              onChange={(e) => setProductUid(e.target.value)}
              placeholder="Product ID"
              className="h-10 w-full rounded-[14px] border border-[#ECECEC] bg-white px-3 text-[13px] font-medium text-[#111827] outline-none transition focus:border-[#84D400] focus:shadow-[0_0_0_3px_rgba(182,255,56,0.18)]"
            />
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          const trend = card.trend;
          return (
            <AdminMetricCard
              key={card.title}
              layout="compact"
              title={card.title}
              value={card.value}
              change={trend?.label}
              changeTone={trend ? (trend.up ? "positive" : "negative") : "neutral"}
              iconComponent={Icon}
              iconClassName="bg-[#FAFAFB] text-[#374151]"
              sparkline={card.spark && card.spark.length > 0 ? card.spark : undefined}
            />
          );
        })}
      </section>

      {loading ? (
        <AdminLoadingState label="Loading viewer analytics..." />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="dash-premium-card p-4">
              <h3 className="text-[14px] font-black text-[#111827]">Daily Views</h3>
              <p className="text-[11px] font-semibold text-[#9CA3AF]">Selected date range</p>
              <MiniAreaChart rows={dailyViews.length ? dailyViews : [{ label: "—", value: 0 }]} />
            </div>
            <div className="dash-premium-card p-4">
              <h3 className="text-[14px] font-black text-[#111827]">Monthly Views</h3>
              <p className="text-[11px] font-semibold text-[#9CA3AF]">Last 12 months</p>
              <MiniBarChart rows={monthlyViews.length ? monthlyViews : [{ label: "—", value: 0 }]} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DonutPanel title="Device Breakdown" items={devices} />
            <DonutPanel title="Browser Breakdown" items={browsers} />
            <DonutPanel title="Top Countries" items={countries} />
            <div className="dash-premium-card p-4">
              <h3 className="text-[14px] font-black text-[#111827]">Traffic Sources</h3>
              <div className="mt-3 space-y-2">
                {trafficSources.map((item, index) => (
                  <div key={item.referrer} className="flex items-center justify-between text-[11px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                      <span className="truncate font-semibold capitalize text-slate-600">{item.referrer}</span>
                    </div>
                    <span className="shrink-0 font-bold text-slate-800">
                      {item.views.toLocaleString("en-IN")} ({item.percent}%)
                    </span>
                  </div>
                ))}
                {trafficSources.length === 0 && <p className="text-[12px] text-slate-400">No referrer data yet.</p>}
              </div>
            </div>
          </section>

          <section className="dash-premium-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-3">
              <h3 className="text-[15px] font-black text-[#111827]">Product Ranking</h3>
              <Link href="/master-admin/products" className="text-[12px] font-bold text-[#5AA700]">
                View All Products →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead>
                  <tr className="border-b border-[#ECECEC] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="p-3">#</th>
                    <th className="p-3">Product</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Views</th>
                    <th className="p-3">AR Opens</th>
                    <th className="p-3">QR Scans</th>
                    <th className="p-3">Avg. Session</th>
                    <th className="p-3">Bounce Rate</th>
                    <th className="p-3">Share of Views</th>
                    <th className="w-12 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {productRanking.map((row) => (
                    <tr key={row.id} className="border-b border-[#F3F4F6] transition hover:bg-[#FAFAFB]">
                      <td className="p-3 text-[12px] font-bold text-slate-500">{row.rank}</td>
                      <td className="p-3">
                        <Link href={`/master-admin/products/${row.id}`} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                            {row.poster ? (
                              <AppImage src={row.poster} alt={row.name} className="h-full w-full object-cover" />
                            ) : (
                              <Box size={16} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-slate-900">{row.name}</p>
                            <p className="text-[11px] font-semibold text-slate-400">ID: {row.code}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{row.owner}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{row.views.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{row.arOpens.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-bold text-slate-800">{row.qrScans.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-[12px] font-semibold text-slate-700">{row.avgSessionTime}</td>
                      <td className="p-3 text-[12px] font-bold text-red-500">{row.bounceRate}%</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-[#7AE02E]" style={{ width: `${row.shareOfViews}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">{row.shareOfViews}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Link href={`/master-admin/products/${row.id}`} className="text-[12px] font-bold text-slate-500 hover:text-slate-800">
                          →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {productRanking.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-[13px] font-semibold text-slate-400">
                        No product analytics for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#ECECEC] px-4 py-3">
              <AdminPagination page={page} totalPages={pagination.totalPages} meta={pagination} onPageChange={setPage} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
