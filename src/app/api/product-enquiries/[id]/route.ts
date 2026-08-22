import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/viewer-contact/types";
import { updateProductEnquiryStatus } from "@/lib/viewer-contact/enquiries.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "product_contact");
  if (!permission.ok) return permission.response;

  const { id } = await context.params;
  const enquiryUid = String(id || "").trim();
  if (!enquiryUid) return NextResponse.json({ error: "Enquiry id is required." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const status = String(body.status || "").toLowerCase() as EnquiryStatus;
  if (!ENQUIRY_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const updated = await updateProductEnquiryStatus({
    customerUid: user.customerUid,
    enquiryUid,
    status,
  });
  if (!updated) {
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  }
  return NextResponse.json({ enquiry: updated });
}
