import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { getCustomerProfile, updateCustomerProfile } from "@/lib/account/account.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const profile = await getCustomerProfile(user.customerUid, user.id);
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  return NextResponse.json({ success: true, profile });
}

export async function PATCH(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const body = await request.json();
  const result = await updateCustomerProfile({
    customerUid: user.customerUid,
    userId: user.id,
    fullName: body.fullName !== undefined ? String(body.fullName) : undefined,
    phone: body.phone !== undefined ? String(body.phone) : undefined,
    profileImageUrl: body.profileImageUrl !== undefined ? (body.profileImageUrl ? String(body.profileImageUrl) : null) : undefined,
  });

  if ("error" in result) return NextResponse.json({ error: result.error, code: "PROFILE_UPDATE_FAILED" }, { status: 400 });

  const profile = await getCustomerProfile(user.customerUid, user.id);
  return NextResponse.json({ success: true, profile });
}
