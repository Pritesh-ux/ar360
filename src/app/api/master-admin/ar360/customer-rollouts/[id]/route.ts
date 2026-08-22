import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  cancelCustomerRollout,
  getCustomerRolloutDetail,
  pauseCustomerRollout,
  previewCustomerRollout,
  resumeCustomerRollout,
  startRolloutBatch,
  startRolloutCanary,
} from "@/lib/platform-versioning/customer-rollout.service";

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
      return NextResponse.json({ error: "Invalid rollout id" }, { status: 400 });
    }

    const detail = await getCustomerRolloutDetail(id);
    if (!detail) return NextResponse.json({ error: "Rollout not found" }, { status: 404 });

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[master-admin/ar360/customer-rollouts/:id GET]", error);
    return NextResponse.json({ error: "Unable to load customer rollout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid rollout id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (action === "preview") {
      const preview = await previewCustomerRollout(id);
      await logAdminAudit(admin, "ar360.customer_rollout.previewed", "ar360_customer_rollout", String(id), {
        migrationPlan: preview.migrationPlanId,
        productCount: preview.products.length,
      });
      return NextResponse.json(preview);
    }

    if (action === "canary") {
      const confirm = Boolean(body.confirm);
      const productIds = Array.isArray(body.productIds)
        ? body.productIds.map((x: unknown) => String(x))
        : [];
      const result = await startRolloutCanary({
        rolloutId: id,
        productIds,
        adminId: admin.id,
        confirm,
      });
      await logAdminAudit(
        admin,
        "ar360.customer_rollout.canary_started",
        "ar360_customer_rollout",
        String(id),
        {
          migrationPlan: result.plan.id,
          products: productIds,
          processed: result.processed,
          paused: result.paused,
        },
      );
      if (result.paused) {
        await logAdminAudit(
          admin,
          "ar360.customer_rollout.paused",
          "ar360_customer_rollout",
          String(id),
          { reason: result.pausedReason },
        );
      }
      return NextResponse.json({
        ok: true,
        ...result,
        warning: "Canary does not enable global VERSIONED. Failed products do not undo PASS products.",
      });
    }

    if (action === "batch") {
      const confirm = Boolean(body.confirm);
      const result = await startRolloutBatch({
        rolloutId: id,
        adminId: admin.id,
        confirm,
      });
      await logAdminAudit(
        admin,
        "ar360.customer_rollout.batch_started",
        "ar360_customer_rollout",
        String(id),
        {
          migrationPlan: result.plan.id,
          processed: result.processed,
          paused: result.paused,
          status: result.rollout.status,
        },
      );
      if (result.paused) {
        await logAdminAudit(
          admin,
          "ar360.customer_rollout.paused",
          "ar360_customer_rollout",
          String(id),
          { reason: result.pausedReason },
        );
      }
      if (result.rollout.status === "COMPLETED") {
        await logAdminAudit(
          admin,
          "ar360.customer_rollout.completed",
          "ar360_customer_rollout",
          String(id),
          { migrationPlan: result.plan.id },
        );
      }
      return NextResponse.json({
        ok: true,
        ...result,
        warning: "Batch does not auto-continue after failure. No whole-client rollback.",
      });
    }

    if (action === "pause") {
      const rollout = await pauseCustomerRollout(id, body.reason ? String(body.reason) : undefined);
      await logAdminAudit(admin, "ar360.customer_rollout.paused", "ar360_customer_rollout", String(id), {
        status: rollout.status,
      });
      return NextResponse.json({ ok: true, rollout });
    }

    if (action === "resume") {
      const rollout = await resumeCustomerRollout(id);
      await logAdminAudit(admin, "ar360.customer_rollout.resumed", "ar360_customer_rollout", String(id), {
        status: rollout.status,
      });
      return NextResponse.json({ ok: true, rollout });
    }

    if (action === "cancel") {
      const rollout = await cancelCustomerRollout({ rolloutId: id });
      await logAdminAudit(
        admin,
        "ar360.customer_rollout.cancelled",
        "ar360_customer_rollout",
        String(id),
        { status: rollout.status, migrationPlan: rollout.migrationPlanId },
      );
      return NextResponse.json({
        ok: true,
        rollout,
        warning: "Cancel skips pending products. PASS products are not undone.",
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Use preview | canary | batch | pause | resume | cancel" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update customer rollout";
    console.error("[master-admin/ar360/customer-rollouts/:id POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
