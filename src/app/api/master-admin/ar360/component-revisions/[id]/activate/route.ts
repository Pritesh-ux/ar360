import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { activateWithSafety } from "@/lib/platform-versioning/activation-safety.service";
import { getRevisionById } from "@/lib/platform-versioning/component-revisions.service";

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
      return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const confirm = Boolean(body.confirm);
    if (!confirm) {
      return NextResponse.json(
        {
          error:
            "Confirmation required. Activating updates only this product's component pointer.",
          code: "confirmation_required",
        },
        { status: 400 },
      );
    }

    const row = await getRevisionById(id);
    if (!row) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

    await logAdminAudit(
      admin,
      "ar360.revision.activation_started",
      "ar360_component_revision",
      String(id),
      {
        productId: row.product_uid,
        kind: row.component_kind,
      },
    );

    const result = await activateWithSafety({
      productId: row.product_uid,
      revisionId: id,
      adminId: admin.id,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 512) : undefined,
      forceUnhealthy: Boolean(body.forceUnhealthy) && process.env.NODE_ENV !== "production",
    });

    if (result.ok === false) {
      await logAdminAudit(
        admin,
        "ar360.revision.activation_blocked",
        "ar360_component_revision",
        String(id),
        {
          productId: row.product_uid,
          code: result.code,
          message: result.message,
          changeRecordId: result.changeRecordId,
          details: result.details ?? null,
        },
      );
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          changeRecordId: result.changeRecordId,
          details: result.details ?? null,
        },
        { status: 400 },
      );
    }

    await logAdminAudit(admin, "ar360.revision.activated", "ar360_component_revision", String(id), {
      productId: row.product_uid,
      kind: row.component_kind,
      oldRevisionId: result.activated.previousPointerId,
      newRevisionId: result.activated.activated.id,
      pointerColumn: result.activated.pointerColumn,
      changeRecordId: result.changeRecordId,
      status: result.status,
      snapshot: result.snapshot,
    });

    await logAdminAudit(
      admin,
      "ar360.revision.health_checked",
      "ar360_component_revision",
      String(id),
      {
        productId: row.product_uid,
        changeRecordId: result.changeRecordId,
        healthOk: result.health.ok,
        checks: result.health.checks,
      },
    );

    if (result.status === "UNHEALTHY") {
      await logAdminAudit(
        admin,
        "ar360.revision.unhealthy",
        "ar360_component_revision",
        String(id),
        {
          productId: row.product_uid,
          changeRecordId: result.changeRecordId,
          health: result.health,
          note: "No automatic rollback. Use material rollback where applicable.",
        },
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      changeRecordId: result.changeRecordId,
      activated: result.activated.activated,
      previousPointerId: result.activated.previousPointerId,
      pointerColumn: result.activated.pointerColumn,
      snapshot: result.snapshot,
      health: result.health,
      rollbackAvailable: row.component_kind === "material",
      warning:
        result.status === "UNHEALTHY"
          ? "Activation completed but health check failed. Status UNHEALTHY. No automatic rollback. Use material rollback if applicable."
          : "Component pointer updated for this product only. Legacy product settings columns were not modified. Runtime remains LEGACY unless canary is enabled separately.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to activate revision";
    console.error("[master-admin/ar360/component-revisions/:id/activate POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
