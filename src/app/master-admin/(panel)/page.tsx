import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  CreditCard,
  Eye,
  HardDrive,
  Package,
  QrCode,
  Upload,
  Users,
  Wifi,
} from "lucide-react";
import AdminPageHeader from "@/components/features/master-admin/AdminPageHeader";
import {
  AdminButton,
  AdminCard,
  AdminMetricCard,
  AdminHealthBadge,
  AdminMiniBarChart,
  AdminPlanBreakdownChart,
  AdminSnapshotRow,
  adminPrimaryButtonClass,
} from "@/components/ui/admin";
import { requireAdminPermission } from "@/lib/permissions/admin-rbac";
import { getMasterAdminDashboardData } from "@/lib/master-admin/dashboard.service";

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

function trendNote(pct: number | null, fallback: string) {
  if (pct == null) return fallback;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% vs prior 7 days`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MasterAdminDashboard() {
  await requireAdminPermission("analytics.read");
  const data = await getMasterAdminDashboardData();

  const overviewCards = [
    {
      title: "Total Revenue",
      value: fmtRevenue(data.totalRevenue),
      note: "Lifetime captured",
      sparkline: data.sparklines.revenue,
      icon: CreditCard,
    },
    {
      title: "Monthly Revenue (MRR)",
      value: fmtRevenue(data.monthlyRevenue),
      note: `${data.totalPayments} payments this month`,
      sparkline: data.sparklines.revenue,
      icon: CreditCard,
      changeTone: data.revenueChange7dPct != null && data.revenueChange7dPct < 0 ? "negative" as const : "positive" as const,
      change: trendNote(data.revenueChange7dPct, "Month to date"),
    },
    {
      title: "Active Customers",
      value: fmt(data.activeCustomers),
      note: `${data.totalCustomers} total`,
      sparkline: data.sparklines.customers,
      icon: Users,
      change: trendNote(data.customerChange7dPct, `${data.newCustomers7d} new this week`),
    },
    {
      title: "Active Subscriptions",
      value: fmt(data.activeSubscriptions),
      note: `${data.trialUsers} on trial`,
      sparkline: data.sparklines.subscriptions,
      icon: Users,
    },
    {
      title: "Total Products",
      value: fmt(data.totalProducts),
      note: `${data.publishedProducts} published`,
      sparkline: data.sparklines.products,
      icon: Package,
    },
    {
      title: "Total Storage Used",
      value: fmtStorage(data.storageUsedMB),
      note: `${data.storageUsedPct}% of ${data.storageCapacityTB} TB`,
      sparkline: data.sparklines.storage,
      icon: HardDrive,
    },
    {
      title: "Total Bandwidth",
      value: fmtStorage(data.bandwidthUsedMB),
      note: "All customers",
      sparkline: data.sparklines.bandwidth,
      icon: Wifi,
    },
  ];

  const todayCards = [
    { title: "Today's Uploads", value: fmt(data.todayUploads), icon: Upload },
    { title: "Today's AR Views", value: fmt(data.todayArViews), icon: Eye, sparkline: data.sparklines.viewerVisits },
    { title: "QR Scans Today", value: fmt(data.todayQrScans), icon: QrCode },
    {
      title: "Failed Payments",
      value: fmt(data.failedPaymentsToday),
      icon: AlertTriangle,
      negative: true,
    },
  ];

  const liveRows = [
    {
      label: "Recent Logins",
      value: fmt(data.liveActivity.recentLogins),
      note: "Last 15 minutes",
      href: "/master-admin/login-logs",
    },
    {
      label: "Products Updated",
      value: fmt(data.liveActivity.productsUpdatedToday),
      note: "Today",
      href: "/master-admin/products",
    },
    {
      label: "New Uploads",
      value: fmt(data.liveActivity.todayUploads),
      note: "Today",
      href: "/master-admin/products",
    },
    {
      label: "Capture Jobs Running",
      value: fmt(data.liveActivity.objectCaptureJobs),
      note: "Object capture pipeline",
      href: "/master-admin/object-capture",
    },
    {
      label: "Open Support Tickets",
      value: fmt(data.liveActivity.openSupportTickets),
      note: "Needs response",
      href: "/master-admin/support-tickets",
    },
  ];

  return (
    <div className="master-admin-panel space-y-6">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Live platform metrics from MySQL — customers, billing, analytics, and storage."
        actions={
          <>
            <AdminButton>{todayLabel()}</AdminButton>
            <Link href="/master-admin/system-health" className={adminPrimaryButtonClass}>
              System Health
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {overviewCards.map((item) => (
          <AdminMetricCard
            key={item.title}
            layout="compact"
            title={item.title}
            value={item.value}
            note={item.change ? undefined : item.note}
            change={item.change}
            changeTone={item.changeTone}
            iconComponent={item.icon}
            iconClassName="bg-[#A6FF2E]/15 text-[#4D9A00]"
            className="shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
            sparkline={item.sparkline}
          />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {todayCards.map((item) => (
          <AdminMetricCard
            key={item.title}
            layout="compact"
            title={item.title}
            value={item.value}
            iconComponent={item.icon}
            iconClassName={item.negative ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-600"}
            className="px-4 py-3 shadow-sm"
            sparkline={item.sparkline}
            changeTone={item.negative ? "negative" : "positive"}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AdminCard padding="lg" className="shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Revenue Growth</h2>
              <p className="text-xs font-medium text-slate-400">Last 30 days · captured payments</p>
            </div>
            <Link href="/master-admin/billing" className="text-xs font-bold text-[#4D9A00] hover:underline">
              View billing
            </Link>
          </div>
          <AdminMiniBarChart rows={data.revenueDaily} />
        </AdminCard>

        <AdminCard padding="lg" className="shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Live Platform Activity</h2>
          <p className="text-xs font-medium text-slate-400">Real counts from auth, products, capture & support</p>
          <div className="mt-4 space-y-3">
            {liveRows.map((row) => (
              <Link
                key={row.label}
                href={row.href}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100/80"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{row.label}</p>
                  <p className="text-[11px] font-medium text-slate-400">{row.note}</p>
                </div>
                <span className="text-sm font-black text-slate-900">{row.value}</span>
              </Link>
            ))}
          </div>
        </AdminCard>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AdminCard padding="lg" className="shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Customer Growth</h2>
          <p className="text-xs font-medium text-slate-400">New signups · 30 days</p>
          <AdminMiniBarChart rows={data.customerDaily} />
        </AdminCard>

        <AdminCard padding="lg" className="shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Top Countries</h2>
          <p className="text-xs font-medium text-slate-400">By customer count</p>
          <div className="mt-4 space-y-3">
            {data.topCountries.length === 0 ? (
              <p className="text-sm font-medium text-slate-400">No country data yet.</p>
            ) : (
              data.topCountries.map((row, index) => (
                <div key={row.country}>
                  <div className="mb-1 flex items-center justify-between text-sm font-bold">
                    <span className="text-slate-700">{row.country}</span>
                    <span className="text-slate-500">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#A6FF2E]"
                      style={{ width: `${row.pct}%`, opacity: 1 - index * 0.12 }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminCard>

        <AdminCard padding="lg" className="shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Most Viewed Products</h2>
            <Link href="/master-admin/products" className="inline-flex items-center gap-1 text-xs font-bold text-[#4D9A00]">
              All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-sm font-medium text-slate-400">No product views yet.</p>
            ) : (
              data.topProducts.map((product) => (
                <div key={product.product} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400">
                    <Box size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{product.product}</p>
                    <p className="truncate text-[11px] font-medium text-slate-400">{product.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{fmt(product.views)}</p>
                    <p className="text-[10px] font-semibold text-slate-400">{fmt(product.ar)} AR</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminCard>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminCard padding="lg" className="shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Plan Distribution</h2>
          <AdminPlanBreakdownChart rows={data.planBreakdown} />
        </AdminCard>

        <AdminCard padding="lg" className="shadow-sm">
          <h2 className="text-lg font-black text-slate-900">System Health</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.systemHealth.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                  <p className="text-[11px] font-medium text-slate-400">{item.note}</p>
                </div>
                <AdminHealthBadge status={item.status} />
              </div>
            ))}
          </div>
          <Link
            href="/master-admin/system-health"
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#4D9A00] hover:underline"
          >
            Open System Health <Activity size={14} />
          </Link>
        </AdminCard>
      </section>

      <AdminCard padding="lg" className="shadow-sm">
        <h2 className="text-lg font-black text-slate-900">Platform Snapshot</h2>
        <div className="mt-2 divide-y divide-slate-100">
          <AdminSnapshotRow label="Total Customers" value={fmt(data.totalCustomers)} />
          <AdminSnapshotRow label="New Customers (30d)" value={fmt(data.newCustomers)} />
          <AdminSnapshotRow label="Suspended Accounts" value={fmt(data.suspendedUsers)} />
          <AdminSnapshotRow label="Viewer Visits" value={fmt(data.viewerVisits)} />
          <AdminSnapshotRow label="Total AR Views" value={fmt(data.arViews)} />
          <AdminSnapshotRow label="Total QR Scans" value={fmt(data.qrScans)} />
          <AdminSnapshotRow label="Storage Utilization" value={`${data.storageUsedPct}%`} />
          <AdminSnapshotRow label="Active Admins" value={fmt(data.adminUsers)} />
        </div>
      </AdminCard>
    </div>
  );
}
