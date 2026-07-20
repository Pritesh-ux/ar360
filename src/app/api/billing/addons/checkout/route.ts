import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRazorpayClient, uid } from "@/server/billing/razorpay";
import { getRazorpayKeys } from "@/lib/master-admin-settings";
import { getAddonsForCustomer, isPlanEligibleForAddon } from "@/lib/billing/addons";
import { checkSubscription } from "@/lib/subscription/check-subscription";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";

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
    const addonSlug = String(body.addonSlug || "").trim();
    const billingType = String(body.billingType || "monthly").trim() as "monthly" | "yearly";

    if (!addonSlug || (billingType !== "monthly" && billingType !== "yearly")) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    const sub = await checkSubscription(customerUid);
    const planId = mapLegacyPlanId(sub.plan?.id || "trial");

    // Load available addons and find requested one
    const addons = await getAddonsForCustomer(customerUid, planId);
    const addon = addons.find((a) => a.slug === addonSlug);

    if (!addon) {
      return NextResponse.json({ error: "Addon not found." }, { status: 404 });
    }
    if (addon.purchased) {
      return NextResponse.json({ error: "Addon is already active." }, { status: 400 });
    }

    if (planId === "starter" || planId === "trial" || planId === "free" || planId === "pro") {
      return NextResponse.json({ error: "Addon not available on Starter or Trial plans." }, { status: 403 });
    }

    const eligible = isPlanEligibleForAddon(planId, addon);
    if (!eligible) {
      return NextResponse.json({ error: "Addon not available on your current plan." }, { status: 403 });
    }

    // Calculate price
    const price = billingType === "monthly" ? addon.monthly_price : addon.yearly_price;
    const amountPaise = price * 100; // stored in INR/rupees

    const keys = await getRazorpayKeys().catch(() => ({ keyId: null, keySecret: null }));
    const isMockSandbox = !keys.keyId || body.sandbox === true;

    if (isMockSandbox) {
      // Create a mock order UID
      const orderUid = uid("bo_addon_mock");
      return NextResponse.json({
        success: true,
        mock: true,
        orderUid,
        addonSlug,
        billingType,
        amount: amountPaise,
        currency: addon.currency || "INR",
        customer: { name: user.name || "", email: user.email || "" },
      });
    }

    // Setup real Razorpay Order
    const razorpay = await getRazorpayClient();
    const receipt = uid("ord_addon");

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: addon.currency || "INR",
      receipt,
      notes: { customerUid, addonSlug, billingType, userId: String(user.id || "") },
    });

    const orderUid = uid("bo_addon");
    
    // Save to billing_orders to trace payment audit logs
    await query(
      `INSERT INTO billing_orders
       (order_uid, customer_uid, user_id, plan_id, billing_period, razorpay_order_id, amount_paise, currency, status, metadata, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [
        orderUid,
        customerUid,
        user.id || null,
        `addon:${addonSlug}`,
        billingType,
        order.id,
        amountPaise,
        addon.currency || "INR",
        JSON.stringify({ receipt, isAddon: true }),
      ]
    );

    return NextResponse.json({
      success: true,
      mock: false,
      orderUid,
      razorpayOrderId: order.id,
      amount: amountPaise,
      currency: addon.currency || "INR",
      keyId: keys.keyId,
      addonSlug,
      billingType,
      customer: { name: user.name || "", email: user.email || "" },
    });
  } catch (error) {
    console.error("Addon checkout error:", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
