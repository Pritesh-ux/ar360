import crypto from "crypto";
import Razorpay from "razorpay";
import { getPlanBySlug } from "@/lib/billing/plan-service";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { getRazorpayKeys } from "@/lib/master-admin-settings";
import { assertRazorpayCheckoutReady } from "@/lib/billing/razorpay-config";

export type BillingPeriod = "monthly" | "yearly";

export async function getRazorpayClient() {
  await assertRazorpayCheckoutReady();
  const { keyId, keySecret } = await getRazorpayKeys();
  return new Razorpay({ key_id: keyId!, key_secret: keySecret! });
}

export async function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { keySecret } = await getRazorpayKeys();
  if (!keySecret) return false;
  const body = `${input.orderId}|${input.paymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
  if (expected.length !== input.signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
}

/** Checkout.js subscription callbacks sign payment_id|subscription_id. */
export async function verifyRazorpaySubscriptionSignature(input: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}) {
  const { keySecret } = await getRazorpayKeys();
  if (!keySecret) return false;
  const body = `${input.paymentId}|${input.subscriptionId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
  if (expected.length !== input.signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
}

export async function verifyRazorpayWebhookSignature(rawBody: string, signature: string) {
  const envSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const secret = envSecret || (await getRazorpayKeys()).webhookSecret?.trim();
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

/** Resolve payable amount in paise from billing_plans — never trust frontend amounts. */
export async function getPlanPricePaise(planId: string, period: BillingPeriod): Promise<number> {
  const slug = mapLegacyPlanId(planId);
  const plan = await getPlanBySlug(slug);
  if (!plan) throw new Error("Invalid paid plan.");

  const inr =
    period === "yearly"
      ? plan.priceYearlyInr
      : plan.priceMonthlyInr;

  if (inr == null || inr <= 0) throw new Error("Invalid paid plan.");

  return Math.round(inr * 100);
}
