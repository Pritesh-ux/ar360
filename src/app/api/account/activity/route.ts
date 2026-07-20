import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { listCustomerActivity } from "@/lib/account/activity.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const { searchParams } = request.nextUrl;
  const data = await listCustomerActivity({
    customerUid: user.customerUid,
    page: Number(searchParams.get("page") || "1"),
    pageSize: Number(searchParams.get("pageSize") || "20"),
  });

  return NextResponse.json({ success: true, ...data });
}
