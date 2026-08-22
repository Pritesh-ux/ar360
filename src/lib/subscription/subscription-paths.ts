export const SUBSCRIPTION_PATH = "/dashboard/subscription";
export const SUBSCRIPTION_EXPIRED_PATH = "/dashboard/subscription?expired=1";
export const BILLING_PATH = "/dashboard/billing";
export const BILLING_INVOICES_PATH = "/dashboard/billing?tab=invoices";
export const SETTINGS_PATH = "/dashboard/settings";

/** Deep-link from invoice emails — opens the Invoices tab and the HTML invoice view. */
export function billingInvoiceViewPath(invoiceUid: string) {
  const id = encodeURIComponent(String(invoiceUid || "").trim());
  return `/dashboard/billing?tab=invoices&invoice=${id}`;
}

/**
 * Expired/inactive customers may only reach the pages needed to pay again.
 * Everything else in the panel stays locked until the subscription is active.
 */
export const SUBSCRIPTION_EXEMPT_PREFIXES = [
  "/dashboard/subscription",
  "/dashboard/billing",
] as const;

export function isSubscriptionExemptPath(pathname: string) {
  const path = String(pathname || "").split("?")[0] || "";
  return SUBSCRIPTION_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
