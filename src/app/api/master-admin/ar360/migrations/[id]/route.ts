import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  executeMigrationBatch,
  getMigrationPlanSummary,
  previewMigrationPlan,
  resumeMigrationPlan,
  rollbackAvailabilityForProduct,
} from "@/lib/platform-versioning/migration-engine.service";

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
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const summary = await getMigrationPlanSummary(id);
    if (!summary) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    return NextResponse.json({
      ...summary,
      products: summary.products.map((p) => ({
        ...p,
        rollbackAvailable: rollbackAvailabilityForProduct(p.applied),
      })),
    });
  } catch (error) {
    console.error("[master-admin/ar360/migrations/:id GET]", error);
    return NextResponse.json({ error: "Unable to load migration plan" }, { status: 500 });
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
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (action === "preview") {
      const preview = await previewMigrationPlan(id);
      await logAdminAudit(admin, "ar360.migration.previewed", "ar360_migration_plan", String(id), {
        productCount: preview.products.length,
      });
      return NextResponse.json(preview);
    }

    if (action === "canary" || action === "batch") {
      const confirm = Boolean(body.confirm);
      if (!confirm) {
        return NextResponse.json(
          {
            error:
              "Confirmation required. Migration changes only versioned component pointers for selected products.",
            code: "confirmation_required",
          },
          { status: 400 },
        );
      }

      const canaryProductIds =
        action === "canary" && Array.isArray(body.productIds)
          ? body.productIds.map((x: unknown) => String(x))
          : action === "canary"
            ? undefined
            : undefined;

      // For canary without explicit IDs, use first batch_size pending products
      let canaryIds = canaryProductIds;
      if (action === "canary" && (!canaryIds || canaryIds.length === 0)) {
        const summary = await getMigrationPlanSummary(id);
        canaryIds = (summary?.products || [])
          .filter((p) => p.status === "PENDING")
          .slice(0, summary?.plan.batchSize || 10)
          .map((p) => p.productId);
      }

      const result = await executeMigrationBatch({
        planId: id,
        adminId: admin.id,
        canaryProductIds: action === "canary" ? canaryIds : undefined,
        confirm: true,
      });

      await logAdminAudit(
        admin,
        action === "canary" ? "ar360.migration.canary_executed" : "ar360.migration.batch_executed",
        "ar360_migration_plan",
        String(id),
        {
          processed: result.processed,
          paused: result.paused,
          pausedReason: result.pausedReason,
          status: result.plan.status,
        },
      );

      return NextResponse.json({
        ok: true,
        ...result,
        warning:
          "Migration does not enable VERSIONED globally. Legacy remains default. No automatic rollback.",
      });
    }

    if (action === "resume") {
      const plan = await resumeMigrationPlan(id);
      await logAdminAudit(admin, "ar360.migration.resumed", "ar360_migration_plan", String(id), {
        status: plan.status,
      });
      return NextResponse.json({ ok: true, plan });
    }

    return NextResponse.json(
      { error: "Unknown action. Use preview | canary | batch | resume" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update migration plan";
    console.error("[master-admin/ar360/migrations/:id POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
