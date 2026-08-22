import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyNativeSubscriptionCallback } from "@/server/billing/subscription-callback.service";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) return NextResponse.json({ error: "Login required." }, { status: 401 });
    const denied = await guardBillingMutation(req, String(user.id || user.customerUid));
    if (denied) return denied;
    const body = await req.json();
    const checkoutSessionUid = String(body.checkoutSessionUid || "");
    const subscriptionId = String(body.razorpay_subscription_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    if (!checkoutSessionUid || !subscriptionId || !paymentId || !signature) {
      return NextResponse.json({ error: "Subscription verification fields missing." }, { status: 400 });
    }

    const result = await verifyNativeSubscriptionCallback({
      customerUid: user.customerUid,
      checkoutSessionUid,
      subscriptionId,
      paymentId,
      signature,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Subscription verification failed.";
    console.error("Subscription callback verification failed", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
