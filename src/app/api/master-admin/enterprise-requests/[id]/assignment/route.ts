import { NextRequest, NextResponse } from "next/server";
import {
  assignEnterpriseSalesRequest,
  getEnterpriseSalesRequest,
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
  const assignedAdminId =
    body.assignedAdminId === null || body.assignedAdminId === ""
      ? null
      : Number(body.assignedAdminId);
  if (assignedAdminId !== null && (!Number.isSafeInteger(assignedAdminId) || assignedAdminId <= 0)) {
    return NextResponse.json({ error: "A valid assignee is required" }, { status: 400 });
  }

  try {
    const existing = await getEnterpriseSalesRequest(id);
    if (!existing) return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    await assignEnterpriseSalesRequest(id, assignedAdminId, auth.admin.id);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_request.assigned",
      entityType: "enterprise_request",
      entityId: id,
      metadata: { from: existing.assignedAdminId, to: assignedAdminId },
    });
    return NextResponse.json({ ok: true, request: await getEnterpriseSalesRequest(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Assignment failed" },
      { status: 400 },
    );
  }
}
