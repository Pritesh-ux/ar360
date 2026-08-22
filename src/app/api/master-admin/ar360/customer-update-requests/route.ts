import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listAllCustomerUpdateRequests } from "@/lib/platform-versioning/customer-update-request.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const requests = await listAllCustomerUpdateRequests(200);
    return NextResponse.json({
      success: true,
      requests,
      note: "Customer approval gateway only. Execution remains Phase 9 Customer Rollouts. No AUTO / Force Update.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/customer-update-requests GET]", error);
    return NextResponse.json({ error: "Unable to load requests" }, { status: 500 });
  }
}
