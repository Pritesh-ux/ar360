import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { dismissPlatformReleaseBanner } from "@/lib/platform-versioning/customer-platform-update.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Convenience alias for POST view action — Spec suggested POST .../view */
export async function POST(_req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    // Re-export through main release route logic by importing mark
    const { markPlatformReleaseViewed } = await import(
      "@/lib/platform-versioning/customer-platform-update.service"
    );
    const { writeCustomerActivity } = await import("@/lib/account/activity.service");
    const state = await markPlatformReleaseViewed({
      customerUid: user.customerUid,
      releaseId: id,
    });
    await writeCustomerActivity({
      customerUid: user.customerUid,
      userId: user.id,
      eventType: "ar360.platform_release.viewed",
      title: "Platform release viewed",
      detail: `Release #${id}`,
      meta: { releaseId: id, informational: true, migratesProducts: false },
    }).catch(() => undefined);
    return NextResponse.json({ success: true, viewState: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark viewed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    const body = await req.json().catch(() => ({}));
    if (body.dismiss) {
      await dismissPlatformReleaseBanner({
        customerUid: user.customerUid,
        releaseId: id,
      });
      return NextResponse.json({ success: true, dismissed: true });
    }
    return NextResponse.json({ error: "Unknown patch" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dismiss";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
