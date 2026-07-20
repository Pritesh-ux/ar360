import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAddonsForCustomer } from "@/lib/billing/addons";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const sub = await checkSubscription(customerUid);
    const planId = mapLegacyPlanId(sub.plan?.id || "trial");
    const addons = await getAddonsForCustomer(customerUid, planId);
    return NextResponse.json({ success: true, planId, addons });
  } catch (error) {
    console.error("Fetch addons error:", error);
    return NextResponse.json({ error: "Failed to fetch addons." }, { status: 500 });
  }
}
