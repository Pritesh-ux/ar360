import { access } from "fs/promises";
import { ensureAppSchema, query } from "@/lib/db";
import { ensureEmailLogsSchema } from "@/lib/email/email-log";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { getEmailDeliveryStatus } from "@/lib/email/delivery-config";
import { PLATFORM_STORAGE_TB } from "@/components/features/master-admin/storage-utils";
import { resolveStorageRoot } from "@/lib/storage/paths";
import type { DashboardSystemHealthItem } from "@/lib/master-admin/dashboard.service";

export type SystemHealthSnapshot = {
  checks: DashboardSystemHealthItem[];
  resources: {
    storageUsedMB: number;
    storageUsedPct: number;
    bandwidthUsedMB: number;
    adminUsers: number;
    suspendedUsers: number;
    openSupportTickets: number;
    failedEmails24h: number;
    uptimeSec: number;
  };
  db: {
    connected: boolean;
    latencyMs: number | null;
  };
  objectCapture: {
    activeWorkers: number;
    latestHeartbeatAt: string | null;
    queueDepth: number;
    oldestQueuedAgeSec: number;
    staleLeases: number;
    successRate24h: number;
    failed24h: number;
    averageDurationSec24h: number;
    storageUsedBytes: number;
  };
  checkedAt: string;
};

const startedAt = Date.now();

async function pingDatabase() {
  const start = Date.now();
  try {
    await query<{ ok: number }>("SELECT 1 AS ok");
    return { connected: true, latencyMs: Date.now() - start };
  } catch {
    return { connected: false, latencyMs: null };
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

async function countActiveObjectCaptureJobs() {
  try {
    const rows = await query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM object_capture_jobs
      WHERE status IN ('pending','uploading','queued','validating','processing')
    `);
    return { available: true, total: Number(rows[0]?.total || 0) };
  } catch {
    return { available: false, total: 0 };
  }
}

async function getObjectCaptureHealth() {
  const [queue, workers, outcomes, storage] = await Promise.all([
    query<{ queueDepth: number; oldestQueuedAgeSec: number; staleLeases: number }>(`
      SELECT SUM(status='queued') queueDepth,
       COALESCE(MAX(IF(status='queued',TIMESTAMPDIFF(SECOND,created_at,NOW()),0)),0) oldestQueuedAgeSec,
       SUM(status='processing' AND lease_expires_at<NOW()) staleLeases
      FROM object_capture_jobs`),
    query<{ activeWorkers: number; latestHeartbeatAt: Date | string | null }>(`
      SELECT SUM(heartbeat_at>=TIMESTAMPADD(SECOND,-120,NOW())) activeWorkers,
       MAX(heartbeat_at) latestHeartbeatAt FROM object_capture_workers`),
    query<{ completed: number; failed: number; averageDurationSec: number }>(`
      SELECT SUM(status='completed') completed,SUM(status='failed') failed,
       COALESCE(AVG(IF(completed_at IS NOT NULL,TIMESTAMPDIFF(SECOND,started_at,completed_at),NULL)),0) averageDurationSec
      FROM object_capture_jobs WHERE updated_at>=TIMESTAMPADD(HOUR,-24,NOW())`),
    query<{ storageUsedBytes: number }>(`
      SELECT (SELECT COALESCE(SUM(byte_size),0) FROM object_capture_images)
       + (SELECT COALESCE(SUM(output_bytes),0) FROM object_capture_jobs) storageUsedBytes`),
  ]);
  const completed = Number(outcomes[0]?.completed || 0);
  const failed = Number(outcomes[0]?.failed || 0);
  return {
    activeWorkers: Number(workers[0]?.activeWorkers || 0),
    latestHeartbeatAt: workers[0]?.latestHeartbeatAt
      ? new Date(workers[0].latestHeartbeatAt).toISOString()
      : null,
    queueDepth: Number(queue[0]?.queueDepth || 0),
    oldestQueuedAgeSec: Number(queue[0]?.oldestQueuedAgeSec || 0),
    staleLeases: Number(queue[0]?.staleLeases || 0),
    successRate24h: completed + failed ? Math.round((completed / (completed + failed)) * 1000) / 10 : 100,
    failed24h: failed,
    averageDurationSec24h: Math.round(Number(outcomes[0]?.averageDurationSec || 0)),
    storageUsedBytes: Number(storage[0]?.storageUsedBytes || 0),
  };
}

function buildChecks(input: {
  dbConnected: boolean;
  dbLatencyMs: number | null;
  storageUsedPct: number;
  storageWritable: boolean;
  failedPayments7d: number;
  openHighTickets: number;
  openSupportTickets: number;
  failedEmails24h: number;
  maintenanceMode: boolean;
  emailProvider: "smtp" | "resend" | "disabled" | "unconfigured";
  razorpayConfigured: boolean;
  objectCaptureAvailable: boolean;
  activeOcJobs: number;
  ocHealth: Awaited<ReturnType<typeof getObjectCaptureHealth>> | null;
}): DashboardSystemHealthItem[] {
  const items: DashboardSystemHealthItem[] = [
    {
      label: "Database",
      status: input.dbConnected ? (input.dbLatencyMs != null && input.dbLatencyMs > 500 ? "warning" : "healthy") : "error",
      note: input.dbConnected
        ? input.dbLatencyMs != null
          ? `MySQL reachable (${input.dbLatencyMs}ms)`
          : "MySQL connection active"
        : "Database unreachable",
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
      status: input.emailProvider === "smtp" || input.emailProvider === "resend"
        ? input.failedEmails24h > 0
          ? "warning"
          : "healthy"
        : "warning",
      note: input.emailProvider === "smtp" || input.emailProvider === "resend"
        ? input.failedEmails24h > 0
          ? `${input.failedEmails24h} failed email(s) in 24h`
          : `${input.emailProvider === "smtp" ? "SMTP" : "Resend"} live provider active`
        : input.emailProvider === "disabled"
          ? "Transactional emails disabled"
          : "No live email provider configured",
    },
    {
      label: "Support Queue",
      status: input.openHighTickets > 5 ? "warning" : input.openSupportTickets > 20 ? "warning" : "healthy",
      note:
        input.openHighTickets > 0
          ? `${input.openHighTickets} high-priority · ${input.openSupportTickets} open total`
          : input.openSupportTickets > 0
            ? `${input.openSupportTickets} open ticket(s)`
            : "No open tickets",
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
      status: !input.objectCaptureAvailable || !input.ocHealth
        ? "warning"
        : input.ocHealth.staleLeases > 0 || input.ocHealth.activeWorkers === 0
          ? "error"
          : input.ocHealth.oldestQueuedAgeSec > Number(process.env.OC_QUEUE_AGE_WARNING_SECONDS || 1800)
            ? "warning"
            : "healthy",
      note: input.objectCaptureAvailable
        ? input.ocHealth
          ? `${input.ocHealth.activeWorkers} worker(s), ${input.ocHealth.queueDepth} queued, ${input.ocHealth.staleLeases} stale lease(s)`
          : `${input.activeOcJobs} job(s) active`
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

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  await ensureAppSchema();
  await ensureEmailLogsSchema().catch(() => undefined);

  const [settings, emailDelivery] = await Promise.all([
    getPlatformSettings().catch(() => null),
    getEmailDeliveryStatus().catch(() => null),
  ]);
  const dbPing = await pingDatabase();

  const [
    customerRows,
    adminRows,
    failedPaymentsRows,
    openHighTicketsRows,
    openTicketsRows,
    failedEmailRows,
    ocState,
    storageWritable,
    ocHealth,
  ] = await Promise.all([
    query<{ storageUsedMB: number; bandwidthUsedMB: number; suspendedUsers: number }>(`
      SELECT
        COALESCE(SUM(storage_used_mb), 0) AS storageUsedMB,
        COALESCE(SUM(bandwidth_used_mb), 0) AS bandwidthUsedMB,
        SUM(status = 'Suspended') AS suspendedUsers
      FROM customers
    `).catch(() => [{ storageUsedMB: 0, bandwidthUsedMB: 0, suspendedUsers: 0 }]),

    query<{ adminUsers: number }>(`
      SELECT COUNT(*) AS adminUsers FROM master_admins WHERE status = 'Active'
    `).catch(() => [{ adminUsers: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM billing_payments
      WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `).catch(() => [{ total: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM support_tickets
      WHERE status IN ('open','pending') AND priority = 'high'
    `).catch(() => [{ total: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM support_tickets
      WHERE status IN ('open','pending')
    `).catch(() => [{ total: 0 }]),

    query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM email_logs
      WHERE status = 'failed' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `).catch(() => [{ total: 0 }]),

    countActiveObjectCaptureJobs(),
    isStorageWritable(),
    getObjectCaptureHealth().catch(() => null),
  ]);

  const storageUsedMB = Number(customerRows[0]?.storageUsedMB || 0);
  const storageCapacityMB = PLATFORM_STORAGE_TB * 1024 * 1024;
  const storageUsedPct = Math.min(100, Math.round((storageUsedMB / storageCapacityMB) * 1000) / 10) || 0;
  const failedEmails24h = Number(failedEmailRows[0]?.total || 0);

  const checks = buildChecks({
    dbConnected: dbPing.connected,
    dbLatencyMs: dbPing.latencyMs,
    storageUsedPct,
    storageWritable,
    failedPayments7d: Number(failedPaymentsRows[0]?.total || 0),
    openHighTickets: Number(openHighTicketsRows[0]?.total || 0),
    openSupportTickets: Number(openTicketsRows[0]?.total || 0),
    failedEmails24h,
    maintenanceMode: Boolean(settings?.maintenanceMode),
    emailProvider: emailDelivery?.activeProvider || "unconfigured",
    razorpayConfigured: Boolean(settings?.razorpayKeyId || process.env.RAZORPAY_KEY_ID),
    objectCaptureAvailable: ocState.available,
    activeOcJobs: ocState.total,
    ocHealth,
  });

  return {
    checks,
    resources: {
      storageUsedMB,
      storageUsedPct,
      bandwidthUsedMB: Number(customerRows[0]?.bandwidthUsedMB || 0),
      adminUsers: Number(adminRows[0]?.adminUsers || 0),
      suspendedUsers: Number(customerRows[0]?.suspendedUsers || 0),
      openSupportTickets: Number(openTicketsRows[0]?.total || 0),
      failedEmails24h,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    },
    db: dbPing,
    objectCapture: ocHealth || {
      activeWorkers: 0, latestHeartbeatAt: null, queueDepth: 0, oldestQueuedAgeSec: 0,
      staleLeases: 0, successRate24h: 0, failed24h: 0, averageDurationSec24h: 0,
      storageUsedBytes: 0,
    },
    checkedAt: new Date().toISOString(),
  };
}
