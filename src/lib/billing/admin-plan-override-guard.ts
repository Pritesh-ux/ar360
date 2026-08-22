import { NextResponse } from "next/server";
import { getCustomerProductionBilling } from "@/lib/master-admin/production-billing.service";
import { isRazorpaySubscriptionId } from "@/server/billing/provider-subscription.service";

/**
 * Blocks admin local plan/status overrides when the customer has a real
 * recurring Razorpay subscription (sub_…). One-time pay_ ids and manual
 * enterprise rows remain admin-editable.
 */
export async function assertAdminPlanOverrideAllowed(customerUid: string): Promise<NextResponse | null> {
  const current = await getCustomerProductionBilling(customerUid).catch(() => null);
  const sub = current?.subscription;
  if (
    sub?.provider === "razorpay" &&
    isRazorpaySubscriptionId(sub?.provider_subscription_id)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Provider-managed subscriptions must be changed through Razorpay lifecycle controls.",
      },
      { status: 409 },
    );
  }
  return null;
}
