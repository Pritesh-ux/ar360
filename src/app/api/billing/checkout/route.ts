import { NextResponse } from "next/server";
import { getCurrentUser, ensureCustomerForUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { BillingErrorCode, billingErrorJson } from "@/lib/billing/billing-errors";
import { getPlanBySlug, validateUpgrade } from "@/lib/billing/plan-service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { getPlanPricePaise, getRazorpayClient, uid, type BillingPeriod } from "@/server/billing/razorpay";
import { getPlatformSettings, getRazorpayKeys } from "@/lib/master-admin-settings";
import { getSubscriptionByCustomer } from "@/server/billing/subscription.repository";
import { isEligibleLegacyRenewal, isNativeSubscriptionEligible } from "@/server/billing/checkout-rollout";
import { createNativeSubscriptionCheckout } from "@/server/billing/native-checkout.service";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import { ensureCouponsSchema } from "@/lib/db";
import { validateCouponForCheckout, calculateDiscountPaise } from "@/lib/coupons/coupon-customer.service";

export const runtime = "nodejs";

const PENDING_CHECKOUT_TTL_MINUTES = 30;

function checkoutErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Razorpay keys missing")) {
    return "Payment gateway is not configured. Add Razorpay keys in Master Admin → Settings → Payment Settings.";
  }
  if (message.includes("Invalid paid plan")) {
    return "Selected plan is not available for checkout.";
  }
  if (process.env.NODE_ENV !== "production" && message) {
    return message;
  }
  return "Checkout creation failed.";
}

async function expireStalePendingOrders(customerUid: string) {
  await query(
    `UPDATE billing_orders
        SET status = 'cancelled', updated_at = NOW()
      WHERE customer_uid = ?
        AND status = 'created'
        AND (
          (expires_at IS NOT NULL AND expires_at < NOW())
          OR (expires_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
        )`,
    [customerUid, PENDING_CHECKOUT_TTL_MINUTES],
  ).catch(() => {});
}

async function supersedePendingOrders(customerUid: string) {
  await query(
    `UPDATE billing_orders
        SET status = 'cancelled', updated_at = NOW()
      WHERE customer_uid = ? AND status = 'created'`,
    [customerUid],
  ).catch(() => {});
}

async function findReusablePendingOrder(customerUid: string, planId: string, period: BillingPeriod) {
  const rows = await query<{
    order_uid: string;
    razorpay_order_id: string;
    amount_paise: number;
  }>(
    `SELECT order_uid, razorpay_order_id, amount_paise
       FROM billing_orders
      WHERE customer_uid = ?
        AND plan_id = ?
        AND billing_period = ?
        AND status = 'created'
        AND (
          expires_at IS NULL OR expires_at > NOW()
        )
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY created_at DESC
      LIMIT 1`,
    [customerUid, planId, period, PENDING_CHECKOUT_TTL_MINUTES],
  );
  return rows[0] || null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
    const denied = await guardBillingMutation(req, String(user.id || user.customerUid || "unknown"));
    if (denied) return denied;

    const body = await req.json();
    const requestedPlanId = String(body.planId || body.targetPlanId || "").trim();
    const planId = mapLegacyPlanId(requestedPlanId);
    const period = (String(body.period || body.billingInterval || "monthly") as BillingPeriod);

    let customerUid = String(user.customerUid || "").trim();
    if (!customerUid && user.id) {
      const customer = await ensureCustomerForUser({
        id: Number(user.id),
        name: user.name,
        email: user.email,
      });
      customerUid = customer.customer_uid;
    }

    if (!customerUid) return NextResponse.json({ error: "Customer account missing. Please log out and sign in again." }, { status: 400 });
    if (!planId) return NextResponse.json(billingErrorJson(BillingErrorCode.PLAN_NOT_FOUND), { status: 400 });
    if (planId === "trial" || planId === "enterprise") {
      return NextResponse.json(billingErrorJson(BillingErrorCode.PLAN_NOT_PURCHASABLE), { status: 400 });
    }
    if (period !== "monthly" && period !== "yearly") {
      return NextResponse.json(billingErrorJson(BillingErrorCode.INVALID_BILLING_INTERVAL), { status: 400 });
    }

    // Validate coupon if provided
    const couponCode = String(body.couponCode || "").trim();
    let couponUid: string | null = null;
    let discountPaise = 0;

    if (couponCode) {
      await ensureCouponsSchema();
      const couponResult = await validateCouponForCheckout(couponCode, customerUid);
      if (!couponResult.valid) {
        const errMsg = couponResult.valid === false ? couponResult.error : "Invalid coupon.";
        return NextResponse.json({ error: errMsg }, { status: 400 });
      }
      couponUid = couponResult.couponUid;
      const subtotalPaise = await getPlanPricePaise(planId, period);
      discountPaise = calculateDiscountPaise(couponResult.discountType, couponResult.discountValue, subtotalPaise);
    }

    const { checkSubscription } = await import("@/lib/subscription/check-subscription");
    const sub = await checkSubscription(customerUid);
    const currentPlanId = mapLegacyPlanId(sub.plan?.id || "trial");
    const targetPlan = await getPlanBySlug(planId);
    const [settings, canonicalSubscription] = await Promise.all([
      getPlatformSettings(),
      getSubscriptionByCustomer(customerUid),
    ]);
    const nativeEligible = isNativeSubscriptionEligible(customerUid, settings);
    const legacyRenewal = isEligibleLegacyRenewal({
      enabled: settings.legacyOneTimeRenewalsEnabled,
      requestedPlanId: planId,
      currentPlanId,
      salesChannel: canonicalSubscription?.sales_channel,
    });

    const upgradeCheck = validateUpgrade({
      currentPlanId,
      targetPlanId: planId,
      targetPlan,
    });

    if (upgradeCheck.ok === false && !legacyRenewal) {
      return NextResponse.json(
        { success: false, code: BillingErrorCode.UPGRADE_NOT_ALLOWED, error: upgradeCheck.error },
        { status: 400 },
      );
    }

    if (nativeEligible) {
      if (upgradeCheck.ok === false) {
        return NextResponse.json(
          { success: false, code: BillingErrorCode.UPGRADE_NOT_ALLOWED, error: upgradeCheck.error },
          { status: 400 },
        );
      }
      const idempotencyKey = String(
        req.headers.get("Idempotency-Key") || body.idempotencyKey || "",
      );
      const checkout = await createNativeSubscriptionCheckout({
        customerUid,
        userId: String(user.id || ""),
        customer: { name: user.name || "", email: user.email || "" },
        planId,
        period,
        idempotencyKey,
      });
      return NextResponse.json({ success: true, ...checkout });
    }

    // Native subscription rollout off/out-of-bucket: still allow self-serve upgrade
    // via one-time Razorpay order (legacy path), not a hard 403.
    if (!legacyRenewal && upgradeCheck.ok === false) {
      return NextResponse.json(
        { success: false, code: BillingErrorCode.UPGRADE_NOT_ALLOWED, error: upgradeCheck.error },
        { status: 400 },
      );
    }

    await expireStalePendingOrders(customerUid);

    const fullAmount = await getPlanPricePaise(planId, period);
    const amount = Math.max(1, fullAmount - discountPaise);
    const reusable = await findReusablePendingOrder(customerUid, planId, period);
    const keys = await getRazorpayKeys();

    if (reusable && reusable.amount_paise === amount) {
      if (!keys.keyId) {
        return NextResponse.json({ error: "Razorpay key ID missing." }, { status: 503 });
      }
      return NextResponse.json({
        success: true,
        orderUid: reusable.order_uid,
        razorpayOrderId: reusable.razorpay_order_id,
        amount,
        currency: "INR",
        keyId: keys.keyId,
        planId,
        period,
        reused: true,
        customer: { name: user.name || "", email: user.email || "" },
      });
    }

    // A leftover 'created' order (closed Razorpay modal, switched plan/period, or
    // a re-applied coupon) must not lock the customer out for the whole TTL. The
    // new intent wins; a late payment on the old Razorpay order still verifies,
    // since verification looks orders up by razorpay_order_id regardless of status.
    await supersedePendingOrders(customerUid);

    const razorpay = await getRazorpayClient();
    const receipt = uid("ord");

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        customerUid,
        planId,
        period,
        userId: String(user.id || ""),
        ...(couponUid ? { couponUid, couponCode, discountPaise: String(discountPaise) } : {}),
      },
    });

    const orderUid = uid("bo");
    const expiresAt = new Date(Date.now() + PENDING_CHECKOUT_TTL_MINUTES * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await query(
      `INSERT INTO billing_orders
       (order_uid, customer_uid, user_id, plan_id, billing_period, razorpay_order_id, amount_paise, currency, status, metadata, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'created', ?, ?)`,
      [
        orderUid,
        customerUid,
        user.id || null,
        planId,
        period,
        order.id,
        amount,
        JSON.stringify({
          receipt,
          ...(couponUid
            ? { couponUid, couponCode, originalAmountPaise: fullAmount, discountPaise }
            : {}),
        }),
        expiresAt,
      ],
    );

    if (!keys.keyId) {
      return NextResponse.json({ error: "Razorpay key ID missing." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      orderUid,
      razorpayOrderId: order.id,
      amount,
      currency: "INR",
      keyId: keys.keyId,
      planId,
      period,
      subtotal: fullAmount,
      gst: amount - Math.round(amount / 1.18),
      ...(couponUid ? { couponUid, couponCode, discountPaise } : {}),
      customer: { name: user.name || "", email: user.email || "" },
    });
  } catch (error) {
    console.error("Razorpay checkout failed", error);
    return NextResponse.json({ error: checkoutErrorMessage(error) }, { status: 500 });
  }
}
