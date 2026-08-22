"use client";

import Link from "next/link";
import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  Activity,
  Box,
  Camera,
  Copy,
  Eye,
  Globe2,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  Share2,
  Smartphone,
  Timer,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import UserChartCard from "@/components/user-panel/UserChartCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserPanelPageShell from "@/components/user-panel/UserPanelPageShell";
import UserRangePills from "@/components/user-panel/UserRangePills";
import UserStatCard from "@/components/user-panel/UserStatCard";
import { panelTable } from "@/components/user-panel/panel-table";
import type { DashboardData } from "@/server/analytics/analytics.types";

const BREAKDOWN_COLORS = ["#7AE02E", "#0EA5E9", "#8B5CF6", "#F472B6", "#6366F1", "#94A3B8", "#F59E0B", "#EF4444"];

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
      arButtonClicks: 0,
      screenshots: 0,
      shares: 0,
      copyLinks: 0,
      qrScans: 0,
      shareViews: 0,
      embedViews: 0,
      ctaClicks: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
    },
    daily: [],
    topProducts: [],
    topCountries: [],
    topCities: [],
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

  const fetchData = useCallback(async (rangeKey: RangeKey, uid: string, silent = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!silent) setLoading(true);
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
      if (!silent) setData(emptyData());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useDeferredEffect(() => {
    void fetchData(range, customerUid);
  }, [range, customerUid, fetchData]);

  useEffect(() => {
    const refresh = () => {
      void fetchData(range, customerUid, true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 20000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [range, customerUid, fetchData]);

  const { summary, daily, topProducts, topCountries, topCities, devices, browsers, referrers } = data;
  const period = rangeLabel(range);
  const viewPoints = useMemo(() => daily.map((d) => ({ date: d.date, value: d.views })), [daily]);
  const arBars = useMemo(
    () => daily.map((d) => ({ label: d.date.slice(5), value: d.arLaunches })),
    [daily],
  );

  return (
    <UserPanelPageShell>
      <UserPageHeader
        title="Analytics"
        subtitle={`How people use your 3D products · ${period}`}
        actions={
          <>
            {loading ? <Loader2 size={18} className="animate-spin text-[#737373]" /> : null}
            <UserRangePills
              options={RANGE_OPTIONS}
              value={range}
              onChange={(id) => setRange(id as RangeKey)}
              disabled={loading}
            />
            <button
              type="button"
              className="dash-premium-btn-secondary h-11 px-4 text-sm"
              onClick={() => void fetchData(range, customerUid, true)}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <Link href="/dashboard/analytics/live" className="dash-premium-btn-secondary h-11 px-4 text-sm">
              <Activity size={16} className="text-[#84D400]" />
              Live
            </Link>
          </>
        }
      />

      <SectionBlock
        title="Audience"
        hint="Who opened your 3D viewer. A view is counted each time the product page loads — unique visitors are different people."
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <UserStatCard
            label="Total Views"
            value={fmt(summary.totalViews)}
            icon={Eye}
            accent="sky"
            compactValue
            sub="Times the 3D viewer was opened"
          />
          <UserStatCard
            label="Unique Visitors"
            value={fmt(summary.uniqueVisitors)}
            icon={Users}
            accent="violet"
            compactValue
            sub="Different people, not repeat opens"
          />
          <UserStatCard
            label="Returning"
            value={fmt(summary.returningVisitors)}
            icon={Users}
            accent="emerald"
            compactValue
            sub="People who did more than one action"
          />
          <UserStatCard
            label="Avg. Session"
            value={fmtDuration(summary.avgSessionDuration)}
            icon={Timer}
            accent="lime"
            compactValue
            sub="Average time spent on a product"
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="What they did"
        hint="Actions after opening. AR Opens count only when AR actually starts on a phone — not when someone only taps the button."
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <UserStatCard
            label="AR Opens"
            value={fmt(summary.arLaunches)}
            icon={Smartphone}
            accent="orange"
            compactValue
            sub={
              (summary.arButtonClicks ?? 0) > 0
                ? `${fmt(summary.arButtonClicks ?? 0)} View in AR taps · phone AR actually started ${fmt(summary.arLaunches)} times`
                : "Starts only on a phone after View in AR"
            }
          />
          <UserStatCard
            label="Screenshots"
            value={fmt(summary.screenshots)}
            icon={Camera}
            accent="blue"
            compactValue
            sub="Times someone captured the 3D view"
          />
          <UserStatCard
            label="CTA Clicks"
            value={fmt(summary.ctaClicks ?? 0)}
            icon={Link2}
            accent="rose"
            compactValue
            sub="Taps on Buy, Enquire, or your button"
          />
          <UserStatCard
            label="Bounce Rate"
            value={`${summary.bounceRate}%`}
            icon={Link2}
            accent="slate"
            compactValue
            sub="Left after one action · lower is better"
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="How they found you"
        hint="Where traffic came from. QR, share links, copied links, and website embeds are counted separately from normal views."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <UserStatCard
            label="QR Scans"
            value={fmt(summary.qrScans)}
            icon={QrCode}
            accent="violet"
            compactValue
            sub="Opened via your product QR code"
          />
          <UserStatCard
            label="Share Button"
            value={fmt(summary.shares)}
            icon={Share2}
            accent="lime"
            compactValue
            sub="Share taps plus shared-link opens"
          />
          <UserStatCard
            label="Shared Link Opens"
            value={fmt(summary.shareViews ?? 0)}
            icon={Share2}
            accent="emerald"
            compactValue
            sub="Someone opened a link you shared"
          />
          <UserStatCard
            label="Embed Views"
            value={fmt(summary.embedViews ?? 0)}
            icon={Globe2}
            accent="cyan"
            compactValue
            sub="Loaded inside your website embed"
          />
          <UserStatCard
            label="Copied Links"
            value={fmt(summary.copyLinks)}
            icon={Copy}
            accent="amber"
            compactValue
            sub="Times the product link was copied"
          />
        </div>
      </SectionBlock>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <UserChartCard
          title="Daily Views"
          subtitle={`How many times the 3D viewer opened each day · ${period}`}
          points={viewPoints}
          valueSuffix="views"
          emptyLabel="No views in this period"
          emptyDescription="Share a product link or QR. When someone opens the 3D viewer, a point will appear here."
          dateRangeLabel={period}
        />
        <div className="dash-premium-card p-4">
          <h3 className="text-[14px] font-black text-[#111827]">AR Opens</h3>
          <p className="text-[11px] font-semibold text-[#9CA3AF]">
            Successful AR sessions on a phone · {period}
          </p>
          <MiniBarChart rows={arBars} />
        </div>
      </section>

      <SectionBlock
        title="Audience mix"
        hint="Where visitors came from — city, country, device, browser, and traffic source."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DonutPanel
            title="Cities"
            hint="City and country of each visitor"
            items={(topCities ?? []).slice(0, 10).map((c) => ({
              label: c.label,
              percent: c.percent,
              value: c.views,
            }))}
          />
          <DonutPanel
            title="Countries"
            hint="Country of each visitor"
            items={topCountries.slice(0, 10).map((c) => ({
              label: c.country || "Unknown",
              percent: c.percent,
              value: c.views,
            }))}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DonutPanel
            title="Devices"
            hint="Phone, tablet, or computer"
            items={devices.map((d) => ({ label: d.device, percent: d.percent, value: d.views }))}
          />
          <DonutPanel
            title="Browsers"
            hint="Chrome, Safari, and others"
            items={browsers.map((b) => ({ label: b.browser, percent: b.percent, value: b.views }))}
          />
          <DonutPanel
            title="Traffic sources"
            hint="Direct, website, QR, or other"
            items={referrers.slice(0, 8).map((r) => ({
              label: r.referrer || "Direct",
              percent: r.percent,
              value: r.views,
            }))}
          />
        </div>
      </SectionBlock>

      <section className="dash-premium-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECECEC] px-4 py-3">
          <div>
            <h3 className="text-[15px] font-black text-[#111827]">Product ranking</h3>
            <p className="mt-0.5 text-[12px] font-medium text-[#6B7280]">
              Which 3D products got the most views in {period.toLowerCase()}.
            </p>
          </div>
          <Link href="/dashboard/products" className="text-[12px] font-bold text-[#5AA700]">
            View all products →
          </Link>
        </div>
        {topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className={panelTable.table}>
              <thead>
                <tr className={panelTable.theadRow}>
                  <th className={panelTable.th}>#</th>
                  <th className={panelTable.th}>Product</th>
                  <th className={panelTable.th}>Views</th>
                  <th className={panelTable.th}>Unique people</th>
                  <th className={panelTable.th}>AR opens</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, index) => (
                  <tr key={p.productUid} className={panelTable.row}>
                    <td className={panelTable.tdMuted}>{index + 1}</td>
                    <td className={panelTable.td}>
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-[#737373]">
                          <Box size={16} />
                        </div>
                        <span className="max-w-[240px] truncate font-semibold text-[#111111]">{p.title}</span>
                      </div>
                    </td>
                    <td className={panelTable.tdStrong}>{fmt(p.views)}</td>
                    <td className={panelTable.tdMuted}>{fmt(p.uniqueVisitors)}</td>
                    <td className={panelTable.tdMuted}>{fmt(p.arLaunches)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10">
            <EmptyState label="No product views yet in this period" />
          </div>
        )}
      </section>
    </UserPanelPageShell>
  );
}

function SectionBlock({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[15px] font-black text-[#111827]">{title}</h2>
        <p className="mt-0.5 max-w-3xl text-[12px] font-medium leading-5 text-[#6B7280]">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function DonutPanel({
  title,
  hint,
  items,
}: {
  title: string;
  hint?: string;
  items: { label: string; percent: number; value?: number }[];
}) {
  return (
    <div className="dash-premium-card p-4">
      <h3 className="text-[14px] font-black text-[#111827]">{title}</h3>
      {hint ? <p className="mt-0.5 text-[11px] font-semibold text-[#9CA3AF]">{hint}</p> : null}
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length] }}
                />
                <span className="truncate font-semibold text-slate-600">{item.label || "Direct"}</span>
              </div>
              <span className="shrink-0 font-bold tabular-nums text-slate-800">
                {item.value != null ? `${fmt(item.value)} · ${item.percent}%` : `${item.percent}%`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${item.percent}%`,
                  background: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            {title === "Cities"
              ? "No city data yet. New visits from a live link will show city and country here."
              : "No data yet."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MiniBarChart({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length || !rows.some((row) => row.value > 0)) {
    return (
      <p className="mt-6 text-center text-[12px] font-medium text-[#9CA3AF]">
        No AR opens yet. This counts only when AR actually starts on a phone.
      </p>
    );
  }
  const sampled =
    rows.length <= 24
      ? rows
      : Array.from({ length: 24 }, (_, i) => rows[Math.round((i * (rows.length - 1)) / 23)]);
  const max = Math.max(...sampled.map((r) => r.value), 1);
  const labelEvery = Math.max(1, Math.ceil(sampled.length / 6));
  return (
    <div className="mt-3 flex h-36 items-end gap-1">
      {sampled.map((row, index) => (
        <div key={`${row.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-full min-h-[88px] w-full items-end">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(8, (row.value / max) * 100)}%`,
                background: "linear-gradient(180deg, #84D400 0%, #B6FF38 100%)",
              }}
              title={`${row.label}: ${row.value}`}
            />
          </div>
          {index % labelEvery === 0 || index === sampled.length - 1 ? (
            <span className="max-w-full truncate text-[9px] font-semibold text-[#9CA3AF]">{row.label}</span>
          ) : (
            <span className="h-3" />
          )}
        </div>
      ))}
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
