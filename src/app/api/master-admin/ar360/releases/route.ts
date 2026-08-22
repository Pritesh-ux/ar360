import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  createPlatformRelease,
  listPlatformReleases,
  ReleaseManagerError,
} from "@/lib/platform-versioning/releases.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const releases = await listPlatformReleases({
      channel: searchParams.get("channel") || undefined,
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json({ releases });
  } catch (error) {
    if (error instanceof ReleaseManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/releases GET]", error);
    return NextResponse.json({ error: "Unable to load releases" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const release = await createPlatformRelease({
      version: body.version,
      channel: body.channel,
      title: body.title,
      releaseNotes: body.releaseNotes ?? body.release_notes,
      createdByAdminId: Number(admin.id),
      createdByName: String(admin.name || admin.email || "Master Admin"),
    });

    await logAdminAudit(admin, "ar360.release.created", "ar360_platform_release", String(release.id), {
      version: release.version,
      channel: release.channel,
      status: release.status,
      title: release.title,
    });

    return NextResponse.json({ release }, { status: 201 });
  } catch (error) {
    if (error instanceof ReleaseManagerError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/releases POST]", error);
    return NextResponse.json({ error: "Unable to create release" }, { status: 500 });
  }
}
