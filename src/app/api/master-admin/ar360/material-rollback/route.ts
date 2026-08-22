import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listMaterialRollbackTargets } from "@/lib/platform-versioning/material-rollback.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?productId= — eligible material rollback targets (material-only). */
export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const productId = (new URL(req.url).searchParams.get("productId") || "").trim();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const result = await listMaterialRollbackTargets(productId);
    return NextResponse.json({
      ...result,
      note: "Phase 6A material-only rollback. Drafts and incompatible revisions are not eligible.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/material-rollback GET]", error);
    return NextResponse.json({ error: "Unable to list rollback targets" }, { status: 500 });
  }
}
