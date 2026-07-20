import { NextRequest, NextResponse } from "next/server";
import {
  changeEnterpriseRequestStatus,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  isEnterpriseStatus,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "";
  if (!isEnterpriseStatus(status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    const existing = await getEnterpriseSalesRequest(id);
    if (!existing) return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    await changeEnterpriseRequestStatus(id, status, auth.admin.id);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_request.status_changed",
      entityType: "enterprise_request",
      entityId: id,
      metadata: { from: existing.status, to: status },
    });
    return NextResponse.json({ ok: true, request: await getEnterpriseSalesRequest(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status update failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
