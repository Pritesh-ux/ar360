import { NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { listCustomerVisibleReleases } from "@/lib/platform-versioning/customer-platform-update.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const releases = await listCustomerVisibleReleases(user.customerUid);
    return NextResponse.json({ success: true, releases });
  } catch (error) {
    console.error("[account/platform/releases GET]", error);
    return NextResponse.json({ error: "Unable to load releases" }, { status: 500 });
  }
}
