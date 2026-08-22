import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  ChevronRight,
  CreditCard,
  Eye,
  HardDrive,
  HeartPulse,
  Package,
  QrCode,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wifi,
} from "lucide-react";
import UserMetricCard from "@/components/user-panel/UserMetricCard";
import UserPageHeader from "@/components/user-panel/UserPageHeader";
import {
  AdminHealthBadge,
  AdminMiniBarChart,
  AdminPlanBreakdownChart,
} from "@/components/ui/admin";
import type { MasterAdminDashboardData } from "@/lib/master-admin/dashboard.service";
import type { MetricAccent } from "@/components/user-panel/metric-accent";
import "@/components/dashboard/dashboard-premium.css";

function fmt(n: number | string) {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function fmtStorage(mb: number | string) {
  const val = Number(mb || 0);
  if (val >= 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(1)} TB`;
  if (val >= 1024) return `${(val / 1024).toFixed(1)} GB`;
  return `${Math.round(val)} MB`;
}

function fmtRevenue(amount: number | string) {
  const val = Number(amount || 0);
  return `₹${val.toLocaleString("en-IN")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TrendNote({ pct, fallback }: { pct: number | null; fallback: string }) {
  if (pct == null) {
    return <span className="text-[10px] font-medium text-[#9CA3AF]">{fallback}</span>;
  }
  const Icon = pct < 0 ? TrendingDown : TrendingUp;
  const tone = pct < 0 ? "text-[#EF4444]" : "text-[#22C55E]";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${tone}`}>
      <Icon size={12} />
      {pct > 0 ? "+" : ""}
      {pct}% vs prior 7 days
    </span>
  );
}

function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`dash-premium-card dash-premium-card--lift p-4 ${className}`}>{children}</div>;
}

function PanelTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-[#111827]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-[#9CA3AF]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

type Props = {
  data: MasterAdminDashboardData;
};

export default function MasterAdminOverview({ data }: Props) {
  const healthOk = data.systemHealth.filter((item) => item.status === "healthy").length;
  const healthWarn = data.systemHealth.filter((item) => item.status === "warning").length;
  const healthErr = data.systemHealth.filter((item) => item.status === "error").length;

  const overviewCards: Array<{
    title: string;
    value: string;
    note?: string;
    accent: MetricAccent;
    icon: typeof CreditCard;
    sparkline?: number[];
    storagePercent?: number;
    trend?: ReactNode;
  }> = [
    {
      title: "Total Revenue",
      value: fmtRevenue(data.totalRevenue),
      note: "Lifetime captured",
      accent: "lime",
      icon: CreditCard,
      sparkline: data.sparklines.revenue,
    },
    {
      title: "Monthly Revenue",
      value: fmtRevenue(data.monthlyRevenue),
      note: `${data.totalPayments} payments this month`,
      accent: "emerald",
      icon: CreditCard,
      sparkline: data.sparklines.revenue,
      trend: <TrendNote pct={data.revenueChange7dPct} fallback="Month to date" />,
    },
    {
      title: "Active Customers",
      value: fmt(data.activeCustomers),
      note: `${data.totalCustomers} total`,
      accent: "sky",
      icon: Users,
      sparkline: data.sparklines.customers,
      trend: (
        <TrendNote pct={data.customerChange7dPct} fallback={`${data.newCustomers7d} new this week`} />
      ),
    },
    {
      title: "Active Subscriptions",
      value: fmt(data.activeSubscriptions),
      note: `${data.trialUsers} on trial`,
      accent: "violet",
      icon: ShieldCheck,
      sparkline: data.sparklines.subscriptions,
    },
    {
      title: "Total Products",
      value: fmt(data.totalProducts),
      note: `${data.publishedProducts} published`,
      accent: "amber",
      icon: Package,
      sparkline: data.sparklines.products,
    },
    {
      title: "Storage Used",
      value: fmtStorage(data.storageUsedMB),
      note: `${data.storageUsedPct}% of ${data.storageCapacityTB} TB`,
      accent: "mint",
      icon: HardDrive,
      storagePercent: data.storageUsedPct,
    },
    {
      title: "Bandwidth",
      value: fmtStorage(data.bandwidthUsedMB),
      note: "All customers",
      accent: "cyan",
      icon: Wifi,
      sparkline: data.sparklines.bandwidth,
    },
  ];

  const todayCards = [
    {
      title: "Today's Uploads",
      value: fmt(data.todayUploads),
      icon: Upload,
      accent: "blue" as const,
    },
    {
      title: "Today's AR Views",
      value: fmt(data.todayArViews),
      icon: Eye,
      accent: "violet" as const,
      sparkline: data.sparklines.viewerVisits,
    },
    {
      title: "QR Scans Today",
      value: fmt(data.todayQrScans),
      icon: QrCode,
      accent: "amber" as const,
    },
    {
      title: "Failed Payments",
      value: fmt(data.failedPaymentsToday),
      icon: AlertTriangle,
      accent: "rose" as const,
    },
  ];

  const liveRows = [
    {
      label: "Recent Logins",
      value: fmt(data.liveActivity.recentLogins),
      note: "Last 15 minutes",
      href: "/master-admin/login-logs",
      Icon: Users,
      bg: "bg-blue-50",
      color: "text-[#3B82F6]",
    },
    {
      label: "Products Updated",
      value: fmt(data.liveActivity.productsUpdatedToday),
      note: "Today",
      href: "/master-admin/products",
      Icon: Package,
      bg: "bg-violet-50",
      color: "text-[#A855F7]",
    },
    {
      label: "New Uploads",
      value: fmt(data.liveActivity.todayUploads),
      note: "Today",
      href: "/master-admin/products",
      Icon: Upload,
      bg: "bg-sky-50",
      color: "text-[#0EA5E9]",
    },
    {
      label: "Capture Jobs Running",
      value: fmt(data.liveActivity.objectCaptureJobs),
      note: "Object capture pipeline",
      href: "/master-admin/object-capture",
      Icon: Activity,
      bg: "bg-amber-50",
      color: "text-[#F59E0B]",
    },
    {
      label: "Open Support Tickets",
      value: fmt(data.liveActivity.openSupportTickets),
      note: "Needs response",
      href: "/master-admin/support-tickets",
      Icon: HeartPulse,
      bg: "bg-rose-50",
      color: "text-[#F43F5E]",
    },
  ];

  const snapshot = [
    { label: "Total Customers", value: fmt(data.totalCustomers) },
    { label: "New Customers (30d)", value: fmt(data.newCustomers) },
    { label: "Suspended Accounts", value: fmt(data.suspendedUsers) },
    { label: "Viewer Visits", value: fmt(data.viewerVisits) },
    { label: "Total AR Views", value: fmt(data.arViews) },
    { label: "Total QR Scans", value: fmt(data.qrScans) },
    { label: "Storage Utilization", value: `${data.storageUsedPct}%` },
    { label: "Active Admins", value: fmt(data.adminUsers) },
  ];

  return (
    <div className="master-admin-panel dash-premium animate-dash-fade-in flex min-h-0 flex-1 flex-col gap-3">
      <UserPageHeader
        title="Platform Overview"
        subtitle="Live metrics from MySQL — customers, billing, analytics, and storage."
        highlighted
        actions={
          <>
            <span className="dash-premium-btn-secondary h-10 px-3 text-[12px]">{todayLabel()}</span>
            <Link href="/master-admin/system-health" className="dash-premium-btn-primary h-10 px-4 text-[12px]">
              <HeartPulse size={15} strokeWidth={2.2} />
              System Health
            </Link>
          </>
        }
      />

      <section className="dash-premium-card overflow-hidden bg-gradient-to-br from-[#FAFAFB] via-white to-[#F0FDF4]/40 p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
              Command center
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-[#111827] md:text-xl">
              {healthErr > 0
                ? `${healthErr} system issue${healthErr > 1 ? "s" : ""} need attention`
                : healthWarn > 0
                  ? `${healthWarn} warning${healthWarn > 1 ? "s" : ""} on the platform`
                  : "All monitored systems look healthy"}
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] font-medium leading-6 text-[#6B7280]">
              {healthOk} healthy · {healthWarn} warnings · {healthErr} errors · {fmt(data.activeCustomers)}{" "}
              active customers online across the platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/master-admin/customers" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <Users size={14} />
              Customers
            </Link>
            <Link href="/master-admin/billing" className="dash-premium-btn-secondary h-10 px-3 text-[12px]">
              <CreditCard size={14} />
              Billing
            </Link>
            <Link href="/master-admin/support-tickets" className="dash-premium-btn-ghost h-10 px-3 text-[12px]">
              Tickets
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {overviewCards.map((card) => (
          <UserMetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            note={card.trend ? undefined : card.note}
            trend={card.trend}
            icon={card.icon}
            accent={card.accent}
            compact
            sparkline={card.sparkline}
            storagePercent={card.storagePercent}
          />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {todayCards.map((card) => (
          <UserMetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            compact
            sparkline={card.sparkline}
          />
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <PanelCard>
          <PanelTitle
            title="Revenue Growth"
            subtitle="Last 30 days · captured payments"
            action={
              <Link
                href="/master-admin/billing"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                View billing <ChevronRight size={15} />
              </Link>
            }
          />
          <AdminMiniBarChart rows={data.revenueDaily} />
        </PanelCard>

        <PanelCard className="up-activity-panel">
          <PanelTitle title="Live Platform Activity" subtitle="Auth, products, capture & support" />
          <div className="space-y-1.5">
            {liveRows.map((row) => (
              <Link
                key={row.label}
                href={row.href}
                className="dash-activity-row flex items-center gap-2.5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2"
              >
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] ${row.bg}`}>
                  <row.Icon size={15} className={row.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#111827]">{row.label}</p>
                  <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{row.note}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#111827]">{row.value}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-white text-[#9CA3AF] shadow-sm">
                  <ArrowUpRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <PanelCard>
          <PanelTitle title="Customer Growth" subtitle="New signups · 30 days" />
          <AdminMiniBarChart rows={data.customerDaily} />
        </PanelCard>

        <PanelCard>
          <PanelTitle title="Top Countries" subtitle="By customer count" />
          <div className="space-y-3">
            {data.topCountries.length === 0 ? (
              <p className="text-sm font-medium text-[#9CA3AF]">No country data yet.</p>
            ) : (
              data.topCountries.map((row, index) => (
                <div key={row.country}>
                  <div className="mb-1 flex items-center justify-between text-[13px] font-semibold">
                    <span className="text-[#111827]">{row.country}</span>
                    <span className="text-[#6B7280]">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="dash-progress-bar h-full rounded-full bg-[#B6FF38]"
                      style={{ width: `${row.pct}%`, opacity: 1 - index * 0.12 }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard>
          <PanelTitle
            title="Most Viewed Products"
            action={
              <Link
                href="/master-admin/products"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                All <ArrowUpRight size={14} />
              </Link>
            }
          />
          <div className="space-y-1.5">
            {data.topProducts.length === 0 ? (
              <p className="text-sm font-medium text-[#9CA3AF]">No product views yet.</p>
            ) : (
              data.topProducts.map((product) => (
                <div
                  key={product.id}
                  className="dash-activity-row flex items-center gap-2.5 rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white text-[#9CA3AF] shadow-sm">
                    <Box size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#111827]">{product.product}</p>
                    <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{product.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#111827]">{fmt(product.views)}</p>
                    <p className="text-[10px] font-semibold text-[#9CA3AF]">{fmt(product.ar)} AR</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <PanelCard>
          <PanelTitle title="Plan Distribution" subtitle="Active subscription mix" />
          <AdminPlanBreakdownChart rows={data.planBreakdown} />
        </PanelCard>

        <PanelCard>
          <PanelTitle
            title="System Health"
            action={
              <Link
                href="/master-admin/system-health"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#6B7280] transition-colors hover:text-[#111827]"
              >
                Open <Activity size={14} />
              </Link>
            }
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {data.systemHealth.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111827]">{item.label}</p>
                  <p className="truncate text-[11px] font-medium text-[#9CA3AF]">{item.note}</p>
                </div>
                <AdminHealthBadge status={item.status} />
              </div>
            ))}
          </div>
        </PanelCard>
      </section>

      <PanelCard>
        <PanelTitle title="Platform Snapshot" subtitle="Key totals across the workspace" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.map((row) => (
            <div
              key={row.label}
              className="rounded-[14px] border border-[#ECECEC] bg-[#FAFAFB] px-3 py-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                {row.label}
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight text-[#111827]">{row.value}</p>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
