import type { BillingPeriod, ProviderMode } from "./subscription.types";

export type PriceVersion = {
  id: number;
  price_version_uid: string;
  plan_id: string;
  billing_interval: BillingPeriod;
  provider_mode: ProviderMode;
  version: number;
  currency: "INR";
  subtotal_paise: number;
  gst_rate: number;
  gst_paise: number;
  total_paise: number;
  gst_inclusive: 0 | 1;
  provider_plan_id: string | null;
  retired_at: string | null;
};

export type CheckoutSession = {
  checkout_session_uid: string;
  customer_uid: string;
  user_id: string | null;
  plan_id: string;
  price_version_id: number;
  billing_interval: BillingPeriod;
  provider_mode: ProviderMode;
  provider_subscription_id: string | null;
  status: "created" | "opened" | "completed" | "expired" | "cancelled" | "failed";
  idempotency_key: string;
  expires_at: string;
  start_at?: string | null;
  checkout_purpose?: "new_subscription" | "legacy_renewal";
};

export type NativeCheckoutResult = {
  flow: "subscription";
  checkoutSessionUid: string;
  razorpaySubscriptionId: string;
  keyId: string;
  amount: number;
  subtotal: number;
  gst: number;
  gstRate: number;
  gstInclusive: true;
  currency: "INR";
  planId: string;
  period: BillingPeriod;
  cadence: string;
  cancellationTerms: string;
  customer: { name: string; email: string };
  reused: boolean;
};
