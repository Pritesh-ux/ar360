import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listClientUpdateStates } from "@/lib/platform-versioning/client-update-policy.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await listClientUpdateStates(500);
    return NextResponse.json({
      ...result,
      note: "Phase 8 client update policy. AUTO is not executable. Migration remains Phase 7 only.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/client-updates GET]", error);
    return NextResponse.json({ error: "Unable to list client update states" }, { status: 500 });
  }
}
