import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { prepareRolloutFromCustomerUpdateRequest } from "@/lib/platform-versioning/customer-update-request.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    const body = await req.json().catch(() => ({}));

    const result = await prepareRolloutFromCustomerUpdateRequest({
      requestId: id,
      adminId: auth.admin.id,
      batchSize: body.batchSize != null ? Number(body.batchSize) : 1,
      notes: body.notes ? String(body.notes) : undefined,
    });

    await logAdminAudit(
      auth.admin,
      "ar360.customer_update.rollout_ready",
      "ar360_customer_update_request",
      String(id),
      {
        customerUid: result.request.customerUid,
        rolloutId: result.rollout.id,
        migrationPlanId: result.rollout.migrationPlanId,
        migratesProducts: false,
        note: "Phase 9 rollout created; pointers unchanged until canary/batch",
      },
    );

    return NextResponse.json({
      success: true,
      request: result.request,
      rollout: result.rollout,
      warning:
        "Phase 9 Customer Rollout prepared. Product pointers are unchanged until explicit canary/batch in Customer Rollouts.",
      openRolloutHref: `/master-admin/ar360-system/customer-rollouts/${result.rollout.id}`,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "PREPARE_FAILED";
    const message = error instanceof Error ? error.message : "Unable to prepare rollout";
    if (code === "UPDATE_APPROVAL_STALE") {
      await logAdminAudit(
        auth.admin,
        "ar360.customer_update.stale",
        "ar360_customer_update_request",
        String((await context.params).id),
        { reason: message },
      ).catch(() => undefined);
    }
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
