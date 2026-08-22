import { NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { getCustomerUpdateCenter } from "@/lib/platform-versioning/customer-platform-update.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const center = await getCustomerUpdateCenter(user.customerUid);

    await writeCustomerActivity({
      customerUid: user.customerUid,
      userId: user.id,
      eventType: "ar360.platform_release.viewed",
      title: "AR360 platform status viewed",
      detail: `Platform ${center.currentVersion || "—"} · ${center.status}`,
      meta: {
        platformVersion: center.currentVersion || "",
        latestStable: center.latestStableVersion || "",
        status: center.status,
        informational: true,
        migratesProducts: false,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      ...center,
      // Phase 11 fields for backward compatibility
      platformVersion: center.latestStableVersion || center.currentVersion,
      platformReleaseId: center.latestStableReleaseId || center.currentReleaseId,
    });
  } catch (error) {
    console.error("[account/platform-status GET]", error);
    return NextResponse.json({ error: "Unable to load platform status" }, { status: 500 });
  }
}
