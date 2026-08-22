import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema } from "@/lib/db";
import { paginationMeta } from "@/lib/master-admin/pagination";
import {
  exportStorageCsv,
  getStorageDashboard,
  runStorageAction,
} from "@/lib/master-admin/storage.service";
import {
  PLATFORM_BANDWIDTH_TB,
  PLATFORM_STORAGE_TB,
} from "@/components/features/master-admin/storage-utils";
import { getHostingerVpsLiveMetrics, liveBytesToTb } from "@/lib/hostinger/vps-live-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("storage.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 10)));
  const growthDays = Math.min(90, Math.max(7, Number(searchParams.get("growthDays") || 30)));

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["storage.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportStorageCsv({ search });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="storage-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/storage export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  try {
    const data = await getStorageDashboard({ search, page, pageSize, growthDays });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[master-admin/storage]", error);
    // Still try to surface live Hostinger/VPS disk so the page is not blank.
    try {
      const live = await getHostingerVpsLiveMetrics({ force: true });
      const usedTb = liveBytesToTb(live.diskUsedBytes);
      const totalTb =
        live.diskTotalBytes > 0 ? liveBytesToTb(live.diskTotalBytes) : PLATFORM_STORAGE_TB;
      const freeTb = Math.max(totalTb - usedTb, 0);
      const usedPct = totalTb > 0 ? Math.min(100, Math.round((usedTb / totalTb) * 1000) / 10) : 0;
      const bandwidthLimitTb =
        live.bandwidthLimitBytes != null && live.bandwidthLimitBytes > 0
          ? liveBytesToTb(live.bandwidthLimitBytes)
          : PLATFORM_BANDWIDTH_TB;
      const bandwidthUsedTb =
        live.bandwidthUsedBytes != null ? liveBytesToTb(live.bandwidthUsedBytes) : 0;
      return NextResponse.json({
        items: [],
        pagination: paginationMeta(0, 1, pageSize),
        summary: {
          totalStorageTb: totalTb,
          usedStorageTb: usedTb,
          freeStorageTb: freeTb,
          usedPct,
          freePct: Math.max(0, Math.round((100 - usedPct) * 10) / 10),
          bandwidthUsedTb,
          bandwidthLimitTb,
          bandwidthPct:
            bandwidthLimitTb > 0
              ? Math.min(100, Math.round((bandwidthUsedTb / bandwidthLimitTb) * 1000) / 10)
              : 0,
          totalUsedMB: Math.round(live.diskUsedBytes / (1024 * 1024)),
          totalBandwidthMB: Math.round(bandwidthUsedTb * 1024 * 1024),
          warnings: 0,
          critical: 0,
          customerCount: 0,
          storageTrend: `Live Hostinger disk · ${live.source}`,
          bandwidthTrend: "Partial load — customer table failed",
          growthDays,
          liveSource: live.source,
          liveHostname: live.hostname,
          liveVmId: live.vmId,
          livePlan: live.plan,
          liveSampledAt: live.sampledAt,
          liveNotes: live.notes,
        },
        hostinger: live,
        analytics: {
          storageGrowth: [],
          fileTypeBreakdown: [],
          usedVsFree: { usedTb, freeTb, totalTb },
          scanMeta: { scannedCustomers: 0, scannedFiles: 0 },
        },
        topUsers: [],
        largestFiles: [],
        storageByPlan: [],
        recentActivities: [],
        error: "Customer storage table failed; showing live Hostinger/VPS disk.",
      });
    } catch {
      /* fall through */
    }
    return NextResponse.json({
      items: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: {
        totalStorageTb: PLATFORM_STORAGE_TB,
        usedStorageTb: 0,
        freeStorageTb: PLATFORM_STORAGE_TB,
        usedPct: 0,
        freePct: 100,
        bandwidthUsedTb: 0,
        bandwidthLimitTb: PLATFORM_BANDWIDTH_TB,
        bandwidthPct: 0,
        totalUsedMB: 0,
        totalBandwidthMB: 0,
        warnings: 0,
        critical: 0,
        customerCount: 0,
        storageTrend: "No data",
        bandwidthTrend: "No data",
        growthDays,
      },
      analytics: {
        storageGrowth: [],
        fileTypeBreakdown: [],
        usedVsFree: { usedTb: 0, freeTb: 10, totalTb: 10 },
        scanMeta: { scannedCustomers: 0, scannedFiles: 0 },
      },
      topUsers: [],
      largestFiles: [],
      storageByPlan: [],
      recentActivities: [],
      error: "Unable to load storage data",
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("storage.cleanup");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureAppSchema();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "") as "cleanup" | "scan_orphans" | "delete_orphans";
  const dryRun = Boolean(body.dryRun);
  const orphanPaths = Array.isArray(body.orphanPaths)
    ? body.orphanPaths.filter((p: unknown) => typeof p === "string")
    : undefined;

  if (!["cleanup", "scan_orphans", "delete_orphans"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const payload = await runStorageAction({
      action,
      dryRun,
      orphanPaths,
      adminId: admin.id,
    });
    await logAdminAudit(admin, `storage.${action}`, "storage", null, { dryRun });
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[master-admin/storage POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Storage action failed" },
      { status: 500 },
    );
  }
}
