import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  archivePlatformRelease,
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
        { error: "Confirmation required to archive a release.", code: "confirmation_required" },
        { status: 400 },
      );
    }

    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const beforeSafety = await snapshotProductSafetyCounts();
    const release = await archivePlatformRelease(id);
    const afterSafety = await snapshotProductSafetyCounts();

    await logAdminAudit(admin, "ar360.release.archived", "ar360_platform_release", String(id), {
      version: release.version,
      channel: release.channel,
      status: release.status,
      beforeSafety,
      afterSafety,
    });

    return NextResponse.json({ release, beforeSafety, afterSafety });
  } catch (error) {
    if (error instanceof ReleaseManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/releases/:id/archive]", error);
    return NextResponse.json({ error: "Unable to archive release" }, { status: 500 });
  }
}
