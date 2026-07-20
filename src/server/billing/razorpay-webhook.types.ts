export const RAZORPAY_BILLING_EVENTS = [
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.completed",
  "payment.captured",
  "payment.failed",
  "refund.created",
  "refund.processed",
  "refund.failed",
] as const;

export type RazorpayBillingEventType = (typeof RAZORPAY_BILLING_EVENTS)[number];

export type RazorpayEntity = {
  id?: string;
  entity?: string;
  status?: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  payment_id?: string;
  subscription_id?: string;
  plan_id?: string;
  customer_id?: string;
  invoice_id?: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  ended_at?: number;
  created_at?: number;
  captured_at?: number;
  notes?: Record<string, unknown>;
  error_code?: string;
  error_description?: string;
};

export type ParsedRazorpayBillingEvent = {
  type: RazorpayBillingEventType;
  occurredAt: number;
  subscription: RazorpayEntity | null;
  payment: RazorpayEntity | null;
  refund: RazorpayEntity | null;
  providerSubscriptionId: string | null;
  providerPaymentId: string | null;
  providerRefundId: string | null;
};

const supported = new Set<string>(RAZORPAY_BILLING_EVENTS);

function entity(payload: Record<string, unknown>, key: string): RazorpayEntity | null {
  const wrapper = (payload.payload as Record<string, unknown> | undefined)?.[key] as
    | { entity?: RazorpayEntity }
    | undefined;
  return wrapper?.entity && typeof wrapper.entity === "object" ? wrapper.entity : null;
}

export function parseRazorpayBillingEvent(payload: unknown): ParsedRazorpayBillingEvent | null {
  if (!payload || typeof payload !== "object") throw new Error("Webhook payload must be an object.");
  const body = payload as Record<string, unknown>;
  const type = String(body.event || "");
  if (!supported.has(type)) return null;

  const subscription = entity(body, "subscription");
  const payment = entity(body, "payment");
  const refund = entity(body, "refund");
  const occurredAt = Number(
    body.created_at || refund?.created_at || payment?.created_at || subscription?.created_at || 0,
  );
  if (!Number.isFinite(occurredAt) || occurredAt <= 0) throw new Error("Webhook event timestamp missing.");

  return {
    type: type as RazorpayBillingEventType,
    occurredAt,
    subscription,
    payment,
    refund,
    providerSubscriptionId: String(
      subscription?.id || payment?.subscription_id || "",
    ).trim() || null,
    providerPaymentId: String(
      payment?.id || refund?.payment_id || "",
    ).trim() || null,
    providerRefundId: String(refund?.id || "").trim() || null,
  };
}

export function shouldApplyProviderEvent(currentTimestamp: number | null, incomingTimestamp: number) {
  return currentTimestamp == null || incomingTimestamp >= currentTimestamp;
}
