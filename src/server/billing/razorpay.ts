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

/**
 * Confirm payment with Razorpay API (status + amount + order ownership).
 * Call after signature verify on client-side verify paths.
 */
export async function assertRazorpayCapturedPayment(input: {
  paymentId: string;
  orderId: string;
  expectedAmountPaise: number;
  currency?: string;
}) {
  const client = await getRazorpayClient();
  const payment = await client.payments.fetch(input.paymentId);
  const status = String(payment.status || "").toLowerCase();
  if (status !== "captured" && status !== "authorized") {
    throw new Error(`Payment not captured (status=${status || "unknown"}).`);
  }
  if (String(payment.order_id || "") !== input.orderId) {
    throw new Error("Payment order_id mismatch.");
  }
  const amount = Number(payment.amount || 0);
  const expected = Number(input.expectedAmountPaise);
  if (!Number.isFinite(expected) || expected <= 0 || amount !== expected) {
    throw new Error(`Payment amount mismatch: expected ${expected}, received ${amount}.`);
  }
  const currency = String(payment.currency || "INR").toUpperCase();
  const expectedCurrency = String(input.currency || "INR").toUpperCase();
  if (currency !== expectedCurrency) {
    throw new Error(`Payment currency mismatch: expected ${expectedCurrency}, received ${currency}.`);
  }
  return payment;
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

export function matchRazorpayWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function verifyRazorpayWebhookSignature(rawBody: string, signature: string) {
  // Credentials come from getRazorpayKeys() which enforces the staging LIVE hard-block
  // (DB LIVE settings never override staging TEST boundary).
  const secret = (await getRazorpayKeys()).webhookSecret?.trim() || "";
  return matchRazorpayWebhookSignature(rawBody, signature, secret);
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
