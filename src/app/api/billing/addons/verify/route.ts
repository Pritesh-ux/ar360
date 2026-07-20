import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { uid, verifyRazorpayPaymentSignature } from "@/server/billing/razorpay";
import { getCustomerOwnerUserId } from "@/lib/billing/addons";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const body = await req.json();
    const isMock = body.mock === true;

    const ownerUserId = await getCustomerOwnerUserId(customerUid);
    if (!ownerUserId) {
      return NextResponse.json({ error: "Owner account resolve failed." }, { status: 400 });
    }

    if (isMock) {
      const addonSlug = String(body.addonSlug || "");
      const billingType = String(body.billingType || "monthly");
      
      if (!addonSlug) {
        return NextResponse.json({ error: "Addon slug missing." }, { status: 400 });
      }

      // Calculate expiration date (e.g. 1 month or 1 year)
      const expiresAt = new Date();
      if (billingType === "yearly") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
      const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

      // Upsert user addon record
      await query(
        `INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
         VALUES (?, ?, 'active', ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE status = 'active', billing_type = VALUES(billing_type), activated_at = NOW(), expires_at = VALUES(expires_at)`,
        [ownerUserId, addonSlug, billingType, expiresAtStr]
      );

      return NextResponse.json({ success: true, addonSlug, mock: true });
    }

    // Process real Razorpay verification
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
      return NextResponse.json({ error: "Payment signature is invalid." }, { status: 400 });
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
      [razorpayOrderId]
    );

    const order = orders[0];
    if (!order) {
      return NextResponse.json({ error: "Order details not found." }, { status: 404 });
    }

    if (order.customer_uid !== customerUid) {
      return NextResponse.json({ error: "Unauthorized payment verification." }, { status: 403 });
    }

    const addonSlug = order.plan_id.replace(/^addon:/, "");
    const billingType = order.billing_period;

    // Calculate expiration date
    const expiresAt = new Date();
    if (billingType === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");

    // Update billing_orders
    await query(
      `UPDATE billing_orders SET status = 'paid', updated_at = NOW() WHERE order_uid = ?`,
      [order.order_uid]
    );

    // Save payment ledger record
    const paymentUid = uid("pay");
    await query(
      `INSERT INTO billing_payments 
       (payment_uid, customer_uid, order_uid, plan_id, amount_paise, currency, status, razorpay_order_id, razorpay_payment_id, razorpay_signature)
       VALUES (?, ?, ?, ?, ?, 'INR', 'captured', ?, ?, ?)`,
      [
        paymentUid,
        customerUid,
        order.order_uid,
        order.plan_id,
        order.amount_paise,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      ]
    );

    // Upsert user addon record
    await query(
      `INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
       VALUES (?, ?, 'active', ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE status = 'active', billing_type = VALUES(billing_type), activated_at = NOW(), expires_at = VALUES(expires_at)`,
      [ownerUserId, addonSlug, billingType, expiresAtStr]
    );

    return NextResponse.json({ success: true, addonSlug, mock: false });
  } catch (error) {
    console.error("Addon payment verification failed:", error);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
