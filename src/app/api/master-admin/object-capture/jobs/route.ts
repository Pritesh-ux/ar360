import { NextRequest, NextResponse } from "next/server";
import { listAdminCaptureJobs, type AdminCaptureFilters } from "@/lib/master-admin/object-capture.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filters(params: URLSearchParams): AdminCaptureFilters {
  return {
    search: params.get("search") || undefined, status: params.get("status") || undefined,
    reviewStatus: params.get("reviewStatus") || undefined, assignee: params.get("assignee") || undefined,
    priority: params.get("priority") || undefined, dateFrom: params.get("dateFrom") || undefined,
    dateTo: params.get("dateTo") || undefined, page: Number(params.get("page") || 1),
    pageSize: Number(params.get("pageSize") || 20),
  };
}
const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  const auth = await guardAdminPermission("object_capture.read", { request });
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("export") === "csv") {
      const download = await guardAdminPermission(["object_capture.read", "object_capture.download"], { request, requireAll: true });
      if (download instanceof NextResponse) return download;
      const first = await listAdminCaptureJobs({ ...filters(params), page: 1, pageSize: 100 });
      const jobs = [...first.jobs];
      for (let page = 2; page <= first.pagination.totalPages; page++) {
        jobs.push(...(await listAdminCaptureJobs({ ...filters(params), page, pageSize: 100 })).jobs);
      }
      const csv = [
        ["Job ID","Customer","Customer ID","Status","Review","Priority","Assignee","Progress","Photos","Product","Created"],
        ...jobs.map((job) => [job.id,job.customerName,job.customerUid,job.status,job.reviewStatus,job.priority,job.assignedAdminName,job.progress,job.photoCount,job.productId,job.createdAt]),
      ].map((row) => row.map(cell).join(",")).join("\r\n");
      await writeMasterAdminAudit({ adminId: auth.admin.id, action: "object_capture.export", entityType: "object_capture_job", metadata: { count: jobs.length } });
      return new NextResponse(`\uFEFF${csv}`, { headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="object-capture-${new Date().toISOString().slice(0, 10)}.csv"`,
      }});
    }
    return NextResponse.json(await listAdminCaptureJobs(filters(params)));
  } catch (error) {
    console.error("[master-admin/object-capture/jobs]", error);
    return NextResponse.json({ error: "Unable to load capture queue" }, { status: 500 });
  }
}
