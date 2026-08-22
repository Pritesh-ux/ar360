import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  activateStableRelease,
  type StableReadinessResult,
} from "@/lib/platform-versioning/stable-governance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const confirm = Boolean(body.confirm);
    if (!confirm) {
      return NextResponse.json(
        {
          error: "Confirmation required. Stable activation does not migrate products.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const result = await activateStableRelease({
      releaseId: id,
      adminId: admin.id,
      confirm: true,
    });

    await logAdminAudit(
      admin,
      "ar360.release.stable_activated",
      "ar360_platform_release",
      String(id),
      {
        releaseId: id,
        version: result.release.version,
        previousStableReleaseId: result.previousStableReleaseId,
        readinessOverall: result.readiness.overall,
        health: result.health.status,
        productPointersUnchanged: true,
        confirmation: true,
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to activate stable";
    const readiness = (error as Error & { readiness?: StableReadinessResult }).readiness;
    await logAdminAudit(
      admin,
      "ar360.release.stable_activation_blocked",
      "ar360_platform_release",
      String((await context.params).id),
      { reason: message, readinessOverall: readiness?.overall ?? null },
    );
    console.error("[master-admin/ar360/releases/:id/stable-activate]", error);
    return NextResponse.json(
      { error: message, readiness: readiness ?? undefined },
      { status: 400 },
    );
  }
}
