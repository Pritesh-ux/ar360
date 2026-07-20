import { NextRequest, NextResponse } from "next/server";
import {
  changeEnterpriseCustomPlanAvailability,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  getReusableEnterpriseCustomPlans,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, planId } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
  }
  try {
    if (!(await getEnterpriseSalesRequest(id))) {
      return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    }
    await changeEnterpriseCustomPlanAvailability(planId, body.isActive);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_custom_plan.availability_changed",
      entityType: "enterprise_custom_plan",
      entityId: planId,
      metadata: { requestUid: id, isActive: body.isActive },
    });
    return NextResponse.json({
      ok: true,
      customPlans: await getReusableEnterpriseCustomPlans(),
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Custom plan update failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
