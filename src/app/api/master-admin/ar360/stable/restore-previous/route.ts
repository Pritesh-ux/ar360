import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  restorePreviousStable,
  type StableReadinessResult,
} from "@/lib/platform-versioning/stable-governance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const confirm = Boolean(body.confirm);
    if (!confirm) {
      return NextResponse.json(
        { error: "Confirmation required", code: "confirmation_required" },
        { status: 400 },
      );
    }

    const result = await restorePreviousStable({
      adminId: admin.id,
      confirm: true,
    });

    await logAdminAudit(
      admin,
      "ar360.release.stable_activated",
      "ar360_active_stable_release_id",
      result.restoredReleaseId != null ? String(result.restoredReleaseId) : "empty",
      {
        action: "restore_previous",
        previousBeforeRestore: result.previousBeforeRestore,
        restoredReleaseId: result.restoredReleaseId,
        health: result.health.status,
        productPointersUnchanged: true,
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to restore previous stable";
    const readiness = (error as Error & { readiness?: StableReadinessResult }).readiness;
    if (readiness) {
      await logAdminAudit(
        admin,
        "ar360.release.stable_activation_blocked",
        "ar360_active_stable_release_id",
        "restore_previous",
        { reason: message, readinessOverall: readiness.overall },
      );
    }
    console.error("[master-admin/ar360/stable/restore-previous]", error);
    return NextResponse.json(
      { error: message, readiness: readiness ?? undefined },
      { status: 400 },
    );
  }
}
