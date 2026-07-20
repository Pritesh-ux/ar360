import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { BillingErrorCode, billingErrorJson } from "@/lib/billing/billing-errors";
import { verifyRazorpayPaymentSignature } from "@/server/billing/razorpay";
import { finalizeSuccessfulPayment } from "@/server/billing/payment-finalize.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

    const body = await req.json();
    const razorpayOrderId = String(body.razorpay_order_id || "");
    const razorpayPaymentId = String(body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpay_signature || "");

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Payment verification fields missing." }, { status: 400 });
    }

    const valid = await verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!valid) {
      return NextResponse.json(billingErrorJson(BillingErrorCode.PAYMENT_SIGNATURE_INVALID), { status: 400 });
    }

    const orders = await query<{
      order_uid: string;
      customer_uid: string;
      plan_id: string;
      billing_period: string;
      amount_paise: number;
    }>(
      `SELECT order_uid, customer_uid, plan_id, billing_period, amount_paise
       FROM billing_orders WHERE razorpay_order_id = ? LIMIT 1`,
      [razorpayOrderId],
    );

    const order = orders[0];
    if (!order) return NextResponse.json(billingErrorJson(BillingErrorCode.PAYMENT_NOT_FOUND, 404), { status: 404 });

    if (user.customerUid && user.customerUid !== order.customer_uid) {
      return NextResponse.json({ error: "Unauthorized payment." }, { status: 403 });
    }

    const period = order.billing_period === "yearly" ? "yearly" : "monthly";

    const result = await finalizeSuccessfulPayment({
      customerUid: order.customer_uid,
      orderUid: order.order_uid,
      planId: order.plan_id,
      period,
      amountPaise: order.amount_paise,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      rawPayload: body,
    });

    return NextResponse.json({
      success: true,
      planId: result.planId,
      period: result.period,
      invoiceUid: result.invoiceUid,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    console.error("Payment verification failed", error);
    return NextResponse.json({ error: "Payment verification failed." }, { status: 500 });
  }
}
