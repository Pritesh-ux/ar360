import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listReleaseChannels } from "@/lib/platform-versioning/releases.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const rows = await listReleaseChannels();
    return NextResponse.json({
      channels: rows.map((c) => ({
        id: Number(c.id),
        code: c.code,
        displayName: c.display_name,
        isDefault: Boolean(c.is_default),
        isCustomerFacing: Boolean(c.is_customer_facing),
      })),
    });
  } catch (error) {
    console.error("[master-admin/ar360/channels GET]", error);
    return NextResponse.json({ error: "Unable to load channels" }, { status: 500 });
  }
}
