import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listArRollbackTargets } from "@/lib/platform-versioning/ar-rollback.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const productId = (new URL(req.url).searchParams.get("productId") || "").trim();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    const result = await listArRollbackTargets(productId);
    return NextResponse.json({
      ...result,
      note: "Phase 6D AR-only rollback. Does not change Viewer or other pointers.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/ar-rollback GET]", error);
    return NextResponse.json({ error: "Unable to list AR rollback targets" }, { status: 500 });
  }
}
