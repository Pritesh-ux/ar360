/** Canonical billing/usage error codes — safe for API responses. */
export const BillingErrorCode = {
  PLAN_NOT_FOUND: "PLAN_NOT_FOUND",
  PLAN_NOT_PURCHASABLE: "PLAN_NOT_PURCHASABLE",
  INVALID_BILLING_INTERVAL: "INVALID_BILLING_INTERVAL",
  UPGRADE_NOT_ALLOWED: "UPGRADE_NOT_ALLOWED",
  PRODUCT_LIMIT_REACHED: "PRODUCT_LIMIT_REACHED",
  MODEL_LIMIT_REACHED: "MODEL_LIMIT_REACHED",
  AR_EXPERIENCE_LIMIT_REACHED: "AR_EXPERIENCE_LIMIT_REACHED",
  STORAGE_LIMIT_REACHED: "STORAGE_LIMIT_REACHED",
  QR_LIMIT_REACHED: "QR_LIMIT_REACHED",
  SHARE_LINK_LIMIT_REACHED: "SHARE_LINK_LIMIT_REACHED",
  CHECKOUT_ALREADY_PENDING: "CHECKOUT_ALREADY_PENDING",
  PAYMENT_SIGNATURE_INVALID: "PAYMENT_SIGNATURE_INVALID",
  PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
  PAYMENT_ALREADY_PROCESSED: "PAYMENT_ALREADY_PROCESSED",
  SUBSCRIPTION_NOT_FOUND: "SUBSCRIPTION_NOT_FOUND",
  SUBSCRIPTION_CANNOT_RESUME: "SUBSCRIPTION_CANNOT_RESUME",
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
  INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
} as const;

export type BillingErrorCode = (typeof BillingErrorCode)[keyof typeof BillingErrorCode];

const USER_MESSAGES: Record<BillingErrorCode, string> = {
  PLAN_NOT_FOUND: "The selected plan is not available.",
  PLAN_NOT_PURCHASABLE: "This plan cannot be purchased online.",
  INVALID_BILLING_INTERVAL: "Please select a valid billing interval.",
  UPGRADE_NOT_ALLOWED: "You can only upgrade to a higher plan.",
  PRODUCT_LIMIT_REACHED: "You have reached your product limit. Upgrade your plan to create more products.",
  MODEL_LIMIT_REACHED: "You have reached your 3D model limit. Contact support to increase your allowance.",
  AR_EXPERIENCE_LIMIT_REACHED: "You have reached your AR experience limit. Contact support to increase your allowance.",
  STORAGE_LIMIT_REACHED:
    "You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",
  QR_LIMIT_REACHED: "You have reached your QR code limit. Upgrade your plan to create more QR codes.",
  SHARE_LINK_LIMIT_REACHED: "You have reached your share link limit. Upgrade your plan to create more links.",
  CHECKOUT_ALREADY_PENDING: "A checkout is already in progress. Complete or wait for it to expire before trying again.",
  PAYMENT_SIGNATURE_INVALID: "Payment verification failed. Please contact support if you were charged.",
  PAYMENT_NOT_FOUND: "Payment record not found.",
  PAYMENT_ALREADY_PROCESSED: "This payment has already been processed.",
  SUBSCRIPTION_NOT_FOUND: "Subscription not found.",
  SUBSCRIPTION_CANNOT_RESUME: "This subscription cannot be resumed.",
  WEBHOOK_SIGNATURE_INVALID: "Invalid webhook signature.",
  INVOICE_NOT_FOUND: "Invoice not found.",
};

export function billingErrorResponse(code: BillingErrorCode, status = 400) {
  return {
    status,
    body: {
      success: false,
      code,
      error: USER_MESSAGES[code] || "Request failed.",
    },
  };
}

export function billingErrorJson(code: BillingErrorCode, status = 400) {
  const { body } = billingErrorResponse(code, status);
  return body;
}
