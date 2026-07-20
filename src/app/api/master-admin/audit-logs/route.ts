import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  exportAuditLogsCsv,
  listAuditLogs,
  type AuditLogFilters,
} from "@/lib/master-admin/audit-logs.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): AuditLogFilters {
  return {
    search: (searchParams.get("search") || "").trim(),
    action: (searchParams.get("action") || "all").trim(),
    entityType: (searchParams.get("entityType") || "all").trim(),
    adminId: (searchParams.get("adminId") || "all").trim(),
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("audit.read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 15)));

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["audit.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportAuditLogsCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/audit-logs export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  try {
    const data = await listAuditLogs({ ...filters, page, pageSize });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[master-admin/audit-logs]", error);
    return NextResponse.json({
      logs: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: { total: 0, uniqueAdmins: 0, today: 0, last7Days: 0 },
      actionBreakdown: [],
      entityBreakdown: [],
      error: "Unable to load audit logs",
    });
  }
}
