import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { approveCustomerUpdateRequest } from "@/lib/platform-versioning/customer-update-request.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    const request = await approveCustomerUpdateRequest({
      requestId: id,
      adminId: auth.admin.id,
    });

    await logAdminAudit(auth.admin, "ar360.customer_update.approved", "ar360_customer_update_request", String(id), {
      customerUid: request.customerUid,
      releaseId: request.releaseId,
      migratesProducts: false,
    });

    return NextResponse.json({
      success: true,
      request,
      warning: "Approved. Product pointers were NOT changed. Use Prepare Rollout / Phase 9 to execute.",
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "APPROVE_FAILED";
    const message = error instanceof Error ? error.message : "Unable to approve";
    if (code === "UPDATE_APPROVAL_STALE") {
      await logAdminAudit(auth.admin, "ar360.customer_update.stale", "ar360_customer_update_request", String((await context.params).id), {
        reason: message,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
