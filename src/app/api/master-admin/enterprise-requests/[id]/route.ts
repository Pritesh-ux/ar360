import { NextRequest, NextResponse } from "next/server";
import { getEnterpriseRequestFilterOptions, getEnterpriseSalesRequest, getReusableEnterpriseCustomPlans } from "@/lib/enterprise-sales";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.read", { request });
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const [enterpriseRequest, filterOptions, customPlans] = await Promise.all([
      getEnterpriseSalesRequest(id),
      getEnterpriseRequestFilterOptions(),
      getReusableEnterpriseCustomPlans(),
    ]);
    if (!enterpriseRequest) {
      return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    }
    return NextResponse.json({
      request: enterpriseRequest,
      assignees: filterOptions.assignees,
      customPlans,
      canManage:
        auth.roleCode === "super_admin" ||
        auth.permissions.has("enterprise_requests.manage"),
    });
  } catch (error) {
    console.error("[master-admin/enterprise-requests/detail]", error);
    return NextResponse.json({ error: "Unable to load Enterprise request" }, { status: 500 });
  }
}
