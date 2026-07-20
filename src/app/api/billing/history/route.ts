import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBillingHistory } from "@/server/billing/subscription.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const history = await getBillingHistory(user.customerUid);
  return NextResponse.json({ success: true, history });
}
