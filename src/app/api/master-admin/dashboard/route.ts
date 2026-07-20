import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getMasterAdminDashboardData } from "@/lib/master-admin/dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("analytics.read");
  if (auth instanceof NextResponse) return auth;

  const data = await getMasterAdminDashboardData();
  return NextResponse.json(data);
}
