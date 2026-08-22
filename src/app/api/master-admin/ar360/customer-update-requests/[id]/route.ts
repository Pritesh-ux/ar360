import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  getCustomerUpdateRequest,
  syncRequestStatusFromRollout,
} from "@/lib/platform-versioning/customer-update-request.service";
import { getCustomerRolloutDetail } from "@/lib/platform-versioning/customer-rollout.service";

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
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    let request = await getCustomerUpdateRequest(id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    request = (await syncRequestStatusFromRollout(id)) || request;

    let rollout = null;
    if (request.rolloutId) {
      rollout = await getCustomerRolloutDetail(request.rolloutId);
    }

    return NextResponse.json({ success: true, request, rollout });
  } catch (error) {
    console.error("[master-admin/ar360/customer-update-requests/:id GET]", error);
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
}
