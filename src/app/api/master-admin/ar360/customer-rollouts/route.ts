import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  createCustomerRollout,
  listCustomerRollouts,
} from "@/lib/platform-versioning/customer-rollout.service";
import type { ComponentTargetMap } from "@/lib/platform-versioning/migration-engine.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const rollouts = await listCustomerRollouts(200);
    return NextResponse.json({
      rollouts,
      note: "Phase 9 controlled customer rollout. Wraps Phase 7. No Auto Rollout. No scope=all.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/customer-rollouts GET]", error);
    return NextResponse.json({ error: "Unable to list customer rollouts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const customerUid = String(body.customerUid || "").trim();
    if (!customerUid) {
      return NextResponse.json({ error: "customerUid is required" }, { status: 400 });
    }

    const productsRaw = Array.isArray(body.products) ? body.products : [];
    const products = productsRaw.map((p: Record<string, unknown>) => ({
      productId: String(p.productId || "").trim(),
      proposed: (p.proposed || {}) as ComponentTargetMap,
    }));

    if (!products.length || products.some((p) => !p.productId)) {
      return NextResponse.json(
        { error: "Explicitly selected products with productId are required" },
        { status: 400 },
      );
    }

    const result = await createCustomerRollout({
      customerUid,
      targetReleaseId: body.targetReleaseId != null ? Number(body.targetReleaseId) : null,
      batchSize: body.batchSize != null ? Number(body.batchSize) : 5,
      notes: body.notes != null ? String(body.notes) : undefined,
      adminId: admin.id,
      products,
      scope: "one_client_selected_products",
    });

    await logAdminAudit(
      admin,
      "ar360.customer_rollout.created",
      "ar360_customer_rollout",
      String(result.rollout.id),
      {
        customerUid,
        release: result.rollout.targetReleaseId,
        migrationPlan: result.migrationPlanId,
        products: products.map((p) => p.productId),
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      warning:
        "Rollout created. Preview does not mutate. Canary/batch require explicit confirmation. AUTO is not executable.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create customer rollout";
    console.error("[master-admin/ar360/customer-rollouts POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
