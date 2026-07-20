import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getSystemHealthSnapshot } from "@/lib/master-admin/system-health.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("analytics.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const snapshot = await getSystemHealthSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[master-admin/system-health]", error);
    return NextResponse.json({ error: "Unable to load system health" }, { status: 500 });
  }
}
