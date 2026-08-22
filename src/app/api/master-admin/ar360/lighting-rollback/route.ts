import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listLightingRollbackTargets } from "@/lib/platform-versioning/lighting-rollback.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?productId= — eligible lighting rollback targets (lighting-only). */
export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const productId = (new URL(req.url).searchParams.get("productId") || "").trim();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await listLightingRollbackTargets(productId);
    return NextResponse.json({
      ...result,
      note: "Phase 6C lighting-only rollback. Drafts and incompatible revisions are not eligible.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/lighting-rollback GET]", error);
    return NextResponse.json({ error: "Unable to list lighting rollback targets" }, { status: 500 });
  }
}
