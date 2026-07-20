import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resumeCustomerSubscription } from "@/server/billing/subscription.service";
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
    const subscription = await resumeCustomerSubscription(user.customerUid);
    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    if (error instanceof SubscriptionLifecycleError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
