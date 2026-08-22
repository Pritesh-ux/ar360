import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  getPlatformReleaseById,
  ReleaseManagerError,
  updateDraftPlatformRelease,
} from "@/lib/platform-versioning/releases.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }
    const release = await getPlatformReleaseById(id);
    if (!release) return NextResponse.json({ error: "Release not found" }, { status: 404 });
    return NextResponse.json({ release });
  } catch (error) {
    console.error("[master-admin/ar360/releases/:id GET]", error);
    return NextResponse.json({ error: "Unable to load release" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }
    const before = await getPlatformReleaseById(id);
    if (!before) return NextResponse.json({ error: "Release not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const release = await updateDraftPlatformRelease(id, {
      title: body.title,
      releaseNotes: body.releaseNotes ?? body.release_notes,
      channel: body.channel,
    });

    await logAdminAudit(admin, "ar360.release.updated", "ar360_platform_release", String(release.id), {
      before: {
        title: before.title,
        channel: before.channel,
        releaseNotes: before.releaseNotes,
      },
      after: {
        title: release.title,
        channel: release.channel,
        releaseNotes: release.releaseNotes,
      },
    });

    return NextResponse.json({ release });
  } catch (error) {
    if (error instanceof ReleaseManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/releases/:id PATCH]", error);
    return NextResponse.json({ error: "Unable to update release" }, { status: 500 });
  }
}
