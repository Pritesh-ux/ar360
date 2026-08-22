import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { updateMasterAdmin } from "@/lib/master-admin/admins.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await guardAdminPermission("admins.manage");
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const adminId = Number(id);
  if (!adminId) return NextResponse.json({ error: "Invalid admin id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  try {
    const status = body.status === "Active" || body.status === "Disabled" ? body.status : undefined;
    const roleId = body.roleId === null || body.roleId === undefined
      ? undefined
      : Number(body.roleId);

    await updateMasterAdmin({
      adminId,
      actorAdminId: auth.admin.id,
      status,
      roleId,
    });

    await logAdminAudit(auth.admin, "admin.update", "master_admin", String(adminId), { status, roleId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
