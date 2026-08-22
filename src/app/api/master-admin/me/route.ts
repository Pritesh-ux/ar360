import { NextResponse } from "next/server";
import {
  clearAdminPermissionCache,
  getCurrentMasterAdminWithPermissions,
} from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  clearAdminPermissionCache();
  const admin = await getCurrentMasterAdminWithPermissions();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    admin: {
      id: admin.id,
      adminUid: admin.adminUid,
      name: admin.name,
      email: admin.email,
      roleCode: admin.roleCode ?? "unassigned",
      permissions: admin.permissions ?? [],
    },
  });
}
