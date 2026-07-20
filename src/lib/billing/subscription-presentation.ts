export type CustomerSubscriptionState =
  | "trial"
  | "authorization_pending"
  | "authorization_failed"
  | "active"
  | "renewal_retry"
  | "paused"
  | "halted"
  | "cancellation_scheduled"
  | "ended"
  | "manual_enterprise";

export type SubscriptionStateInput = {
  status?: string | null;
  mandateStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  manualEnterprise?: boolean;
};

export function resolveCustomerSubscriptionState(input: SubscriptionStateInput): CustomerSubscriptionState {
  if (input.manualEnterprise) return "manual_enterprise";
  if (input.cancelAtPeriodEnd) return "cancellation_scheduled";
  const status = String(input.status || "").toLowerCase();
  if (["cancelled", "completed", "expired"].includes(status)) return "ended";
  if (status === "halted") return "halted";
  if (status === "paused") return "paused";
  if (["past_due", "grace"].includes(status)) return "renewal_retry";
  if (input.mandateStatus === "failed") return "authorization_failed";
  if (["pending", "pending_payment", "authenticated"].includes(status) || input.mandateStatus === "pending") {
    return "authorization_pending";
  }
  if (["trial", "trialing"].includes(status)) return "trial";
  return "active";
}

export function formatPaise(amountPaise?: number | null) {
  if (amountPaise == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

export function formatBillingDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(date);
}
