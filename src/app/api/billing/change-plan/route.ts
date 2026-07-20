import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import {
  previewAndSchedulePlanChange,
  SubscriptionLifecycleError,
} from "@/server/billing/provider-subscription.service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const denied = await guardBillingMutation(req, String(user.id || user.customerUid));
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    period?: string;
    confirm?: boolean;
  };
  const period = String(body.period || "monthly");
  const planId = mapLegacyPlanId(String(body.planId || ""));
  const checkoutPath = `/dashboard/billing/checkout?plan=${encodeURIComponent(planId)}&period=${encodeURIComponent(period)}`;

  if (period !== "monthly" && period !== "yearly") {
    return NextResponse.json({ error: "Invalid billing period." }, { status: 400 });
  }

  try {
    const result = await previewAndSchedulePlanChange({
      customerUid: user.customerUid,
      targetPlanId: planId,
      period,
      confirm: body.confirm === true,
    });
    return NextResponse.json({ success: true, preview: result });
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          checkoutRequired: error.code === "CHECKOUT_REQUIRED",
          checkoutPath: error.code === "CHECKOUT_REQUIRED" ? checkoutPath : undefined,
        },
        { status: error.status },
      );
    }

    const razorpayDescription =
      error && typeof error === "object" && "error" in error
        ? String((error as { error?: { description?: string } }).error?.description || "")
        : "";
    if (/invalid|could not be found|not found/i.test(razorpayDescription)) {
      return NextResponse.json(
        {
          error: "In-place upgrade is unavailable. Continue to checkout to switch plans.",
          code: "CHECKOUT_REQUIRED",
          checkoutRequired: true,
          checkoutPath,
        },
        { status: 409 },
      );
    }

    console.error("[billing/change-plan]", error);
    return NextResponse.json(
      {
        error:
          (error instanceof Error && error.message) ||
          razorpayDescription ||
          "Plan change failed.",
      },
      { status: 500 },
    );
  }
}
