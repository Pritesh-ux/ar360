import path from "path";
import { getBillingPlans } from "@/lib/billing/admin-plans";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import {
  PLATFORM_BANDWIDTH_TB,
  PLATFORM_STORAGE_TB,
  mbToTb,
} from "@/components/features/master-admin/storage-utils";
import { query } from "@/lib/db";
import { paginationMeta } from "@/lib/master-admin/pagination";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import {
  cleanupTempStorage,
  deleteOrphanFolders,
  scanOrphanFiles,
  type CleanupResult,
  type OrphanScanResult,
} from "@/lib/storage/admin-cleanup";
import { enrichLargestFiles, scanPlatformStorage, type PlatformStorageAudit } from "@/lib/storage/platform-audit";
import { queryStorageGrowthSeries, upsertStorageSnapshot } from "@/lib/storage/snapshots";

export type StorageFilterParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  growthDays?: number;
};

type StorageRow = {
  customer_uid: string;
  contact_name: string;
  company_name: string | null;
  email: string;
  plan_id: string;
  status: string;
  storage_used_mb: number;
  bandwidth_used_mb: number;
  product_count: number;
  last_upload: string | null;
};

const LEGACY_PLAN_STORAGE_MB: Record<string, number> = {
  free: 200,
  trial: 100,
  starter: 2048,
  basic: 512,
  pro: 10240,
  professional: 5120,
  business: 51200,
  enterprise: 25600,
};

async function planStorageMb(planId: string) {
  const mapped = mapLegacyPlanId(planId || "trial");
  const plans = await getBillingPlans({ activeOnly: false }).catch(() => []);
  const match = plans.find((p) => p.id === mapped);
  if (match) return Math.round(Number(match.storageGb || 0) * 1024);
  return LEGACY_PLAN_STORAGE_MB[mapped] ?? 200;
}

function buildStorageWhere(search?: string) {
  const conditions: string[] = [];
  const values: string[] = [];
  const q = (search || "").trim().toLowerCase();

  if (q) {
    conditions.push(`(
      LOWER(c.contact_name) LIKE ?
      OR LOWER(c.email) LIKE ?
      OR LOWER(c.plan_id) LIKE ?
      OR LOWER(c.company_name) LIKE ?
    )`);
    const like = `%${q}%`;
    values.push(like, like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

function trendLabel(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? "New usage in period" : "No change vs prior period";
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  return `${pct >= 0 ? "↑" : "↓"} ${rounded}% vs prior ${Math.round(previous * 1000) / 1000} TB`;
}

async function loadStorageGrowthSeries(currentUsedTb: number, limitDays = 30) {
  const rows = await queryStorageGrowthSeries(limitDays);
  if (rows.length > 0) return rows;
  if (currentUsedTb <= 0) return [];
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return [{ label: today, value: Number(currentUsedTb.toFixed(3)) }];
}

export async function getStorageDashboard(params: StorageFilterParams = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 10)));
  const offset = (page - 1) * pageSize;
  const growthDays = Math.min(90, Math.max(7, Number(params.growthDays || 30)));
  const { where, values } = buildStorageWhere(params.search);

  const [countRows, rows, planRows, recentProducts, audit, allCustomersForWarnings] = await Promise.all([
    query<{ total: number }>(`
      SELECT COUNT(DISTINCT c.customer_uid) AS total
      FROM customers c
      LEFT JOIN products p ON p.customer_uid = c.customer_uid
      ${where}
    `, values),

    query<StorageRow>(`
      SELECT
        c.customer_uid,
        c.contact_name,
        c.company_name,
        c.email,
        c.plan_id,
        c.status,
        c.storage_used_mb,
        c.bandwidth_used_mb,
        COUNT(p.id) AS product_count,
        MAX(p.updated_at) AS last_upload
      FROM customers c
      LEFT JOIN products p ON p.customer_uid = c.customer_uid
      ${where}
      GROUP BY c.customer_uid
      ORDER BY c.storage_used_mb DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

    query<{ plan_id: string; used_mb: number; customers: number }>(`
      SELECT plan_id, COALESCE(SUM(storage_used_mb), 0) AS used_mb, COUNT(*) AS customers
      FROM customers
      GROUP BY plan_id
      ORDER BY used_mb DESC
    `),

    query<{
      id: string;
      title: string;
      file_name: string | null;
      customer_uid: string;
      contact_name: string;
      updated_at: string;
    }>(`
      SELECT p.id, p.title, p.file_name, p.customer_uid, c.contact_name, p.updated_at
      FROM products p
      LEFT JOIN customers c ON c.customer_uid = p.customer_uid
      WHERE p.file_name IS NOT NULL AND p.file_name != ''
      ORDER BY p.updated_at DESC
      LIMIT 8
    `).catch(() => []),

    scanPlatformStorage({ maxCustomers: 80, maxLargestFiles: 10 }).catch(
      (): PlatformStorageAudit => ({
        fileTypes: [],
        largestFiles: [],
        scannedCustomers: 0,
        scannedFiles: 0,
      }),
    ),

    query<{ plan_id: string; storage_used_mb: number }>(`
      SELECT plan_id, storage_used_mb FROM customers
    `).catch(() => []),
  ]);

  const planLimitCache = new Map<string, number>();
  async function getLimit(planId: string) {
    const key = mapLegacyPlanId(planId || "trial");
    if (!planLimitCache.has(key)) {
      planLimitCache.set(key, await planStorageMb(key));
    }
    return planLimitCache.get(key)!;
  }

  const items = await Promise.all(
    rows.map(async (r) => {
      const limitMB = await getLimit(r.plan_id);
      const usedMB = Number(r.storage_used_mb || 0);
      const pct = limitMB >= 999999999 ? 0 : Math.min(Math.round((usedMB / limitMB) * 100), 100);
      const storageStatus = pct >= 90 ? "Critical" : pct >= 80 ? "Warning" : "Normal";
      return {
        customer_uid: r.customer_uid,
        customer: r.contact_name,
        company: r.company_name,
        email: r.email,
        plan: r.plan_id,
        status: r.status,
        usedMB,
        limitMB,
        usedGB: Number((usedMB / 1024).toFixed(2)),
        limitGB: Number((limitMB / 1024).toFixed(2)),
        bandwidthMB: Number(r.bandwidth_used_mb || 0),
        pct,
        storageStatus,
        products: Number(r.product_count || 0),
        lastUpload: r.last_upload,
      };
    }),
  );

  const pagination = paginationMeta(Number(countRows[0]?.total || 0), page, pageSize);

  const platformRows = await query<{ storage: number; bandwidth: number }>(`
    SELECT
      COALESCE(SUM(storage_used_mb), 0) AS storage,
      COALESCE(SUM(bandwidth_used_mb), 0) AS bandwidth
    FROM customers
  `).catch(() => [{ storage: 0, bandwidth: 0 }]);

  let warnings = 0;
  let critical = 0;
  for (const row of allCustomersForWarnings) {
    const limitMB = await getLimit(row.plan_id);
    const usedMB = Number(row.storage_used_mb || 0);
    if (limitMB >= 999999999) continue;
    const pct = (usedMB / limitMB) * 100;
    if (pct >= 90) critical += 1;
    else if (pct >= 80) warnings += 1;
  }

  const totalUsedMB = Number(platformRows[0]?.storage || 0);
  const totalBandwidthMB = Number(platformRows[0]?.bandwidth || 0);
  const usedTb = mbToTb(totalUsedMB);
  const bandwidthUsedTb = mbToTb(totalBandwidthMB);
  const freeTb = Math.max(PLATFORM_STORAGE_TB - usedTb, 0);

  await upsertStorageSnapshot({
    totalUsedMB,
    totalBandwidthMB,
    customerCount: Number(countRows[0]?.total || 0),
  });

  const storageGrowth = await loadStorageGrowthSeries(usedTb, growthDays);
  const priorUsedTb =
    storageGrowth.length >= 2 ? storageGrowth[storageGrowth.length - 2].value : storageGrowth[0]?.value ?? 0;

  const priorBandwidthRows = await query<{ total: number }>(`
    SELECT total_bandwidth_bytes / POW(1024, 4) AS total
    FROM storage_usage_snapshots
    WHERE snapshot_date = DATE_SUB(CURDATE(), INTERVAL ? DAY)
    LIMIT 1
  `, [growthDays]).catch(() => []);

  const priorBandwidthTb = Number(priorBandwidthRows[0]?.total || 0);

  const auditTotalBytes = audit.fileTypes.reduce((sum, row) => sum + row.bytes, 0);
  const fileTypeBreakdown = audit.fileTypes.map((row) => ({
    key: row.key,
    label: row.label,
    bytes: row.bytes,
    tb: row.bytes / (1024 ** 4),
    percent: auditTotalBytes > 0 ? Math.round((row.bytes / auditTotalBytes) * 1000) / 10 : 0,
  }));

  const largestFiles = await enrichLargestFiles(audit.largestFiles);

  const topUsers = items.slice(0, 5).map((user) => ({
    customerUid: user.customer_uid,
    name: user.customer,
    email: user.email,
    usedMB: user.usedMB,
    pct: user.pct,
    platformPct: totalUsedMB > 0 ? Math.round((user.usedMB / totalUsedMB) * 1000) / 10 : 0,
  }));

  const storageByPlan = planRows.map((row) => ({
    planId: row.plan_id,
    usedMB: Number(row.used_mb || 0),
    customers: Number(row.customers || 0),
  }));

  const recentActivities = recentProducts.map((product) => ({
    type: "upload" as const,
    title: `File uploaded: ${product.file_name || product.title}`,
    subtitle: product.contact_name || product.customer_uid,
    meta: product.title,
    date: product.updated_at,
  }));

  return {
    items,
    pagination,
    summary: {
      totalStorageTb: PLATFORM_STORAGE_TB,
      usedStorageTb: Number(usedTb.toFixed(3)),
      freeStorageTb: Number(freeTb.toFixed(3)),
      usedPct: Math.round((usedTb / PLATFORM_STORAGE_TB) * 1000) / 10,
      freePct: Math.round((freeTb / PLATFORM_STORAGE_TB) * 1000) / 10,
      bandwidthUsedTb: Number(bandwidthUsedTb.toFixed(3)),
      bandwidthLimitTb: PLATFORM_BANDWIDTH_TB,
      bandwidthPct: Math.round((bandwidthUsedTb / PLATFORM_BANDWIDTH_TB) * 1000) / 10,
      totalUsedMB,
      totalBandwidthMB,
      warnings,
      critical,
      customerCount: Number(countRows[0]?.total || 0),
      storageTrend: trendLabel(usedTb, priorUsedTb),
      bandwidthTrend: trendLabel(bandwidthUsedTb, priorBandwidthTb),
      growthDays,
    },
    analytics: {
      storageGrowth,
      fileTypeBreakdown,
      usedVsFree: {
        usedTb: Number(usedTb.toFixed(3)),
        freeTb: Number(freeTb.toFixed(3)),
        totalTb: PLATFORM_STORAGE_TB,
      },
      scanMeta: {
        scannedCustomers: audit.scannedCustomers,
        scannedFiles: audit.scannedFiles,
      },
    },
    topUsers,
    largestFiles: largestFiles.map((file) => ({
      fileName: file.fileName,
      customerUid: file.customerUid,
      customerName: file.customerName,
      productUid: file.productUid,
      productTitle: file.productTitle,
      sizeBytes: file.sizeBytes,
      fileType: file.fileType,
      uploadedAt: file.modifiedAt,
    })),
    storageByPlan,
    recentActivities,
  };
}

export async function exportStorageCsv(params: StorageFilterParams = {}) {
  const { where, values } = buildStorageWhere(params.search);
  const rows = await query<StorageRow>(`
    SELECT
      c.customer_uid,
      c.contact_name,
      c.company_name,
      c.email,
      c.plan_id,
      c.storage_used_mb,
      c.bandwidth_used_mb,
      COUNT(p.id) AS product_count
    FROM customers c
    LEFT JOIN products p ON p.customer_uid = c.customer_uid
    ${where}
    GROUP BY c.customer_uid
    ORDER BY c.storage_used_mb DESC
    LIMIT 5000
  `, values);

  const planLimitCache = new Map<string, number>();
  async function getLimit(planId: string) {
    const key = mapLegacyPlanId(planId || "trial");
    if (!planLimitCache.has(key)) {
      planLimitCache.set(key, await planStorageMb(key));
    }
    return planLimitCache.get(key)!;
  }

  const header = ["Customer", "Email", "Company", "Plan", "Storage Used (MB)", "Storage Limit (MB)", "Usage %", "Bandwidth (MB)", "Products"];
  const lines: (string | number)[][] = [];

  for (const row of rows) {
    const limitMB = await getLimit(row.plan_id);
    const usedMB = Number(row.storage_used_mb || 0);
    const pct = limitMB >= 999999999 ? 0 : Math.min(Math.round((usedMB / limitMB) * 100), 100);
    lines.push([
      row.contact_name,
      row.email,
      row.company_name || "",
      row.plan_id,
      usedMB,
      limitMB,
      pct,
      Number(row.bandwidth_used_mb || 0),
      Number(row.product_count || 0),
    ]);
  }

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function runStorageAction(input: {
  action: "cleanup" | "scan_orphans" | "delete_orphans";
  dryRun?: boolean;
  orphanPaths?: string[];
  adminId?: number;
}): Promise<{ action: string; result: CleanupResult | OrphanScanResult | { deleted: number; freedBytes: number; dryRun: boolean }; scan?: OrphanScanResult }> {
  const dryRun = Boolean(input.dryRun);

  if (input.action === "cleanup") {
    const result = await cleanupTempStorage({ dryRun, olderThanDays: 7 });
    await writeMasterAdminAudit({
      adminId: input.adminId,
      action: dryRun ? "storage.cleanup_dry_run" : "storage.cleanup",
      entityType: "storage",
      metadata: {
        removedFiles: result.removedFiles,
        freedBytes: result.freedBytes,
        dryRun,
      },
    });
    return { action: input.action, result };
  }

  if (input.action === "scan_orphans") {
    const result = await scanOrphanFiles({ maxCustomers: 200 });
    await writeMasterAdminAudit({
      adminId: input.adminId,
      action: "storage.scan_orphans",
      entityType: "storage",
      metadata: {
        orphanCount: result.orphanCount,
        orphanBytes: result.orphanBytes,
        scannedCustomers: result.scannedCustomers,
      },
    });
    return { action: input.action, result };
  }

  if (input.action === "delete_orphans") {
    const scan = await scanOrphanFiles({ maxCustomers: 200 });
    const selected =
      input.orphanPaths?.length
        ? scan.orphans.filter((row) => input.orphanPaths!.includes(row.path))
        : scan.orphans;

    if (selected.length === 0) {
      throw new Error("No orphan folders matched for deletion.");
    }

    const result = await deleteOrphanFolders(selected, dryRun);
    await writeMasterAdminAudit({
      adminId: input.adminId,
      action: dryRun ? "storage.delete_orphans_dry_run" : "storage.delete_orphans",
      entityType: "storage",
      metadata: {
        deleted: result.deleted,
        freedBytes: result.freedBytes,
        orphanCount: selected.length,
        dryRun,
      },
    });
    return { action: input.action, scan, result };
  }

  throw new Error("Invalid storage action");
}
