import { absoluteAppUrl } from "@/lib/email/templates/customer-lifecycle";
import { sendCustomerLifecycleEmail } from "@/lib/email/customer-delivery.service";

function planLabel(planId: string) {
  return planId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Not set";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatMoney(amountPaise?: number | null) {
  if (amountPaise === null || amountPaise === undefined) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amountPaise / 100);
}

export function sendWelcomeEmail(customerUid: string) {
  return sendCustomerLifecycleEmail({
    customerUid,
    category: "subscription",
    templateId: "customer_welcome",
    dedupeKey: "welcome:v1",
    respectPreferences: false,
    content: {
      subject: "Welcome to AR360 — your account is ready",
      title: "Welcome to AR360",
      intro: "Your AR360 account has been created successfully and your 24-hour trial is now active.",
      lines: [
        "You can start adding products, upload 3D models, and create interactive AR experiences from your dashboard.",
      ],
      actionLabel: "Open your dashboard",
      actionUrl: absoluteAppUrl("/dashboard"),
    },
  });
}

export function sendPlanActivatedEmail(input: {
  customerUid: string;
  planId: string;
  period?: string | null;
  periodEnd?: string | Date | null;
  amountPaise?: number | null;
  invoiceNumber?: string | null;
  eventKey: string;
}) {
  const details = [
    { label: "Plan", value: planLabel(input.planId) },
    ...(input.period ? [{ label: "Billing cycle", value: planLabel(input.period) }] : []),
    ...(input.periodEnd ? [{ label: "Valid until", value: formatDate(input.periodEnd) }] : []),
    ...(formatMoney(input.amountPaise)
      ? [{ label: "Amount paid", value: formatMoney(input.amountPaise)! }]
      : []),
    ...(input.invoiceNumber ? [{ label: "Invoice", value: input.invoiceNumber }] : []),
  ];
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "subscription",
    templateId: "plan_activated",
    dedupeKey: `plan-activated:${input.eventKey}`,
    content: {
      subject: `Your ${planLabel(input.planId)} plan is active`,
      title: "Your plan is now active",
      intro: `Your AR360 ${planLabel(input.planId)} plan has been activated successfully.`,
      details,
      actionLabel: "View plan and usage",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendPlanChangedEmail(input: {
  customerUid: string;
  planId: string;
  status: string;
  periodEnd?: string | Date | null;
  eventKey: string;
}) {
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "subscription",
    templateId: "plan_changed",
    dedupeKey: `plan-changed:${input.eventKey}`,
    content: {
      subject: `Your AR360 plan has been updated`,
      title: "Plan updated",
      intro: `Your account has been moved to the ${planLabel(input.planId)} plan.`,
      details: [
        { label: "Plan", value: planLabel(input.planId) },
        { label: "Status", value: planLabel(input.status) },
        ...(input.periodEnd ? [{ label: "Valid until", value: formatDate(input.periodEnd) }] : []),
      ],
      actionLabel: "Review your plan",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendInvoiceEmail(input: {
  customerUid: string;
  invoiceUid: string;
  invoiceNumber?: string | null;
  planId?: string | null;
  amountPaise?: number | null;
  status?: string | null;
}) {
  const invoiceLabel = input.invoiceNumber || input.invoiceUid;
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "billing",
    templateId: "invoice_ready",
    dedupeKey: `invoice:${input.invoiceUid}:${input.status || "created"}`,
    content: {
      subject: `Your AR360 invoice ${invoiceLabel}`,
      title: "Your invoice is ready",
      intro: `Invoice ${invoiceLabel} is now available in your AR360 billing dashboard.`,
      details: [
        ...(input.planId ? [{ label: "Plan", value: planLabel(input.planId) }] : []),
        ...(formatMoney(input.amountPaise)
          ? [{ label: "Total", value: formatMoney(input.amountPaise)! }]
          : []),
        ...(input.status ? [{ label: "Status", value: planLabel(input.status) }] : []),
      ],
      actionLabel: "View invoice",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendPaymentFailedEmail(input: {
  customerUid: string;
  planId?: string | null;
  amountPaise?: number | null;
  eventKey: string;
}) {
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "billing",
    templateId: "payment_failed",
    dedupeKey: `payment-failed:${input.eventKey}`,
    content: {
      subject: "Action needed: AR360 payment failed",
      title: "We could not process your payment",
      intro: "Your latest AR360 payment was unsuccessful. Please retry the payment to avoid interruption.",
      details: [
        ...(input.planId ? [{ label: "Plan", value: planLabel(input.planId) }] : []),
        ...(formatMoney(input.amountPaise)
          ? [{ label: "Amount", value: formatMoney(input.amountPaise)! }]
          : []),
      ],
      actionLabel: "Retry payment",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendSubscriptionStateEmail(input: {
  customerUid: string;
  state: "cancelled" | "resumed" | "refunded";
  planId?: string | null;
  effectiveAt?: string | Date | null;
  amountPaise?: number | null;
  eventKey: string;
}) {
  const title =
    input.state === "resumed"
      ? "Subscription resumed"
      : input.state === "refunded"
        ? "Refund completed"
        : "Subscription cancellation confirmed";
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: input.state === "refunded" ? "billing" : "subscription",
    templateId: `subscription_${input.state}`,
    dedupeKey: `subscription-${input.state}:${input.eventKey}`,
    content: {
      subject: `${title} — AR360`,
      title,
      intro:
        input.state === "resumed"
          ? "Your AR360 subscription has been resumed and will continue normally."
          : input.state === "refunded"
            ? "Your AR360 refund has been recorded successfully."
            : "Your AR360 subscription cancellation has been recorded.",
      details: [
        ...(input.planId ? [{ label: "Plan", value: planLabel(input.planId) }] : []),
        ...(input.effectiveAt
          ? [{ label: "Effective date", value: formatDate(input.effectiveAt) }]
          : []),
        ...(formatMoney(input.amountPaise)
          ? [{ label: "Refund amount", value: formatMoney(input.amountPaise)! }]
          : []),
      ],
      actionLabel: "Open billing",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendExpiryEmail(input: {
  customerUid: string;
  kind: "trial" | "plan";
  planId: string;
  expiresAt: string | Date;
  daysRemaining: number;
  eventKey: string;
}) {
  const expired = input.daysRemaining <= 0;
  const label = input.kind === "trial" ? "trial" : `${planLabel(input.planId)} plan`;
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "subscription",
    templateId: expired ? `${input.kind}_expired` : `${input.kind}_expiry_reminder`,
    dedupeKey: `${input.kind}-expiry:${input.eventKey}:${Math.max(0, input.daysRemaining)}`,
    content: {
      subject: expired
        ? `Your AR360 ${label} has expired`
        : `Your AR360 ${label} expires ${input.daysRemaining === 1 ? "tomorrow" : `in ${input.daysRemaining} days`}`,
      title: expired ? `${planLabel(label)} expired` : `${planLabel(label)} expiry reminder`,
      intro: expired
        ? `Your AR360 ${label} expired on ${formatDate(input.expiresAt)}.`
        : `Your AR360 ${label} will expire on ${formatDate(input.expiresAt)}.`,
      lines: [
        expired
          ? "Choose a plan to restore full access to your products and AR experiences."
          : "Renew or update your plan now to keep your service uninterrupted.",
      ],
      actionLabel: expired ? "Choose a plan" : "Renew plan",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}

export function sendUsageLimitEmail(input: {
  customerUid: string;
  resource: "storage" | "bandwidth";
  level: "warning" | "exceeded";
  usedGb: number;
  limitGb: number | null;
  eventKey: string;
}) {
  const resource = planLabel(input.resource);
  const exceeded = input.level === "exceeded";
  return sendCustomerLifecycleEmail({
    customerUid: input.customerUid,
    category: "usage",
    templateId: `usage_${input.resource}_${input.level}`,
    dedupeKey: `usage-email:${input.resource}:${input.level}:${input.eventKey}`,
    content: {
      subject: `${resource} ${exceeded ? "limit reached" : "usage warning"} — AR360`,
      title: `${resource} ${exceeded ? "limit reached" : "is almost full"}`,
      intro: exceeded
        ? `Your account has reached its ${input.resource} limit.`
        : `Your account is approaching its ${input.resource} limit.`,
      details: [
        { label: "Used", value: `${input.usedGb.toFixed(1)} GB` },
        { label: "Plan limit", value: input.limitGb === null ? "Unlimited" : `${input.limitGb.toFixed(1)} GB` },
      ],
      actionLabel: "Review usage and plans",
      actionUrl: absoluteAppUrl("/dashboard/billing"),
    },
  });
}
