import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/account/account.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const company = await getCompanyProfile(user.customerUid, user.id);
  if (!company) return NextResponse.json({ error: "Company profile not found." }, { status: 404 });

  return NextResponse.json({ success: true, company });
}

export async function PATCH(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const body = await request.json();
  const result = await updateCompanyProfile({
    customerUid: user.customerUid,
    userId: user.id,
    companyName: body.companyName !== undefined ? String(body.companyName) : undefined,
    businessType: body.businessType !== undefined ? String(body.businessType) : undefined,
    website: body.website !== undefined ? String(body.website) : undefined,
    phone: body.phone !== undefined ? String(body.phone) : undefined,
    address: body.address !== undefined ? String(body.address) : undefined,
    country: body.country !== undefined ? String(body.country) : undefined,
    state: body.state !== undefined ? String(body.state) : undefined,
    city: body.city !== undefined ? String(body.city) : undefined,
    postalCode: body.postalCode !== undefined ? String(body.postalCode) : undefined,
  });

  if ("error" in result) return NextResponse.json({ error: result.error, code: "PROFILE_UPDATE_FAILED" }, { status: 400 });

  const company = await getCompanyProfile(user.customerUid, user.id);
  return NextResponse.json({ success: true, company });
}
