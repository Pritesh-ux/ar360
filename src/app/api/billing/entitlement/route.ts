import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBillingEntitlement } from "@/lib/billing/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "upload";
  const snapshot = await getBillingEntitlement({ customerUid: user.customerUid, action });

  return NextResponse.json(
    { success: true, ...snapshot },
    { headers: { "Cache-Control": "no-store" } },
  );
}
