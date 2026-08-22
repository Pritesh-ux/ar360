import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCustomerSampleProduct } from "@/lib/onboarding/sample-product.service";
import { logOnboardingEvent } from "@/lib/onboarding/activity";
import { onboardingErrorMessage } from "@/lib/onboarding/onboarding-errors";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
  }

  const gate = await requireActiveSubscriptionApi(user.customerUid);
  if (!gate.ok) return gate.response;

  const result = await createCustomerSampleProduct({
    customerUid: user.customerUid,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
  });

  if (result.ok === false) {
    return NextResponse.json(
      { success: false, code: result.code, error: onboardingErrorMessage(result.code) },
      { status: result.code.includes("LIMIT") ? 403 : 400 },
    );
  }

  if (!result.alreadyExists) {
    await logOnboardingEvent({
      customerUid: user.customerUid,
      eventType: "creation_method_selected",
      title: "Sample product selected",
      meta: { method: "sample" },
    });
  }

  return NextResponse.json({
    success: true,
    productId: result.productId,
    alreadyExists: result.alreadyExists,
    redirect: `/dashboard/products/${result.productId}`,
  });
}
