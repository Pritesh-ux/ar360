import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listViewerRollbackTargets } from "@/lib/platform-versioning/viewer-rollback.service";

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
    const result = await listViewerRollbackTargets(productId);
    return NextResponse.json({
      ...result,
      note: "Phase 6D viewer-only rollback. Does not change AR or other pointers.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/viewer-rollback GET]", error);
    return NextResponse.json({ error: "Unable to list viewer rollback targets" }, { status: 500 });
  }
}
