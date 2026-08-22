import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  capturePointerSnapshot,
  recordViewerRollbackChange,
} from "@/lib/platform-versioning/activation-safety.service";
import {
  previewViewerRollback,
  rollbackViewerRevision,
  validateViewerRollbackTarget,
} from "@/lib/platform-versioning/viewer-rollback.service";
import { getRevisionById } from "@/lib/platform-versioning/component-revisions.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ targetId: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { targetId: raw } = await context.params;
    const targetId = Number(raw);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target revision id" }, { status: 400 });
    }
    const productId = (new URL(req.url).searchParams.get("productId") || "").trim();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const validation = await validateViewerRollbackTarget({
      productId,
      targetRevisionId: targetId,
    });
    if (validation.ok !== true) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
        { status: 400 },
      );
    }

    const before = await capturePointerSnapshot(productId);
    const preview = await previewViewerRollback({ productId, targetRevisionId: targetId });
    if (!preview) {
      return NextResponse.json({ error: "Unable to build viewer rollback preview" }, { status: 500 });
    }
    const after = await capturePointerSnapshot(productId);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      return NextResponse.json(
        { error: "Preview mutated pointers — aborted", code: "PREVIEW_MUTATION_DETECTED" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...preview,
      current: {
        id: Number(validation.current.id),
        kind: validation.current.component_kind,
        status: validation.current.status,
        componentRevisionNumber: validation.current.component_revision_number,
      },
      target: {
        id: Number(validation.target.id),
        kind: validation.target.component_kind,
        status: validation.target.status,
        componentRevisionNumber: validation.target.component_revision_number,
      },
      warning:
        "VIEWER ROLLBACK PREVIEW only. active_viewer_revision_id is NOT changed. Geometry/Material/Lighting/AR/Config unchanged.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/viewer-rollback/:targetId GET]", error);
    return NextResponse.json({ error: "Unable to preview viewer rollback" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { targetId: raw } = await context.params;
    const targetId = Number(raw);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return NextResponse.json({ error: "Invalid target revision id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const productId = String(body.productId || "").trim();
    const confirm = Boolean(body.confirm);
    const reason = body.reason != null ? String(body.reason).slice(0, 255) : undefined;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!confirm) {
      return NextResponse.json(
        {
          error:
            "Confirmation required. This rollback changes ONLY Viewer. It does NOT change Geometry, Material, Lighting, AR, or Config.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const validation = await validateViewerRollbackTarget({
      productId,
      targetRevisionId: targetId,
    });
    if (validation.ok !== true) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
        { status: 400 },
      );
    }

    const snapshotBefore = await capturePointerSnapshot(productId);
    const result = await rollbackViewerRevision({
      productId,
      targetRevisionId: targetId,
      adminId: admin.id,
      reason,
    });

    const healthPayload = {
      ok: result.health.ok,
      checks: result.health.checks,
      materialSettingsType: "object",
      variantsIsArray: true,
      fallbackAvailable: true,
    };

    const changeRecordId = snapshotBefore
      ? await recordViewerRollbackChange({
          productId,
          fromRevisionId: result.fromRevisionId,
          toRevisionId: result.toRevisionId,
          snapshotBefore,
          adminId: admin.id,
          reason,
          health: healthPayload,
        })
      : null;

    await logAdminAudit(admin, "ar360.revision.rollback", "ar360_component_revision", String(targetId), {
      productId,
      component: "viewer",
      fromRevisionId: result.fromRevisionId,
      toRevisionId: result.toRevisionId,
      reason: reason || null,
      changeRecordId,
      status: result.health.ok ? "ROLLED_BACK" : "UNHEALTHY",
      health: result.health,
      unchangedPointers: {
        geometry: result.pointers.geometry,
        material: result.pointers.material,
        lighting: result.pointers.lighting,
        ar: result.pointers.ar,
        config: result.pointers.config,
      },
    });

    if (!result.health.ok) {
      await logAdminAudit(admin, "ar360.revision.unhealthy", "ar360_component_revision", String(targetId), {
        productId,
        component: "viewer",
        changeRecordId,
        health: result.health,
        note: "No automatic rollback. Manual recovery available.",
      });
    }

    const targetRow = await getRevisionById(targetId);
    return NextResponse.json({
      ok: true,
      status: result.health.ok ? "ROLLED_BACK" : "UNHEALTHY",
      changeRecordId,
      from: result.from,
      to: result.to,
      pointers: result.pointers,
      health: result.health,
      targetStatus: targetRow?.status ?? null,
      warning: result.health.ok
        ? "Viewer pointer rolled back for this product only. Geometry/Material/Lighting/AR/Config unchanged. Legacy viewer settings not modified."
        : "Viewer rolled back but health check failed (UNHEALTHY). No automatic recovery.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rollback viewer";
    console.error("[master-admin/ar360/viewer-rollback/:targetId POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
