import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  capturePointerSnapshot,
  recordMaterialRollbackChange,
} from "@/lib/platform-versioning/activation-safety.service";
import {
  previewMaterialRollback,
  rollbackMaterialRevision,
  validateMaterialRollbackTarget,
} from "@/lib/platform-versioning/material-rollback.service";
import { getRevisionById } from "@/lib/platform-versioning/component-revisions.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ targetId: string }> };

/** GET — isolated ROLLBACK PREVIEW (no pointer mutation). */
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

    const validation = await validateMaterialRollbackTarget({
      productId,
      targetRevisionId: targetId,
    });
    if (validation.ok !== true) {
      return NextResponse.json(
        { error: validation.message, code: validation.code },
        { status: 400 },
      );
    }

    const preview = await previewMaterialRollback({ productId, targetRevisionId: targetId });
    if (!preview) {
      return NextResponse.json({ error: "Unable to build rollback preview" }, { status: 500 });
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
      unchanged: ["geometry", "lighting", "viewer", "ar", "config"],
      warning: "Preview only. active_material_revision_id is NOT changed.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/material-rollback/:targetId GET]", error);
    return NextResponse.json({ error: "Unable to preview rollback" }, { status: 500 });
  }
}

/**
 * POST — execute material-only rollback.
 * Body: { productId, confirm: true, reason? }
 */
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
            "Confirmation required. Rollback changes ONLY active_material_revision_id for this product.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const validation = await validateMaterialRollbackTarget({
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

    const result = await rollbackMaterialRevision({
      productId,
      targetRevisionId: targetId,
      adminId: admin.id,
      reason,
    });

    const changeRecordId = snapshotBefore
      ? await recordMaterialRollbackChange({
          productId,
          fromRevisionId: result.fromRevisionId,
          toRevisionId: result.toRevisionId,
          snapshotBefore,
          adminId: admin.id,
          reason,
        })
      : null;

    await logAdminAudit(admin, "ar360.revision.rollback", "ar360_component_revision", String(targetId), {
      productId,
      component: "material",
      fromRevisionId: result.fromRevisionId,
      toRevisionId: result.toRevisionId,
      reason: reason || null,
      changeRecordId,
      status: "ROLLED_BACK",
      unchangedPointers: {
        geometry: result.pointers.geometry,
        lighting: result.pointers.lighting,
        viewer: result.pointers.viewer,
        ar: result.pointers.ar,
        config: result.pointers.config,
      },
    });

    const targetRow = await getRevisionById(targetId);

    return NextResponse.json({
      ok: true,
      status: "ROLLED_BACK",
      changeRecordId,
      from: result.from,
      to: result.to,
      pointers: result.pointers,
      targetStatus: targetRow?.status ?? null,
      warning:
        "Material pointer rolled back for this product only. Geometry/Lighting/Viewer/AR/Config unchanged. Legacy material_settings not modified. Runtime remains LEGACY unless canary is enabled.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to rollback material";
    console.error("[master-admin/ar360/material-rollback/:targetId POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
