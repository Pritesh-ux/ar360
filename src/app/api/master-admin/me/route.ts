import { NextRequest, NextResponse } from "next/server";
import { getCurrentMasterAdminWithPermissions } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("ar360_master_admin_session")?.value;
  const admin = await getCurrentMasterAdminWithPermissions(token);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    admin: {
      id: admin.id,
      adminUid: admin.adminUid,
      name: admin.name,
      email: admin.email,
      roleCode: admin.roleCode ?? "super_admin",
      permissions: admin.permissions ?? [],
    },
  });
}
