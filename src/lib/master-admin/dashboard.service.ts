import { access } from "fs/promises";
import { getMonthlyCapturedRevenuePaise } from "@/lib/billing/payment-ledger";
import { ensureAppSchema, query } from "@/lib/db";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { getEmailDeliveryStatus } from "@/lib/email/delivery-config";
import { PLATFORM_STORAGE_TB } from "@/components/features/master-admin/storage-utils";
import { queryStorageGrowthSeries } from "@/lib/storage/snapshots";
import { resolveStorageRoot } from "@/lib/storage/paths";

export type HealthStatus = "healthy" | "warning" | "error";

export type DashboardSystemHealthItem = {
  label: string;
  status: HealthStatus;
  note: string;
};

export type DashboardLiveActivity = {
  recentLogins: number;
  productsUpdatedToday: number;
  todayUploads: number;
  objectCaptureJobs: number;
  openSupportTickets: number;
};

export type DashboardSparklines = {
  revenue: number[];
  customers: number[];
  subscriptions: number[];
  products: number[];
  storage: number[];
  bandwidth: number[];
  viewerVisits: number[];
};

export type MasterAdminDashboardData = {
  totalCustomers: number;
  activeCustomers: number;
  trialUsers: number;
  suspendedUsers: number;
  newCustomers: number;
  newCustomers7d: number;
  adminUsers: number;
  activeSubscriptions: number;
  totalProducts: number;
  publishedProducts: number;
  storageUsedMB: number;
  storageCapacityTB: number;
  storageUsedPct: number;
  bandwidthUsedMB: number;
  viewerVisits: number;
  arViews: number;
  qrScans: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalPayments: number;
  revenueChange7dPct: number | null;
  customerChange7dPct: number | null;
  todayUploads: number;
  todayArViews: number;
  todayQrScans: number;
  failedPaymentsToday: number;
  revenueDaily: { label: string; value: number }[];
  customerDaily: { label: string; value: number }[];
  planBreakdown: { plan: string; value: number }[];
  topProducts: { product: string; customer: string; views: number; ar: number }[];
  topCountries: { country: string; count: number; pct: number }[];
  systemHealth: DashboardSystemHealthItem[];
  liveActivity: DashboardLiveActivity;
  sparklines: DashboardSparklines;
  generatedAt: string;
};

const DAY_SERIES = 30;
const SPARKLINE_DAYS = 7;

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function daySeriesSql(days: number) {
  const unions = Array.from({ length: days }, (_, i) => `SELECT ${i} AS seq`).join(" UNION ALL ");
  return `
    SELECT CURDATE() - INTERVAL seq DAY AS date
    FROM (${unions}) n
  `;
}

async function loadDailyRevenue(days: number) {
  return query<{ label: string; value: number }>(
    `SELECT DATE_FORMAT(d.date, '%d %b') AS label,
            COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) / 100 AS value
     FROM (${daySeriesSql(days)}) d
     LEFT JOIN billing_payments bp ON DATE(bp.created_at) = d.date AND bp.status = 'captured'
     LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
     GROUP BY d.date
     ORDER BY d.date`,
  ).catch(() => []);
}

async function loadDailyCustomers(days: number) {
  return query<{ label: string; value: number }>(
    `SELECT DATE_FORMAT(d.date, '%d %b') AS label,
            COUNT(c.customer_uid) AS value
     FROM (${daySeriesSql(days)}) d
     LEFT JOIN customers c ON DATE(c.created_at) = d.date
     GROUP BY d.date
     ORDER BY d.date`,
  ).catch(() => []);
}

async function loadDailyProducts(days: number) {
  return query<{ value: number }>(
    `SELECT COUNT(p.id) AS value
     FROM (${daySeriesSql(days)}) d
     LEFT JOIN products p ON DATE(p.created_at) = d.date
     GROUP BY d.date
     ORDER BY d.date`,
  ).catch(() => []);
}

async function loadDailySubscriptions(days: number) {
  return query<{ value: number }>(
    `SELECT COUNT(s.customer_uid) AS value
     FROM (${daySeriesSql(days)}) d
     LEFT JOIN customer_subscriptions s ON DATE(s.created_at) = d.date
     GROUP BY d.date
     ORDER BY d.date`,
  ).catch(() => [] as { value: number }[]);
}

async function loadDailyAnalytics(days: number) {
  return query<{ views: number; ar: number; qr: number }>(
    `SELECT COALESCE(SUM(a.views), 0) AS views,
            COALESCE(SUM(a.ar_launches), 0) AS ar,
            COALESCE(SUM(a.qr_scans), 0) AS qr
     FROM (${daySeriesSql(days)}) d
     LEFT JOIN analytics_daily a ON a.date = d.date
     GROUP BY d.date
     ORDER BY d.date`,
  ).catch(() => []);
}

function tailValues<T>(rows: T[], pick: (row: T) => number, count = SPARKLINE_DAYS) {
  return rows.slice(-count).map(pick);
}

async function loadTopCountries() {
  const rows = await query<{ country: string; count: number }>(
    `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country, COUNT(*) AS count
     FROM customers
     GROUP BY COALESCE(NULLIF(TRIM(country), ''), 'Unknown')
     ORDER BY count DESC
     LIMIT 5`,
  ).catch(() => [] as { country: string; count: number }[]);

  const total = rows.reduce((sum: number, row) => sum + Number(row.count || 0), 0) || 1;
  return rows.map((row) => ({
    country: row.country,
    count: Number(row.count || 0),
    pct: Math.round((Number(row.count || 0) / total) * 1000) / 10,
  }));
}

async function loadPlanBreakdown() {
  const rows = await query<{ plan: string; value: number }>(
    `SELECT COALESCE(s.plan_id, c.plan_id, 'trial') AS plan, COUNT(DISTINCT c.customer_uid) AS value
     FROM customers c
     LEFT JOIN customer_subscriptions s ON s.customer_uid = c.customer_uid
     GROUP BY COALESCE(s.plan_id, c.plan_id, 'trial')
     ORDER BY value DESC`,
  ).catch(() => []);
  return rows.map((row) => ({ plan: String(row.plan), value: Number(row.value || 0) }));
}

async function buildSystemHealth(input: {
  storageUsedPct: number;
  failedPayments7d: number;
  openHighTickets: number;
  maintenanceMode: boolean;
  emailProvider: "smtp" | "resend" | "disabled" | "unconfigured";
  razorpayConfigured: boolean;
  storageWritable: boolean;
  objectCaptureAvailable: boolean;
  activeOcJobs: number;
  activeOcWorkers: number;
  queuedOcJobs: number;
  staleOcLeases: number;
}): Promise<DashboardSystemHealthItem[]> {
  const items: DashboardSystemHealthItem[] = [
    {
      label: "Database",
      status: "healthy",
      note: "MySQL connection active",
    },
    {
      label: "Storage",
      status: input.storageWritable
        ? input.storageUsedPct >= 90
          ? "error"
          : input.storageUsedPct >= 75
            ? "warning"
            : "healthy"
        : "error",
      note: input.storageWritable
        ? `${input.storageUsedPct}% of ${PLATFORM_STORAGE_TB} TB used`
        : "Storage path not writable",
    },
    {
      label: "Payment Gateway",
      status: input.razorpayConfigured ? "healthy" : "warning",
      note: input.razorpayConfigured ? "Razorpay credentials configured" : "Razorpay keys missing",
    },
    {
      label: "Email Delivery",
      status:
        input.emailProvider === "smtp" || input.emailProvider === "resend"
          ? "healthy"
          : "warning",
      note:
        input.emailProvider === "smtp"
          ? "SMTP live provider active"
          : input.emailProvider === "resend"
            ? "Resend live provider active"
            : input.emailProvider === "disabled"
              ? "Transactional emails disabled"
              : "No live email provider configured",
    },
    {
      label: "Support Queue",
      status: input.openHighTickets > 5 ? "warning" : input.openHighTickets > 0 ? "healthy" : "healthy",
      note:
        input.openHighTickets > 0
          ? `${input.openHighTickets} high-priority ticket(s) open`
          : "No urgent tickets",
    },
    {
      label: "Billing Alerts",
      status: input.failedPayments7d > 0 ? "warning" : "healthy",
      note:
        input.failedPayments7d > 0
          ? `${input.failedPayments7d} failed payment(s) in 7 days`
          : "No recent payment failures",
    },
    {
      label: "Object Capture",
      status: !input.objectCaptureAvailable
        ? "warning"
        : input.staleOcLeases > 0 || (input.queuedOcJobs > 0 && input.activeOcWorkers === 0)
          ? "error"
          : input.queuedOcJobs >= Number(process.env.OC_BACKLOG_WARNING_JOBS || 10)
            ? "warning"
            : "healthy",
      note: input.objectCaptureAvailable
        ? `${input.activeOcWorkers} worker(s) · ${input.queuedOcJobs} queued · ${input.staleOcLeases} stale`
        : "Capture tables unavailable",
    },
    {
      label: "Platform Mode",
      status: input.maintenanceMode ? "error" : "healthy",
      note: input.maintenanceMode ? "Maintenance mode enabled" : "Live",
    },
  ];

  return items;
}

async function countActiveObjectCaptureJobs() {
  try {
    const rows = await query<{ total: number; queued: number; stale: number; workers: number }>(`
      SELECT COUNT(*) total,SUM(status='queued') queued,
       SUM(status='processing' AND lease_expires_at<NOW()) stale,
       (SELECT COUNT(*) FROM object_capture_workers WHERE heartbeat_at>=TIMESTAMPADD(SECOND,-120,NOW())) workers
      FROM object_capture_jobs WHERE status IN ('pending','uploading','queued','validating','processing')
    `);
    return {
      available: true, total: Number(rows[0]?.total || 0), queued: Number(rows[0]?.queued || 0),
      stale: Number(rows[0]?.stale || 0), workers: Number(rows[0]?.workers || 0),
    };
  } catch {
    return { available: false, total: 0, queued: 0, stale: 0, workers: 0 };
  }
}

async function isStorageWritable() {
  try {
    await access(resolveStorageRoot());
    return true;
  } catch {
    return false;
  }
}

export async function getMasterAdminDashboardData(): Promise<MasterAdminDashboardData> {
  await ensureAppSchema();

  const [settings, emailDelivery] = await Promise.all([
    getPlatformSettings().catch(() => null),
    getEmailDeliveryStatus().catch(() => null),
  ]);

  const [
    customers,
    admins,
    products,
    analytics,
    subscriptions,
    todayStats,
    liveActivityRows,
    monthlyRevenuePaise,
    totalRevenuePaise,
    totalPayments,
    revenueDaily,
    customerDaily,
    dailyProducts,
    dailySubscriptions,
    dailyAnalytics,
    topProducts,
    topCountries,
    planBreakdown,
    revenueWindow,
    customerWindow,
    failedPayments7d,
    openHighTickets,
    ocState,
    storageSnapshots,
    storageWritable,
  ] = await Promise.all([
    query<{
      totalCustomers: number;
      activeCustomers: number;
      suspendedUsers: number;
      newCustomers: number;
      newCustomers7d: number;
      storageUsedMB: number;
      bandwidthUsedMB: number;
    }>(`
      SELECT
        COUNT(*) AS totalCustomers,
        SUM(status = 'Active') AS activeCustomers,
        SUM(status = 'Suspended') AS suspendedUsers,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newCustomers,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newCustomers7d,
        COALESCE(SUM(storage_used_mb), 0) AS storageUsedMB,
        COALESCE(SUM(bandwidth_used_mb), 0) AS bandwidthUsedMB
      FROM customers
    `).catch(() => [{
      totalCustomers: 0,
      activeCustomers: 0,
      suspendedUsers: 0,
      newCustomers: 0,
      newCustomers7d: 0,
      storageUsedMB: 0,
      bandwidthUsedMB: 0,
    }]),

    query<{ adminUsers: number }>(
      `SELECT COUNT(*) AS adminUsers FROM master_admins WHERE status = 'Active'`,
    ).catch(() => [{ adminUsers: 0 }]),

    query<{ totalProducts: number; publishedProducts: number; viewerVisits: number }>(`
      SELECT
        COUNT(*) AS totalProducts,
        SUM(status IN ('published', 'active')) AS publishedProducts,
        COALESCE(SUM(views), 0) AS viewerVisits
      FROM products
    `).catch(() => [{ totalProducts: 0, publishedProducts: 0, viewerVisits: 0 }]),

    query<{
      arViews: number;
      qrScans: number;
      todayArViews: number;
      todayQrScans: number;
    }>(`
      SELECT
        COALESCE(SUM(ar_launches), 0) AS arViews,
        COALESCE(SUM(qr_scans), 0) AS qrScans,
        COALESCE(SUM(CASE WHEN date = CURDATE() THEN ar_launches ELSE 0 END), 0) AS todayArViews,
        COALESCE(SUM(CASE WHEN date = CURDATE() THEN qr_scans ELSE 0 END), 0) AS todayQrScans
      FROM analytics_daily
    `).catch(() => [{ arViews: 0, qrScans: 0, todayArViews: 0, todayQrScans: 0 }]),

    query<{ activeSubscriptions: number; trialUsers: number }>(`
      SELECT
        COUNT(DISTINCT CASE WHEN status IN ('active', 'trialing') THEN customer_uid END) AS activeSubscriptions,
        COUNT(DISTINCT CASE WHEN status = 'trialing' THEN customer_uid END) AS trialUsers
      FROM customer_subscriptions
    `).catch(() => [{ activeSubscriptions: 0, trialUsers: 0 }]),

    query<{ todayUploads: number; failedPaymentsToday: number; productsUpdatedToday: number }>(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE DATE(created_at) = CURDATE()) AS todayUploads,
        (SELECT COUNT(*) FROM billing_payments WHERE status = 'failed' AND DATE(created_at) = CURDATE()) AS failedPaymentsToday,
        (SELECT COUNT(*) FROM products WHERE DATE(updated_at) = CURDATE() AND DATE(updated_at) <> DATE(created_at)) AS productsUpdatedToday
    `).catch(() => [{ todayUploads: 0, failedPaymentsToday: 0, productsUpdatedToday: 0 }]),

    query<{ recentLogins: number; openSupportTickets: number }>(`
      SELECT
        (SELECT COUNT(*) FROM auth_login_logs
          WHERE status = 'success' AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)) AS recentLogins,
        (SELECT COUNT(*) FROM support_tickets
          WHERE status IN ('open','pending')) AS openSupportTickets
    `).catch(() => [{ recentLogins: 0, openSupportTickets: 0 }]),

    getMonthlyCapturedRevenuePaise().catch(() => 0),

    query<{ total: number }>(`
      SELECT COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) AS total
      FROM billing_payments bp
      LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
      WHERE bp.status = 'captured'
    `).catch(() => [{ total: 0 }]),

    query<{ totalPayments: number }>(`
      SELECT COUNT(*) AS totalPayments
      FROM billing_payments
      WHERE status = 'captured'
        AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
    `).catch(() => [{ totalPayments: 0 }]),

    loadDailyRevenue(DAY_SERIES),
    loadDailyCustomers(DAY_SERIES),
    loadDailyProducts(DAY_SERIES),
    loadDailySubscriptions(DAY_SERIES),
    loadDailyAnalytics(DAY_SERIES),
    query<{ product: string; customer: string; views: number; ar: number }>(`
      SELECT pr.title AS product,
        COALESCE(c.company_name, c.contact_name, c.email, 'Unknown') AS customer,
        COALESCE(pr.views, 0) AS views,
        COALESCE(SUM(a.ar_launches), 0) AS ar
      FROM products pr
      LEFT JOIN customers c ON c.customer_uid = pr.customer_uid
      LEFT JOIN analytics_daily a ON a.product_uid = pr.id
      GROUP BY pr.id
      ORDER BY views DESC
      LIMIT 5
    `).catch(() => []),
    loadTopCountries(),
    loadPlanBreakdown(),

    query<{ last7: number; prev7: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN bp.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS last7,
        COALESCE(SUM(CASE WHEN bp.created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND bp.created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN COALESCE(bi.total_paise, bp.amount_paise) ELSE 0 END), 0) / 100 AS prev7
      FROM billing_payments bp
      LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
      WHERE bp.status = 'captured'
    `).catch(() => [{ last7: 0, prev7: 0 }]),

    query<{ last7: number; prev7: number }>(`
      SELECT
        SUM(created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS last7,
        SUM(created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS prev7
      FROM customers
    `).catch(() => [{ last7: 0, prev7: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM billing_payments
      WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `).catch(() => [{ total: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM support_tickets
      WHERE status IN ('open','pending') AND priority = 'high'
    `).catch(() => [{ total: 0 }]),

    countActiveObjectCaptureJobs(),

    queryStorageGrowthSeries(SPARKLINE_DAYS).catch(() => []),
    isStorageWritable(),
  ]);

  const storageUsedMB = Number(customers[0]?.storageUsedMB || 0);
  const storageCapacityMB = PLATFORM_STORAGE_TB * 1024 * 1024;
  const storageUsedPct = Math.min(100, Math.round((storageUsedMB / storageCapacityMB) * 1000) / 10) || 0;

  const storageSparkline =
    storageSnapshots.length > 0
      ? storageSnapshots.map((row) => Number(row.value || 0))
      : tailValues(revenueDaily, (row) => Number(row.value || 0));

  const sparklines: DashboardSparklines = {
    revenue: tailValues(revenueDaily, (row) => Number(row.value || 0)),
    customers: tailValues(customerDaily, (row) => Number(row.value || 0)),
    subscriptions: tailValues(dailySubscriptions, (row) => Number(row.value || 0)),
    products: tailValues(dailyProducts, (row) => Number(row.value || 0)),
    storage: storageSparkline,
    bandwidth: tailValues(dailyAnalytics, (row) => Number(row.ar || 0) + Number(row.qr || 0)),
    viewerVisits: tailValues(dailyAnalytics, (row) => Number(row.views || 0)),
  };

  const systemHealth = await buildSystemHealth({
    storageUsedPct,
    failedPayments7d: Number(failedPayments7d[0]?.total || 0),
    openHighTickets: Number(openHighTickets[0]?.total || 0),
    maintenanceMode: Boolean(settings?.maintenanceMode),
    emailProvider: emailDelivery?.activeProvider || "unconfigured",
    razorpayConfigured: Boolean(settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID),
    storageWritable,
    objectCaptureAvailable: ocState.available,
    activeOcJobs: ocState.total,
    activeOcWorkers: ocState.workers,
    queuedOcJobs: ocState.queued,
    staleOcLeases: ocState.stale,
  });

  return {
    totalCustomers: Number(customers[0]?.totalCustomers || 0),
    activeCustomers: Number(customers[0]?.activeCustomers || 0),
    trialUsers: Number(subscriptions[0]?.trialUsers || 0),
    suspendedUsers: Number(customers[0]?.suspendedUsers || 0),
    newCustomers: Number(customers[0]?.newCustomers || 0),
    newCustomers7d: Number(customers[0]?.newCustomers7d || 0),
    adminUsers: Number(admins[0]?.adminUsers || 0),
    activeSubscriptions: Number(subscriptions[0]?.activeSubscriptions || 0),
    totalProducts: Number(products[0]?.totalProducts || 0),
    publishedProducts: Number(products[0]?.publishedProducts || 0),
    storageUsedMB,
    storageCapacityTB: PLATFORM_STORAGE_TB,
    storageUsedPct,
    bandwidthUsedMB: Number(customers[0]?.bandwidthUsedMB || 0),
    viewerVisits: Number(products[0]?.viewerVisits || 0),
    arViews: Number(analytics[0]?.arViews || 0),
    qrScans: Number(analytics[0]?.qrScans || 0),
    monthlyRevenue: Math.round(Number(monthlyRevenuePaise) / 100),
    totalRevenue: Math.round(Number(totalRevenuePaise[0]?.total || 0) / 100),
    totalPayments: Number(totalPayments[0]?.totalPayments || 0),
    revenueChange7dPct: pctChange(Number(revenueWindow[0]?.last7 || 0), Number(revenueWindow[0]?.prev7 || 0)),
    customerChange7dPct: pctChange(Number(customerWindow[0]?.last7 || 0), Number(customerWindow[0]?.prev7 || 0)),
    todayUploads: Number(todayStats[0]?.todayUploads || 0),
    todayArViews: Number(analytics[0]?.todayArViews || 0),
    todayQrScans: Number(analytics[0]?.todayQrScans || 0),
    failedPaymentsToday: Number(todayStats[0]?.failedPaymentsToday || 0),
    revenueDaily: revenueDaily.map((row) => ({
      label: String(row.label || ""),
      value: Number(row.value || 0),
    })),
    customerDaily: customerDaily.map((row) => ({
      label: String(row.label || ""),
      value: Number(row.value || 0),
    })),
    planBreakdown: planBreakdown.map((row) => ({
      plan: row.plan,
      value: row.value,
    })),
    topProducts: topProducts.map((row) => ({
      product: String(row.product || "Untitled"),
      customer: String(row.customer || "Unknown"),
      views: Number(row.views || 0),
      ar: Number(row.ar || 0),
    })),
    topCountries,
    systemHealth,
    liveActivity: {
      recentLogins: Number(liveActivityRows[0]?.recentLogins || 0),
      productsUpdatedToday: Number(todayStats[0]?.productsUpdatedToday || 0),
      todayUploads: Number(todayStats[0]?.todayUploads || 0),
      objectCaptureJobs: ocState.total,
      openSupportTickets: Number(liveActivityRows[0]?.openSupportTickets || 0),
    },
    sparklines,
    generatedAt: new Date().toISOString(),
  };
}
