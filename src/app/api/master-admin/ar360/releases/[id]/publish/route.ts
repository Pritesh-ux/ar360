import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  publishPlatformRelease,
  ReleaseManagerError,
  snapshotProductSafetyCounts,
} from "@/lib/platform-versioning/releases.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.confirm) {
      return NextResponse.json(
        {
          error:
            "Confirmation required. Publishing creates a release record only and does NOT migrate customer products.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const beforeSafety = await snapshotProductSafetyCounts();
    const result = await publishPlatformRelease(id);
    const afterSafety = await snapshotProductSafetyCounts();

    const safetyUnchanged =
      beforeSafety.products === afterSafety.products &&
      beforeSafety.productsWithActivePointer === afterSafety.productsWithActivePointer &&
      beforeSafety.qr === afterSafety.qr &&
      beforeSafety.subscriptions === afterSafety.subscriptions;

    await logAdminAudit(admin, "ar360.release.published", "ar360_platform_release", String(id), {
      version: result.release.version,
      channel: result.release.channel,
      status: result.release.status,
      productPointersUnchanged: true,
      safetyUnchanged,
      beforeSafety,
      afterSafety,
      warning: result.warning,
    });

    return NextResponse.json({
      release: result.release,
      warning: result.warning,
      productPointersUnchanged: true,
      safetyUnchanged,
      beforeSafety,
      afterSafety,
    });
  } catch (error) {
    if (error instanceof ReleaseManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/releases/:id/publish]", error);
    return NextResponse.json({ error: "Unable to publish release" }, { status: 500 });
  }
}
