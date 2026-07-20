"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownToLine,
  Box,
  Calendar,
  Camera,
  Copy,
  Eye,
  Globe2,
  Link2,
  Loader2,
  QrCode,
  Share2,
  Smartphone,
  Timer,
  Users,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserRangePills from "@/components/user-panel/UserRangePills";
import type { DashboardData } from "@/server/analytics/analytics.types";

type RangeKey = "7d" | "30d" | "month" | "year";

const RANGE_OPTIONS: { id: RangeKey; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

function rangeLabel(key: RangeKey) {
  return {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    month: "This month",
    year: "This year",
  }[key];
}

function rangeDates(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const to = fmt(now);

  if (key === "7d") return { from: fmt(new Date(now.getTime() - 6 * 86400000)), to };
  if (key === "30d") return { from: fmt(new Date(now.getTime() - 29 * 86400000)), to };
  if (key === "month") return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to };
  return { from: `${now.getFullYear()}-01-01`, to };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtDuration(seconds: number) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function emptyData(): DashboardData {
  return {
    summary: {
      totalViews: 0,
      uniqueVisitors: 0,
      returningVisitors: 0,
      arLaunches: 0,
      screenshots: 0,
      shares: 0,
      copyLinks: 0,
      qrScans: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
    },
    daily: [],
    topProducts: [],
    topCountries: [],
    devices: [],
    browsers: [],
    operatingSystems: [],
    referrers: [],
  };
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<DashboardData>(emptyData());
  const [loading, setLoading] = useState(true);
  const [customerUid, setCustomerUid] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/customer/bootstrap")
      .then((r) => r.json())
      .then((body: { customer?: { customerUid?: string } }) => {
        setCustomerUid(body.customer?.customerUid ?? "");
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (rangeKey: RangeKey, uid: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    try {
      const { from, to } = rangeDates(rangeKey);
      const params = new URLSearchParams({ from, to });
      if (uid) params.set("customerUid", uid);

      const res = await fetch(`/api/analytics/dashboard?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error("fetch failed");
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setData(emptyData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(range, customerUid);
  }, [range, customerUid, fetchData]);

  function handleExport(format: "csv" | "json" | "excel") {
    const { from, to } = rangeDates(range);
    const params = new URLSearchParams({ format, from, to });
    if (customerUid) params.set("customerUid", customerUid);
    window.open(`/api/analytics/export?${params}`, "_blank");
  }

  const { summary, daily, topProducts, topCountries, devices, browsers, referrers } = data;
  const dailyViews = useMemo(() => daily.map((d) => d.views), [daily]);
  const dailyLabels = useMemo(() => daily.map((d) => d.date.slice(5)), [daily]);
  const period = rangeLabel(range);

  return (
    <>
      <UserPageHeader
        title="Analytics"
        subtitle={`Performance overview · ${period}`}
        actions={
          <>
            {loading ? <Loader2 size={18} className="animate-spin text-[#737373]" /> : null}
            <UserRangePills
              options={RANGE_OPTIONS}
              value={range}
              onChange={(id) => setRange(id as RangeKey)}
              disabled={loading}
            />
            <Link
              href="/dashboard/analytics/live"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
            >
              <Activity size={16} className="text-[#84D400]" />
              Live
            </Link>
            <div className="group relative">
              <UserButton
                icon={<ArrowDownToLine size={16} />}
                className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] shadow-sm"
              >
                Export
              </UserButton>
              <div className="absolute right-0 top-full z-50 mt-1 hidden w-36 overflow-hidden rounded-2xl border border-[#ECECEC] bg-white shadow-lg group-hover:block">
                {(["csv", "excel", "json"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleExport(f)}
                    className="block w-full px-4 py-3 text-left text-sm font-semibold capitalize text-[#111111] hover:bg-[#FAFAFA]"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Views" value={fmt(summary.totalViews)} icon={Eye} iconClass="bg-sky-50 text-sky-600" />
        <StatCard label="Unique Visitors" value={fmt(summary.uniqueVisitors)} icon={Users} iconClass="bg-violet-50 text-violet-600" />
        <StatCard label="Avg. Session" value={fmtDuration(summary.avgSessionDuration)} icon={Timer} iconClass="bg-[#EEF9E0] text-[#84D400]" />
        <StatCard label="AR Launches" value={fmt(summary.arLaunches)} icon={Smartphone} iconClass="bg-orange-50 text-orange-600" />
        <StatCard label="Screenshots" value={fmt(summary.screenshots)} icon={Camera} iconClass="bg-blue-50 text-blue-600" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shares" value={fmt(summary.shares)} icon={Share2} iconClass="bg-[#EEF9E0] text-[#84D400]" />
        <StatCard label="Share Views" value={fmt(summary.shareViews ?? 0)} icon={Share2} iconClass="bg-emerald-50 text-emerald-600" />
        <StatCard label="Embed Views" value={fmt(summary.embedViews ?? 0)} icon={Globe2} iconClass="bg-cyan-50 text-cyan-600" />
        <StatCard label="CTA Clicks" value={fmt(summary.ctaClicks ?? 0)} icon={Link2} iconClass="bg-rose-50 text-rose-600" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Copy Links" value={fmt(summary.copyLinks)} icon={Copy} iconClass="bg-amber-50 text-amber-600" />
        <StatCard label="QR Scans" value={fmt(summary.qrScans)} icon={QrCode} iconClass="bg-violet-50 text-violet-600" />
        <StatCard label="Bounce Rate" value={`${summary.bounceRate}%`} icon={Link2} iconClass="bg-slate-100 text-slate-600" sub="Lower is better" />
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111111]">Views Over Time</h2>
            <p className="mt-0.5 text-xs font-medium text-[#737373]">Daily views for {period.toLowerCase()}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[12px] border border-[#ECECEC] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#525252]">
            <Calendar size={15} className="text-[#737373]" />
            {period}
          </div>
        </div>
        <div className="p-5">
          {dailyViews.length > 0 ? (
            <LineChart values={dailyViews} labels={dailyLabels} />
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Panel title="Top Products" subtitle="Most viewed 3D products">
          {topProducts.length > 0 ? (
            <div className="overflow-hidden rounded-[14px] border border-[#ECECEC]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAFAFA] text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Unique</th>
                    <th className="px-4 py-3">AR</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.productUid} className="border-t border-[#ECECEC]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-[#737373]">
                            <Box size={16} />
                          </div>
                          <span className="max-w-[180px] truncate font-semibold text-[#111111]">{p.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#111111]">{fmt(p.views)}</td>
                      <td className="px-4 py-3 text-[#737373]">{fmt(p.uniqueVisitors)}</td>
                      <td className="px-4 py-3 text-[#737373]">{fmt(p.arLaunches)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No product data yet" />
          )}
        </Panel>

        <Panel title="Top Countries" subtitle="Geographic distribution">
          {topCountries.length > 0 ? (
            <div className="space-y-3.5">
              {topCountries.slice(0, 8).map((c) => (
                <div key={c.country}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold text-[#111111]">{c.country || "Unknown"}</span>
                    <span className="text-[#737373]">
                      {c.percent}% · {fmt(c.views)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
                    <div className="h-full rounded-full bg-[#84D400]" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No country data yet" />
          )}
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <Panel title="Devices" subtitle="By device type">
          <BreakdownList items={devices.map((d) => ({ name: d.device, percent: d.percent }))} />
        </Panel>
        <Panel title="Browsers" subtitle="By browser">
          <BreakdownList items={browsers.map((b) => ({ name: b.browser, percent: b.percent }))} />
        </Panel>
        <Panel title="Traffic Sources" subtitle="Top referrers">
          <BreakdownList items={referrers.slice(0, 6).map((r) => ({ name: r.referrer, percent: r.percent }))} />
        </Panel>
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass: string;
  sub?: string;
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
          {sub ? <p className="mt-1.5 text-xs font-medium text-[#737373]">{sub}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-[#ECECEC] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[#111111]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs font-medium text-[#737373]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function LineChart({ values, labels }: { values: number[]; labels: string[] }) {
  if (values.length < 2) return <EmptyChart />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const spread = max - min || 1;
  const w = 100;
  const h = 60;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / spread) * (h * 0.8) - h * 0.1}`)
    .join(" ");

  return (
    <div className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA] p-4">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[200px] w-full overflow-visible">
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" x2={w} y1={(y / 100) * h} y2={(y / 100) * h} stroke="#ECECEC" strokeWidth=".4" />
        ))}
        <polyline points={pts} fill="none" stroke="#84D400" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill="rgba(132,212,0,.12)" stroke="none" />
      </svg>
      {labels.length > 1 ? (
        <div className="mt-2 flex justify-between text-[10px] font-medium text-[#A3A3A3]">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor(labels.length / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      ) : null}
    </div>
  );
}

function BreakdownList({ items }: { items: { name: string; percent: number }[] }) {
  if (!items.length) return <EmptyState label="No data yet" />;
  return (
    <div className="space-y-3.5">
      {items.map((item) => (
        <div key={item.name}>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold capitalize text-[#111111]">{item.name || "Direct"}</span>
            <span className="text-[#737373]">{item.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div className="h-full rounded-full bg-[#84D400]" style={{ width: `${item.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA]">
      <div className="text-center">
        <Globe2 size={32} className="mx-auto text-[#D4D4D4]" />
        <p className="mt-2 text-xs font-medium text-[#737373]">No data for this period</p>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-[14px] border border-[#ECECEC] bg-[#FAFAFA]">
      <p className="text-xs font-medium text-[#737373]">{label}</p>
    </div>
  );
}
