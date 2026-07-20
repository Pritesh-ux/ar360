import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  exportActivityLogsCsv,
  listActivityLogs,
  type ActivityLogFilters,
} from "@/lib/master-admin/activity-logs.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): ActivityLogFilters {
  return {
    search: (searchParams.get("search") || "").trim(),
    type: (searchParams.get("type") || "all").trim(),
    status: (searchParams.get("status") || "all").trim(),
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("audit.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 15)));

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["audit.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportActivityLogsCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activity-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/activity-logs export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  try {
    const data = await listActivityLogs({ ...filters, page, pageSize });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[master-admin/activity-logs]", error);
    return NextResponse.json({
      logs: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: { total: 0, productCount: 0, paymentCount: 0, failedCount: 0, today: 0 },
      error: "Unable to load activity logs",
    });
  }
}
