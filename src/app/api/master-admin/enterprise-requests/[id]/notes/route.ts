import { NextRequest, NextResponse } from "next/server";
import {
  addEnterpriseInternalNote,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (!(await getEnterpriseSalesRequest(id))) {
      return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    }
    const noteUid = await addEnterpriseInternalNote(id, String(body.note || ""), auth.admin.id);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_request.note_added",
      entityType: "enterprise_request",
      entityId: id,
      metadata: { noteUid },
    });
    return NextResponse.json(
      { ok: true, request: await getEnterpriseSalesRequest(id) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add note";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
