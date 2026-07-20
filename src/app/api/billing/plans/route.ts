import { NextResponse } from "next/server";
import { getActivePublicPlans } from "@/lib/billing/plan-service";
import { BILLING_PLANS } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Paid catalog only — trial is free onboarding, not a pricing card.
    // Legacy aliases (basic/professional) are collapsed to starter/pro.
    const plans = await getActivePublicPlans();
    return NextResponse.json({ success: true, plans }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Billing plans DB fallback:", error);
    return NextResponse.json({
      success: true,
      plans: BILLING_PLANS.filter((plan) => plan.id !== "trial"),
      fallback: true,
    });
  }
}
