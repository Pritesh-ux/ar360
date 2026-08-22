"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDeferredEffect } from "@/lib/react/use-deferred-effect";
import {
  ArrowUpRight,
  Box,
  Camera,
  ChevronRight,
  Crown,
  Eye,
  HardDrive,
  Loader2,
  QrCode,
  Rocket,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import UserChartCard from "@/components/user-panel/UserChartCard";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import UserRangePills from "@/components/user-panel/UserRangePills";
import UserDateRangePicker, {
  defaultDateRange,
  formatDateRangeLabel,
  type DateRangePreset,
  type DateRangeValue,
} from "@/components/user-panel/UserDateRangePicker";
import UsageProgress from "@/components/user-panel/UsageProgress";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import SampleProductButton from "@/components/onboarding/SampleProductButton";
import DashboardHeroIllustration from "@/components/dashboard/DashboardHeroIllustration";
import UploadProductModal from "@/components/features/dashboard/UploadProductModal";
import UpgradeRequiredModal from "@/components/features/dashboard/UpgradeRequiredModal";
import TrialWelcomeModal from "@/components/features/dashboard/TrialWelcomeModal";
import PlatformUpdateBanner from "@/components/user-panel/PlatformUpdateBanner";
import { useObjectCaptureEnabled, useUserPanelSession, useUserPanelSessionActions } from "@/components/user-panel/UserPanelContext";
import MobileHomeScreen from "@/components/user-panel/mobile/MobileHomeScreen";
import "@/components/dashboard/dashboard-premium.css";
import { panelTable } from "@/components/user-panel/panel-table";
import type {
  DashboardActivityItem,
  DashboardOverviewData,
  DashboardRangeKey,
  DashboardTrend,
} from "@/lib/user-panel/dashboard.service";
import { formatDataSize } from "@/lib/billing/format-data-size";

type Props = {
  userName: string;
};

const RANGE_OPTIONS: Array<{ id: DashboardRangeKey; label: string }> = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
];

const STATUS_COLORS: Record<string, string> = {
  published: "#22C55E",
  draft: "#3B82F6",
  processing: "#9CA3AF",
  archived: "#A855F7",
  failed: "#EF4444",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

/** Live meters use B→TB; input is MB from dashboard API. */
function fmtStorage(mb: number) {
  return formatDataSize(Math.max(0, Number(mb) || 0) * 1024 * 1024);
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
    return <span className="text-[10px] font-medium text-[#9CA3AF]">No prior period data</span>;
  }
  const Icon = trend.direction === "down" ? TrendingDown : TrendingUp;
  const tone =
    trend.direction === "down" ? "text-[#EF4444]" : trend.direction === "up" ? "text-[#22C55E]" : "text-[#6B7280]";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${tone}`}>
      <Icon size={12} />
      {trend.changePercent > 0 ? "+" : ""}
      {trend.changePercent}%
    </span>
  );
}

function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`dash-premium-card dash-premium-card--lift p-4 ${className}`}>
      {children}
    </div>
  );
}

function activityMeta(type: DashboardActivityItem["type"]) {
  if (type === "product") return { Icon: Box, bg: "bg-blue-50", color: "text-[#3B82F6]" };
  if (type === "security") return { Icon: Zap, bg: "bg-green-50", color: "text-[#22C55E]" };
  return { Icon: Rocket, bg: "bg-violet-50", color: "text-[#A855F7]" };
}

function rangeToDatePreset(range: DashboardRangeKey): DateRangePreset {
  if (range === "7d") return "7d";
  if (range === "month") return "month";
  if (range === "year") return "custom";
  return "30d";
}

function datePresetToRange(preset: DateRangePreset): DashboardRangeKey {
  if (preset === "7d") return "7d";
  if (preset === "month") return "month";
  return "30d";
}

function yearDateRange(): DateRangeValue {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return { preset: "custom", from: `${y}-01-01`, to: `${y}-${m}-${d}` };
}

export default function DashboardOverviewClient({ userName }: Props) {
  const objectCaptureEnabled = useObjectCaptureEnabled();
  const session = useUserPanelSession();
  const { refreshSession } = useUserPanelSessionActions();
  const allowAnalytics = Boolean(session?.features?.allowAnalytics);
  const [range, setRange] = useState<DashboardRangeKey>("30d");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange("30d"));
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [checkingUploadAccess, setCheckingUploadAccess] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [trialWelcomeOpen, setTrialWelcomeOpen] = useState(false);
  const [previewTrialWelcome, setPreviewTrialWelcome] = useState<
    NonNullable<NonNullable<typeof session>["trialWelcome"]> | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("previewTrialWelcome") !== "1") return;

    let cancelled = false;
    // Open immediately with Master Admin trial defaults, then refine from API.
    setPreviewTrialWelcome({
      show: true,
      planName: "Free Trial",
      trialLabel: "3 days",
      trialDays: 3,
      daysRemaining: 3,
      expiresAt: null,
      productsLimit: 10,
      storageLimitMb: 100,
      bandwidthLimitMb: 1024,
      unlimitedStorage: false,
      unlimitedBandwidth: false,
    });
    setTrialWelcomeOpen(true);

    void fetch("/api/onboarding/trial-welcome", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled || !body?.trialWelcome) return;
        setPreviewTrialWelcome(body.trialWelcome);
        setTrialWelcomeOpen(true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useDeferredEffect(() => {
    if (session?.trialWelcome?.show) {
      setTrialWelcomeOpen(true);
    }
  }, [session?.trialWelcome?.show]);

  async function dismissTrialWelcome() {
    setTrialWelcomeOpen(false);
    setPreviewTrialWelcome(null);
    try {
      // Preview mode should not permanently dismiss for enterprise accounts.
      const isPreview = new URLSearchParams(window.location.search).get("previewTrialWelcome") === "1";
      if (!isPreview) {
        await fetch("/api/onboarding/trial-welcome", { method: "POST", cache: "no-store" });
        await refreshSession();
      }
    } catch {
      // local dismiss still stands; next load may show again if API failed
    }
  }

  async function openUploadModalWithEntitlement() {
    if (checkingUploadAccess) return;
    setCheckingUploadAccess(true);
    try {
      const res = await fetch("/api/billing/entitlement?action=upload_product", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      const entitlement = payload?.entitlement;
      if (res.ok && entitlement && !entitlement.allowed) {
        setUpgradeReason(
          entitlement.reason ||
            "Product limit reached on your current plan. Upgrade to continue uploading.",
        );
        setUpgradeModalOpen(true);
        return;
      }
      setUploadModalOpen(true);
    } catch {
      setUploadModalOpen(true);
    } finally {
      setCheckingUploadAccess(false);
    }
  }

  const load = useCallback(
    async (selectedRange: DashboardRangeKey, from?: string | null, to?: string | null) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ range: selectedRange });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/dashboard/overview?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as DashboardOverviewData & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load dashboard");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useDeferredEffect(() => {
    load(range, dateRange.from, dateRange.to);
  }, [load, range, dateRange.from, dateRange.to]);

  const handleRangeChange = (next: DashboardRangeKey) => {
    setRange(next);
    if (next === "year") {
      setDateRange(yearDateRange());
      return;
    }
    setDateRange(defaultDateRange(rangeToDatePreset(next)));
  };

  const handleDateRangeChange = (next: DateRangeValue) => {
    setDateRange(next);
    if (next.preset === "custom" && range === "year") return;
    setRange(datePresetToRange(next.preset));
  };

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

  const sparklines = useMemo(() => {
    const daily = data?.chart.daily ?? [];
    if (!daily.length) {
      return { products: undefined as number[] | undefined, views: undefined, arOpens: undefined, qrScans: undefined };
    }
    return {
      products: undefined as number[] | undefined,
      views: daily.map((point) => point.views),
      arOpens: daily.map((point) => point.arOpens),
      qrScans: daily.map((point) => point.qrScans),
    };
  }, [data]);

  const statusTotal = data?.productsByStatus.reduce((sum, item) => sum + item.count, 0) || 0;
  const storageSegments = data
    ? [
        { label: "Models", value: data.storage.breakdown.modelsMb, color: "#84D400" },
        { label: "Textures", value: data.storage.breakdown.texturesMb, color: "#6B7280" },
        { label: "Posters", value: data.storage.breakdown.postersMb, color: "#3B82F6" },
        { label: "Other", value: data.storage.breakdown.otherMb, color: "#D1D5DB" },
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
      <div className="dash-premium flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto md:gap-3">
        <div className="h-14 animate-pulse rounded-[16px] bg-[#F3F4F6]" />
        <div className="h-24 animate-pulse rounded-[16px] bg-[#F3F4F6]" />
        <div className="h-12 animate-pulse rounded-[16px] bg-[#F3F4F6]" />
        <div className="grid grid-cols-3 gap-2 md:gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[16px] bg-[#F3F4F6] md:h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dash-premium-card mx-auto max-w-lg p-6">
        <p className="font-bold text-[#EF4444]">{error}</p>
        <button
          type="button"
          className="dash-premium-btn-secondary mt-4"
          onClick={() => load(range, dateRange.from, dateRange.to)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dash-premium-card mx-auto max-w-lg p-6">
        <p className="font-bold text-[#171717]">Dashboard data is unavailable.</p>
        <button
          type="button"
          className="dash-premium-btn-secondary mt-4"
          onClick={() => load(range, dateRange.from, dateRange.to)}
        >
          Retry
        </button>
      </div>
    );
  }

  const displayName = data.user.name || userName || "there";
  const hasProducts = data.metrics.totalProducts.total > 0;
  const isTrialPlan = data.subscription.planId.toLowerCase().includes("trial");
  const chartDateLabel = formatDateRangeLabel(dateRange);

  const metricsSection = (
    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <UserMetricCard
        title="Total Products"
        value={fmt(data.metrics.totalProducts.total)}
        note={`${fmt(data.metrics.totalProducts.trend.current)} new in period`}
        icon={Box}
        accent="lime"
        compact
        sparkline={sparklines.products}
      />
      <UserMetricCard
        title="Total Views"
        value={fmt(data.metrics.totalViews.current)}
        icon={Eye}
        accent="sky"
        compact
        sparkline={sparklines.views}
        trend={<TrendBadge trend={data.metrics.totalViews} />}
      />
      <UserMetricCard
        title="AR Opens"
        value={fmt(data.metrics.arOpens.current)}
        icon={Smartphone}
        accent="violet"
        compact
        sparkline={sparklines.arOpens}
        trend={<TrendBadge trend={data.metrics.arOpens} />}
      />
      <UserMetricCard
        title="QR Scans"
        value={fmt(data.metrics.qrScans.current)}
        icon={QrCode}
        accent="amber"
        compact
        sparkline={sparklines.qrScans}
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
        accent="mint"
        compact
        storagePercent={data.metrics.storageUsedMb.percent}
      />
    </div>
  );

  return (
    <div className="dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-2 overflow-visible md:gap-3 md:overflow-y-auto">
      <MobileHomeScreen
        data={data}
        displayName={displayName}
        objectCaptureEnabled={objectCaptureEnabled}
      />

      <div className="hidden flex-col gap-3 md:flex">
      <PlatformUpdateBanner />
      <UserPageHeader
        title={`Welcome back, ${displayName}! 👋`}
        subtitle={`${data.subscription.planName} plan • ${data.range.label}`}
        highlighted={false}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <UserDateRangePicker
                value={dateRange}
                onChange={handleDateRangeChange}
                className="mb-0 shrink-0"
              />
              <UserRangePills
                options={RANGE_OPTIONS}
                value={range}
                onChange={(id) => handleRangeChange(id as DashboardRangeKey)}
                disabled={loading}
              />
            </div>
            <button
              type="button"
              disabled={checkingUploadAccess}
              onClick={() => void openUploadModalWithEntitlement()}
              className="dash-premium-btn-primary shrink-0"
            >
              <Upload size={16} strokeWidth={2.2} />
              {checkingUploadAccess ? "Checking…" : "Upload 3D Model"}
            </button>
          </div>
        }
      />

      {/* ── Hero Banner ── */}
      {!hasProducts ? (
        <section className="dash-premium-card overflow-hidden bg-gradient-to-br from-[#FAFAFB] via-white to-[#F0FDF4]/30 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                Get started
              </p>
              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#111827] md:text-xl">
                Create your first interactive 3D product
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-6 font-medium text-[#6B7280]">
                {objectCaptureEnabled
                  ? "Upload a GLB model, create products, generate QR codes, and publish immersive AR experiences."
                  : "Upload a GLB model, generate QR codes, and publish immersive AR experiences for your products."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={checkingUploadAccess}
                  onClick={() => void openUploadModalWithEntitlement()}
                  className="dash-premium-btn-primary"
                >
                  <Upload size={16} />
                  {checkingUploadAccess ? "Checking…" : "Upload 3D Model"}
                </button>
                {objectCaptureEnabled ? (
                  <Link href="/dashboard/object-capture" className="dash-premium-btn-secondary">
                    <Camera size={16} />
                    Start Object Capture
                  </Link>
                ) : null}
                <SampleProductButton className="dash-premium-btn-ghost" />
              </div>
            </div>
            <DashboardHeroIllustration />
          </div>
        </section>
      ) : null}

      <OnboardingChecklist variant="banner" />

      {metricsSection}

      {/* ── Analytics + Activity (analytics desktop-only) ── */}
      <section className={`grid gap-3 ${allowAnalytics ? "xl:grid-cols-[1.5fr_1fr]" : ""}`}>
        {allowAnalytics ? (
          <UserChartCard
            title="Analytics Overview"
            points={[]}
            tabs={chartTabs}
            dateRangeLabel={chartDateLabel}
          />
        ) : null}
        <PanelCard className="up-activity-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111827]">Recent Activity</h2>
            {allowAnalytics ? (
              <Link
                href="/dashboard/analytics"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                View all <ChevronRight size={15} />
              </Link>
            ) : (
              <Link
                href="/dashboard/subscription"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                Unlock analytics <ChevronRight size={15} />
              </Link>
            )}
          </div>
          <div className="space-y-1.5">
            {data.recentActivity.length ? (
              data.recentActivity.slice(0, 5).map((item: DashboardActivityItem) => {
                const { Icon, bg, color } = activityMeta(item.type);
                return (
                  <div
                    key={item.id}
                    className="dash-activity-row flex items-center gap-2.5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2"
                  >
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] ${bg}`}>
                      <Icon size={15} className={color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#111827]">{item.title}</p>
                      <p className="truncate text-[11px] font-medium text-[#9CA3AF]">
                        {item.description}
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-[10px] font-medium text-[#9CA3AF] sm:block">
                      {fmtWhen(item.occurredAt)}
                    </span>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-white text-[#9CA3AF] shadow-sm transition-colors hover:text-[#111827]"
                        aria-label="Open"
                      >
                        <ArrowUpRight size={14} />
                      </Link>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#ECECEC] px-4 py-6 text-center">
                <Sparkles size={22} className="text-[#D1D5DB]" />
                <p className="mt-3 text-sm font-semibold text-[#6B7280]">No recent activity yet</p>
              </div>
            )}
          </div>
        </PanelCard>
      </section>

      {/* ── Bottom Row ── */}
      <section className="grid gap-3 xl:grid-cols-[1.25fr_0.85fr_0.85fr]">
        {/* Top Products */}
        <PanelCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111827]">Top Performing Products</h2>
            {data.topProducts.length ? (
              <Link href="/dashboard/products" className="dash-premium-btn-ghost !h-8 !px-3 !text-xs">
                View all
              </Link>
            ) : null}
          </div>
          {data.topProducts.length ? (
            <div className="overflow-hidden rounded-[14px] border border-[#ECECEC] bg-white">
              <table className={panelTable.table}>
                <thead>
                  <tr className={panelTable.theadRow}>
                    <th className={panelTable.th}>Product</th>
                    <th className={panelTable.th}>Views</th>
                    <th className={panelTable.th}>AR Opens</th>
                    <th className={panelTable.th}>QR Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product) => (
                    <tr key={product.productUid} className={panelTable.row}>
                      <td className={panelTable.td}>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-[12px] bg-[#F9FAFB]">
                            {product.thumbnailUrl ? (
                              <Image
                                src={product.thumbnailUrl}
                                alt={product.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-[#9CA3AF]">
                                <Box size={14} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#111827]">
                              {product.title}
                            </p>
                            <p className="truncate text-[11px] text-[#9CA3AF]">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className={panelTable.tdStrong}>{fmt(product.views)}</td>
                      <td className={panelTable.tdMuted}>{fmt(product.arOpens)}</td>
                      <td className={panelTable.tdMuted}>{fmt(product.qrScans)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#ECECEC] px-4 py-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-[#F9FAFB]">
                <Box size={22} className="text-[#D1D5DB]" strokeWidth={1.6} />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#111827]">No products available yet.</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                Create your first product to start tracking performance.
              </p>
              <button
                type="button"
                disabled={checkingUploadAccess}
                onClick={() => void openUploadModalWithEntitlement()}
                className="dash-premium-btn-primary mt-4"
              >
                {checkingUploadAccess ? "Checking…" : "Create Product"}
              </button>
            </div>
          )}
        </PanelCard>

        {/* Products by Status */}
        <PanelCard>
          <h2 className="mb-3 text-base font-bold text-[#111827]">Products by Status</h2>
          <div className="mb-3 flex items-center justify-center">
            <div
              className="relative h-28 w-28 rounded-full transition-all duration-700"
              style={{
                background: statusTotal ? `conic-gradient(${donutBackground})` : "#F3F4F6",
              }}
            >
              <div className="absolute inset-[14px] grid place-items-center rounded-full bg-white text-center shadow-inner">
                <p className="text-xl font-bold text-[#111827]">{fmt(statusTotal)}</p>
                <p className="text-[10px] font-medium text-[#9CA3AF]">Products</p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.productsByStatus.map((item) => {
              const color = STATUS_COLORS[item.status.toLowerCase()] || "#9CA3AF";
              return (
                <div
                  key={item.status}
                  className="flex items-center justify-between gap-2 rounded-[12px] px-1 py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[13px] font-medium text-[#374151]">{item.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#111827]">{fmt(item.count)}</span>
                    <span className="text-[11px] font-medium text-[#9CA3AF]">{item.percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelCard>

        {/* Storage & Bandwidth */}
        <PanelCard>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#111827]">Storage & Bandwidth</h2>
            <Link
              href="/dashboard/subscription"
              className="text-[12px] font-semibold text-[#22C55E] transition-colors hover:text-[#16A34A]"
            >
              Upgrade plan
            </Link>
          </div>
          <UsageProgress
            label="Total storage"
            usedLabel={fmtStorage(data.storage.usedMb)}
            limitLabel={data.storage.limitMb ? fmtStorage(data.storage.limitMb) : "Unlimited"}
            percent={data.metrics.storageUsedMb.percent}
          />
          <div className="mt-4 border-t border-[#F3F4F6] pt-4">
            <UsageProgress
              label="Total bandwidth"
              usedLabel={fmtStorage(data.bandwidth.usedMb)}
              limitLabel={
                data.bandwidth.limitGb != null
                  ? formatDataSize(Number(data.bandwidth.limitGb) * 1024 * 1024 * 1024)
                  : "Unlimited"
              }
              percent={
                data.bandwidth.limitGb
                  ? Math.min(100, Math.round((data.bandwidth.usedMb / 1024 / data.bandwidth.limitGb) * 100))
                  : 0
              }
            />
          </div>
          <div className="mt-4 space-y-2.5">
            {storageSegments.map((segment) => (
              <div key={segment.label}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[#374151]">{segment.label}</span>
                  <span className="font-medium text-[#9CA3AF]">{fmtStorage(segment.value)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[#F3F4F6]">
                  <div
                    className="dash-progress-bar h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (segment.value / storageSum) * 100)}%`,
                      backgroundColor: segment.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      {/* ── Upgrade Banner ── */}
      {isTrialPlan ? (
        <section className="dash-premium-card flex flex-col gap-3 overflow-hidden bg-gradient-to-r from-white via-[#FAFFF5] to-[#F0FDF4]/40 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7]">
              <Crown size={18} className="text-[#22C55E]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#111827] md:text-base">Unlock more with PRO</p>
              <p className="mt-0.5 max-w-xl text-[12px] leading-5 font-medium text-[#6B7280]">
                Get additional storage, advanced analytics, custom branding, unlimited QR generation,
                and priority support.
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing/checkout" className="dash-premium-btn-primary shrink-0">
            <Crown size={16} />
            Upgrade to PRO
          </Link>
        </section>
      ) : null}
      </div>

      {loading ? (
        <div className="pointer-events-none fixed bottom-6 right-6 hidden items-center gap-2 rounded-full border border-[#ECECEC] bg-white px-4 py-2 text-[13px] font-medium text-[#6B7280] shadow-[0_8px_30px_rgba(0,0,0,0.08)] md:flex">
          <Loader2 size={14} className="animate-spin" />
          Refreshing
        </div>
      ) : null}

      {uploadModalOpen ? (
        <UploadProductModal
          onClose={() => {
            setUploadModalOpen(false);
            void load(range, dateRange.from, dateRange.to);
          }}
        />
      ) : null}

      <UpgradeRequiredModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason={upgradeReason}
      />

      {(previewTrialWelcome || session?.trialWelcome) ? (
        <TrialWelcomeModal
          isOpen={trialWelcomeOpen}
          data={(previewTrialWelcome || session?.trialWelcome)!}
          onClose={() => void dismissTrialWelcome()}
        />
      ) : null}
    </div>
  );
}
