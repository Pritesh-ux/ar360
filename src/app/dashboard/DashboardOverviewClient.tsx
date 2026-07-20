"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Box,
  ChevronRight,
  Eye,
  HardDrive,
  Loader2,
  QrCode,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import UserButton from "@/components/user-panel/UserButton";
import UserChartCard from "@/components/user-panel/UserChartCard";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserRangePills from "@/components/user-panel/UserRangePills";
import UsageProgress from "@/components/user-panel/UsageProgress";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import SampleProductButton from "@/components/onboarding/SampleProductButton";
import type {
  DashboardActivityItem,
  DashboardOverviewData,
  DashboardRangeKey,
  DashboardTrend,
} from "@/lib/user-panel/dashboard.service";

type Props = {
  userName: string;
};

const RANGE_OPTIONS: Array<{ id: DashboardRangeKey; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

function fmtStorage(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb * 10) / 10} MB`;
}

function fmtWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrendBadge({ trend }: { trend: DashboardTrend }) {
  if (trend.changePercent == null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ar-text-muted)]">
        No prior period data
      </span>
    );
  }

  const Icon = trend.direction === "down" ? TrendingDown : TrendingUp;
  const tone =
    trend.direction === "down"
      ? "text-[var(--ar-danger)]"
      : trend.direction === "up"
        ? "text-[var(--ar-success)]"
        : "text-[var(--ar-text-muted)]";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${tone}`}>
      <Icon size={14} />
      {trend.changePercent > 0 ? "+" : ""}
      {trend.changePercent}% vs previous period
    </span>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-5 shadow-[var(--ar-shadow-sm)]">
      <div className="h-3 w-24 animate-pulse rounded bg-[var(--ar-border)]" />
      <div className="mt-4 h-8 w-20 animate-pulse rounded bg-[var(--ar-border)]" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-[var(--ar-border)]" />
    </div>
  );
}

function PanelSkeleton({ height = "h-56" }: { height?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-5 shadow-[var(--ar-shadow-sm)] ${height}`}>
      <div className="h-4 w-40 animate-pulse rounded bg-[var(--ar-border)]" />
      <div className="mt-6 h-full min-h-40 animate-pulse rounded-xl bg-[var(--ar-surface-soft)]" />
    </div>
  );
}

function statusTone(status: string) {
  const lower = status.toLowerCase();
  if (lower === "published") return "bg-[var(--ar-success)]/15 text-[var(--ar-success)]";
  if (lower === "draft") return "bg-slate-100 text-slate-600";
  if (lower === "processing") return "bg-[var(--ar-info)]/15 text-[var(--ar-info)]";
  if (lower === "archived") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-600";
}

export default function DashboardOverviewClient({ userName }: Props) {
  const [range, setRange] = useState<DashboardRangeKey>("30d");
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedRange: DashboardRangeKey) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard/overview?range=${selectedRange}`, { cache: "no-store" });
      const json = (await res.json()) as DashboardOverviewData & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  const chartTabs = useMemo(() => {
    if (!data?.chart.daily.length) return undefined;
    const toPoints = (key: "views" | "arOpens" | "qrScans") =>
      data.chart.daily.map((point) => ({ date: point.date, value: point[key] }));
    return [
      { id: "views", label: "Views", values: toPoints("views") },
      { id: "arOpens", label: "AR Opens", values: toPoints("arOpens") },
      { id: "qrScans", label: "QR Scans", values: toPoints("qrScans") },
    ];
  }, [data]);

  const statusTotal = data?.productsByStatus.reduce((sum, item) => sum + item.count, 0) || 0;
  const storageSegments = data
    ? [
        { label: "Models", value: data.storage.breakdown.modelsMb, color: "var(--ar-primary-hover)" },
        { label: "Textures", value: data.storage.breakdown.texturesMb, color: "#64748B" },
        { label: "Posters", value: data.storage.breakdown.postersMb, color: "#0EA5E9" },
        { label: "Other", value: data.storage.breakdown.otherMb, color: "#CBD5E1" },
      ]
    : [];

  const storageSum = storageSegments.reduce((sum, item) => sum + item.value, 0) || 1;
  const donutBackground = storageSegments
    .reduce<{ cursor: number; stops: string[] }>(
      (acc, segment) => {
        const pct = (segment.value / storageSum) * 100;
        const next = acc.cursor + pct;
        acc.stops.push(`${segment.color} ${acc.cursor}% ${next}%`);
        acc.cursor = next;
        return acc;
      },
      { cursor: 0, stops: [] },
    )
    .stops.join(", ");

  if (loading && !data) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto pb-4">
        <div className="h-16 animate-pulse rounded-2xl bg-[var(--ar-surface-soft)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-bold text-red-700">{error}</p>
        <UserButton className="mt-4" variant="outline" onClick={() => load(range)}>
          Retry
        </UserButton>
      </div>
    );
  }

  if (!data) return null;

  const displayName = data.user.name || userName || "there";
  const hasProducts = data.metrics.totalProducts.total > 0;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pb-4">
      <UserPageHeader
        title={`Welcome back, ${displayName}`}
        subtitle={`${data.subscription.planName} plan · ${data.range.label}`}
        actions={
          <>
            <UserRangePills
              options={RANGE_OPTIONS}
              value={range}
              onChange={(id) => setRange(id as DashboardRangeKey)}
              disabled={loading}
            />
            <Link href="/dashboard/products/new">
              <UserButton
                icon={<Upload size={16} />}
                className="h-11 rounded-2xl bg-[#84D400] px-5 font-semibold text-[#102000] hover:bg-[#78C400] shadow-sm"
              >
                Upload 3D Model
              </UserButton>
            </Link>
          </>
        }
      />

      {!hasProducts ? (
        <section className="rounded-2xl border border-[#018abe]/20 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Create your first interactive 3D product</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            Upload a GLB model, create a product with Object Capture, or explore a sample product.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/dashboard/products/new">
              <UserButton className="bg-[#018abe] text-white hover:bg-[#0175a0]">Upload 3D Model</UserButton>
            </Link>
            <Link href="/dashboard/object-capture">
              <UserButton variant="outline">Start Object Capture</UserButton>
            </Link>
            <SampleProductButton />
          </div>
        </section>
      ) : null}

      <OnboardingChecklist />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <UserMetricCard
          title="Total Products"
          value={fmt(data.metrics.totalProducts.total)}
          note={`${fmt(data.metrics.totalProducts.trend.current)} new in period`}
          icon={Box}
          trend={<TrendBadge trend={data.metrics.totalProducts.trend} />}
        />
        <UserMetricCard
          title="Total Views"
          value={fmt(data.metrics.totalViews.current)}
          icon={Eye}
          trend={<TrendBadge trend={data.metrics.totalViews} />}
        />
        <UserMetricCard
          title="AR Opens"
          value={fmt(data.metrics.arOpens.current)}
          icon={Smartphone}
          trend={<TrendBadge trend={data.metrics.arOpens} />}
        />
        <UserMetricCard
          title="QR Scans"
          value={fmt(data.metrics.qrScans.current)}
          icon={QrCode}
          trend={<TrendBadge trend={data.metrics.qrScans} />}
        />
        <UserMetricCard
          title="Storage Used"
          value={fmtStorage(data.metrics.storageUsedMb.current)}
          note={
            data.metrics.storageUsedMb.limitMb
              ? `${data.metrics.storageUsedMb.percent}% of ${fmtStorage(data.metrics.storageUsedMb.limitMb)}`
              : "Current workspace usage"
          }
          icon={HardDrive}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <UserChartCard title="Analytics Overview" points={[]} tabs={chartTabs} />
        <div className="up-activity-panel rounded-[16px] border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-[var(--ar-text)] md:text-lg">Recent Activity</h2>
            <Link
              href="/dashboard/analytics"
              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--ar-text-muted)] hover:text-[var(--ar-text)]"
            >
              View analytics <ChevronRight size={16} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {data.recentActivity.length ? (
              <>
                {data.recentActivity.slice(0, 4).map((item: DashboardActivityItem) => (
                  <div
                    key={item.id}
                    className="up-activity-row flex items-start justify-between gap-3 rounded-[12px] border border-[var(--ar-border)] bg-white px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[var(--ar-text)]">{item.title}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-[var(--ar-text-muted)]">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[var(--ar-text-muted)]">
                        {fmtWhen(item.occurredAt)}
                      </p>
                    </div>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--ar-surface-soft)] text-[var(--ar-text-muted)] hover:text-[var(--ar-text)]"
                        aria-label="Open activity item"
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    ) : null}
                  </div>
                ))}
                {data.recentActivity.length > 4 ? (
                  <Link
                    href="/dashboard/analytics"
                    className="flex items-center justify-center gap-1 rounded-[12px] border border-dashed border-[var(--ar-border)] px-3 py-2.5 text-sm font-semibold text-[var(--ar-text-muted)] transition hover:border-[var(--ar-border-strong)] hover:bg-[var(--ar-surface-soft)] hover:text-[var(--ar-text)]"
                  >
                    View all activity in Analytics
                    <ChevronRight size={16} />
                  </Link>
                ) : null}
              </>
            ) : (
              <div className="rounded-[12px] border border-dashed border-[var(--ar-border)] px-4 py-10 text-center text-sm font-semibold text-[var(--ar-text-muted)]">
                No recent activity yet. Upload a product or share a viewer link to get started.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-[var(--ar-text)] md:text-lg">Top Performing Products</h2>
            <Link href="/dashboard/products">
              <UserButton variant="outline">View all</UserButton>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ar-border)] text-xs font-bold uppercase tracking-wide text-[var(--ar-text-muted)]">
                  <th className="px-2 py-3">Product</th>
                  <th className="px-2 py-3">Views</th>
                  <th className="px-2 py-3">AR</th>
                  <th className="px-2 py-3">QR</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.topProducts.length ? (
                  data.topProducts.map((product) => (
                    <tr key={product.productUid} className="border-b border-[var(--ar-border)]/70">
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-[var(--ar-surface-soft)]">
                            {product.thumbnailUrl ? (
                              <Image
                                src={product.thumbnailUrl}
                                alt={product.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[var(--ar-text-muted)]">
                                <Box size={16} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-[var(--ar-text)]">{product.title}</p>
                            <p className="truncate text-xs font-semibold text-[var(--ar-text-muted)]">
                              {product.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 font-bold text-[var(--ar-text)]">{fmt(product.views)}</td>
                      <td className="px-2 py-3 font-semibold text-[var(--ar-text-muted)]">
                        {fmt(product.arOpens)}
                      </td>
                      <td className="px-2 py-3 font-semibold text-[var(--ar-text-muted)]">
                        {fmt(product.qrScans)}
                      </td>
                      <td className="px-2 py-3">
                        <Link href={`/dashboard/products/${encodeURIComponent(product.productUid)}`}>
                          <UserButton variant="ghost" className="h-9 px-3">
                            Open
                          </UserButton>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-2 py-10 text-center text-sm font-semibold text-[var(--ar-text-muted)]">
                      No product performance data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
          <h2 className="mb-4 text-base font-black text-[var(--ar-text)] md:text-lg">Products by Status</h2>
          <div className="mb-5 flex items-center justify-center">
            <div
              className="relative h-36 w-36 rounded-full"
              style={{ background: statusTotal ? `conic-gradient(${donutBackground})` : "var(--ar-border)" }}
            >
              <div className="absolute inset-4 grid place-items-center rounded-full bg-[var(--ar-surface)] text-center">
                <p className="text-2xl font-black text-[var(--ar-text)]">{fmt(statusTotal)}</p>
                <p className="text-xs font-bold text-[var(--ar-text-muted)]">Products</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {data.productsByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-sm font-bold text-[var(--ar-text)]">{fmt(item.count)}</span>
                </div>
                <span className="text-sm font-semibold text-[var(--ar-text-muted)]">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-surface)] p-4 shadow-[var(--ar-shadow-sm)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-[var(--ar-text)] md:text-lg">Storage & Bandwidth</h2>
            <Link href="/dashboard/subscription">
              <UserButton variant="secondary">Upgrade plan</UserButton>
            </Link>
          </div>
          <UsageProgress
            label="Total storage"
            usedLabel={fmtStorage(data.storage.usedMb)}
            limitLabel={data.storage.limitMb ? fmtStorage(data.storage.limitMb) : "Unlimited"}
            percent={data.metrics.storageUsedMb.percent}
          />
          <div className="mt-4 border-t border-[var(--ar-border)]/50 pt-4">
            <UsageProgress
              label="Total bandwidth"
              usedLabel={`${(data.bandwidth.usedMb / 1024).toFixed(2)} GB`}
              limitLabel={data.bandwidth.limitGb ? `${data.bandwidth.limitGb} GB` : "Unlimited"}
              percent={data.bandwidth.limitGb ? Math.min(100, Math.round((data.bandwidth.usedMb / 1024 / data.bandwidth.limitGb) * 100)) : 0}
            />
          </div>
          <div className="mt-5 space-y-3">
            {storageSegments.map((segment) => (
              <div key={segment.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-bold text-[var(--ar-text)]">{segment.label}</span>
                  <span className="font-semibold text-[var(--ar-text-muted)]">{fmtStorage(segment.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--ar-border)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (segment.value / storageSum) * 100)}%`,
                      backgroundColor: segment.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="pointer-events-none fixed bottom-6 right-6 rounded-full border border-[var(--ar-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--ar-text-muted)] shadow-[var(--ar-shadow-md)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Refreshing
          </span>
        </div>
      ) : null}
    </div>
  );
}
