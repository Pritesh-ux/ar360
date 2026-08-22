import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getReleaseManagerSystemStatus } from "@/lib/platform-versioning/releases.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const status = await getReleaseManagerSystemStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[master-admin/ar360/system-status GET]", error);
    return NextResponse.json({ error: "Unable to load AR360 system status" }, { status: 500 });
  }
}
