import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getStableGovernanceStatus } from "@/lib/platform-versioning/stable-governance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const status = await getStableGovernanceStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[master-admin/ar360/stable GET]", error);
    return NextResponse.json({ error: "Unable to load stable governance status" }, { status: 500 });
  }
}
