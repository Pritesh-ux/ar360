import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { rejectCustomerUpdateRequest } from "@/lib/platform-versioning/customer-update-request.service";

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
    const request = await rejectCustomerUpdateRequest({
      requestId: id,
      adminId: auth.admin.id,
      reason: body.reason ? String(body.reason) : undefined,
    });

    await logAdminAudit(auth.admin, "ar360.customer_update.rejected", "ar360_customer_update_request", String(id), {
      customerUid: request.customerUid,
      reason: request.rejectReason || "",
      migratesProducts: false,
    });

    return NextResponse.json({ success: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
