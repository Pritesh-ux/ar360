import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  createMigrationPlan,
  listMigrationPlans,
  type ComponentTargetMap,
} from "@/lib/platform-versioning/migration-engine.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const plans = await listMigrationPlans(100);
    return NextResponse.json({
      plans,
      note: "Phase 7 controlled migration. Selected products only. Geometry migration blocked. No scope=all.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/migrations GET]", error);
    return NextResponse.json({ error: "Unable to list migration plans" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const productsRaw = Array.isArray(body.products) ? body.products : [];
    const products = productsRaw.map((p: Record<string, unknown>) => ({
      productId: String(p.productId || "").trim(),
      proposed: (p.proposed || {}) as ComponentTargetMap,
    }));

    if (products.some((p: { productId: string }) => !p.productId)) {
      return NextResponse.json({ error: "Each product requires productId" }, { status: 400 });
    }

    const plan = await createMigrationPlan({
      title,
      releaseId: body.releaseId != null ? Number(body.releaseId) : null,
      batchSize: body.batchSize != null ? Number(body.batchSize) : 10,
      notes: body.notes != null ? String(body.notes) : undefined,
      adminId: admin.id,
      products,
    });

    await logAdminAudit(admin, "ar360.migration.plan_created", "ar360_migration_plan", String(plan.id), {
      title: plan.title,
      releaseId: plan.releaseId,
      productCount: products.length,
      components: plan.components,
      batchSize: plan.batchSize,
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create migration plan";
    console.error("[master-admin/ar360/migrations POST]", error);
    const status = /GEOMETRY_NOT_SUPPORTED|scope=all|At least one/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
