import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listChangeHistory } from "@/lib/platform-versioning/activation-safety.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const productId = String(req.nextUrl.searchParams.get("productId") || "").trim();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
    const history = await listChangeHistory(productId, limit);
    return NextResponse.json({
      productId,
      history,
      statuses: ["READY", "PREVIEW", "CANARY", "ACTIVE", "UNHEALTHY", "ROLLED_BACK", "BLOCKED"],
    });
  } catch (error) {
    console.error("[master-admin/ar360/change-history GET]", error);
    return NextResponse.json({ error: "Unable to load change history" }, { status: 500 });
  }
}
