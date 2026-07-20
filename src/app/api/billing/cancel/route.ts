import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelCustomerSubscription } from "@/server/billing/subscription.service";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import { SubscriptionLifecycleError } from "@/server/billing/provider-subscription.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const denied = await guardBillingMutation(req, String(user.id || user.customerUid));
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const cancelAtPeriodEnd = body.cancelAtPeriodEnd !== false;
    const subscription = await cancelCustomerSubscription(user.customerUid, cancelAtPeriodEnd);
    return NextResponse.json({
      success: true,
      cancellation: cancelAtPeriodEnd ? "scheduled" : "effective",
      subscription,
    });
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
