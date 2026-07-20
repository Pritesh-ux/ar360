import { NextRequest, NextResponse } from "next/server";
import {
  getEnterpriseRequestFilterOptions,
  isEnterpriseStatus,
  listEnterpriseSalesRequests,
  type EnterpriseRequest,
  type EnterpriseRequestListFilters,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filtersFrom(params: URLSearchParams): EnterpriseRequestListFilters {
  const status = params.get("status") || "";
  const assignee = params.get("assignee") || "";
  return {
    search: (params.get("search") || "").trim() || undefined,
    status: isEnterpriseStatus(status) ? status : undefined,
    country: (params.get("country") || "").trim() || undefined,
    industry: (params.get("industry") || "").trim() || undefined,
    assignedAdminId:
      assignee === "unassigned"
        ? null
        : /^\d+$/.test(assignee)
          ? Number(assignee)
          : undefined,
    createdFrom: params.get("dateFrom") || undefined,
    createdTo: params.get("dateTo") || undefined,
  };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(requests: EnterpriseRequest[]): string {
  const rows = requests.map((item) => [
    item.requestUid,
    item.companyName,
    item.contactName,
    item.businessEmail,
    item.country,
    item.industry,
    item.statusLabel,
    item.assignedAdminName || "Unassigned",
    item.createdAt,
  ]);
  return [
    ["Request ID", "Company", "Contact Person", "Email", "Country", "Industry", "Status", "Assignee", "Created Date"],
    ...rows,
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export async function GET(request: NextRequest) {
  const auth = await guardAdminPermission("enterprise_requests.read", { request });
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const filters = filtersFrom(searchParams);

  try {
    if (searchParams.get("export") === "csv") {
      const exportAuth = await guardAdminPermission(
        ["enterprise_requests.read", "exports.download"],
        { requireAll: true, request },
      );
      if (exportAuth instanceof NextResponse) return exportAuth;

      const first = await listEnterpriseSalesRequests({ ...filters, page: 1, pageSize: 100 });
      const requests = [...first.requests];
      for (let page = 2; page <= first.pagination.totalPages; page += 1) {
        const next = await listEnterpriseSalesRequests({ ...filters, page, pageSize: 100 });
        requests.push(...next.requests);
      }
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "enterprise_request.export",
        entityType: "enterprise_request",
        metadata: { count: requests.length },
      });
      return new NextResponse(`\uFEFF${toCsv(requests)}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="enterprise-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 20)));
    const [result, filterOptions] = await Promise.all([
      listEnterpriseSalesRequests({ ...filters, page, pageSize }),
      getEnterpriseRequestFilterOptions(),
    ]);
    return NextResponse.json({ ...result, filterOptions });
  } catch (error) {
    console.error("[master-admin/enterprise-requests]", error);
    return NextResponse.json({ error: "Unable to load Enterprise requests" }, { status: 500 });
  }
}
