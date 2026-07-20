export type BillingPeriod = "monthly" | "yearly";
export type CanonicalPlanId = "trial" | "starter" | "pro" | "business" | "enterprise";
export type BillingSalesChannel = "self_service" | "manual" | "legacy";
export type ProviderMode = "test" | "live";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "paused"
  | "completed"
  | "pending_payment"
  | "past_due"
  | "cancelled"
  | "expired"
  | "grace";

export type BillingSubscription = {
  id: number;
  customer_uid: string;
  plan_id: string;
  period: BillingPeriod;
  status: SubscriptionStatus;
  razorpay_subscription_id?: string | null;
  razorpay_customer_id?: string | null;
  provider_plan_id?: string | null;
  provider_mode?: ProviderMode | null;
  provider_status?: string | null;
  mandate_status?: "pending" | "authorized" | "failed" | "revoked" | null;
  price_version_id?: number | null;
  checkout_session_uid?: string | null;
  sales_channel?: BillingSalesChannel;
  classification_status?: "canonical" | "contract_confirmed" | "ambiguous_legacy";
  term_mode?: "canonical" | "legacy_until_renewal";
  renewal_state?: string;
  renewal_invited_at?: string | null;
  renewal_consent_at?: string | null;
  renewal_checkout_session_uid?: string | null;
  renewal_provider_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  renewal_attempt_count?: number;
  next_retry_at?: string | null;
  halted_at?: string | null;
  cancelled_at?: string | null;
  cancel_at_period_end: 0 | 1;
  unlimited_storage?: 0 | 1;
  unlimited_bandwidth?: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type BillingHistoryEvent = {
  id: number;
  customer_uid: string;
  subscription_id?: number | null;
  event_type: string;
  title: string;
  description?: string | null;
  amount_paise?: number | null;
  currency: string;
  meta?: unknown;
  created_at: string;
};

export type BillingInvoice = {
  id: number;
  invoice_uid: string;
  customer_uid: string;
  subscription_id?: number | null;
  plan_id: string;
  period: BillingPeriod;
  amount_paise: number;
  tax_paise: number;
  total_paise: number;
  currency: string;
  status: "draft" | "paid" | "failed" | "void" | "refunded";
  razorpay_payment_id?: string | null;
  paid_at?: string | null;
  due_at?: string | null;
  created_at: string;
  updated_at: string;
};
