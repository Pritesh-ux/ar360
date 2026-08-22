import {
  ENTERPRISE_STATUS_LABELS,
  type EnterpriseContractInput,
  type EnterpriseCustomPlanInput,
  type EnterprisePaymentInput,
  type EnterpriseQuoteInput,
  type EnterpriseRequestInput,
  type EnterpriseRequestRequirementsPatch,
  type EnterpriseStatus,
  type PaymentStatus,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UID_RE = /^[A-Za-z0-9_-]{3,64}$/;

export class EnterpriseSalesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnterpriseSalesValidationError";
  }
}

function required(value: string, label: string, max: number): string {
  const normalized = value.trim();
  if (!normalized) throw new EnterpriseSalesValidationError(`${label} is required`);
  if (normalized.length > max) throw new EnterpriseSalesValidationError(`${label} is too long`);
  return normalized;
}

function optional(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim() || "";
  if (normalized.length > max) throw new EnterpriseSalesValidationError("A supplied value is too long");
  return normalized || null;
}

function nonNegativeInteger(value: number | null | undefined, label: string): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new EnterpriseSalesValidationError(`${label} must be a non-negative whole number`);
  }
  return value;
}

export function validateEnterpriseRequestRequirements(
  input: EnterpriseRequestRequirementsPatch,
): EnterpriseRequestRequirementsPatch {
  return {
    expectedProducts: nonNegativeInteger(input.expectedProducts, "Expected products"),
    expectedStorageGb: nonNegativeInteger(input.expectedStorageGb, "Expected storage"),
    expectedMonthlyBandwidthGb: nonNegativeInteger(
      input.expectedMonthlyBandwidthGb,
      "Expected monthly bandwidth",
    ),
    needsMoreStorage: Boolean(input.needsMoreStorage),
    needsMoreBandwidth: Boolean(input.needsMoreBandwidth),
    needsMoreProducts: Boolean(input.needsMoreProducts),
    needsTeamMembers: Boolean(input.needsTeamMembers),
    needsCustomBranding: Boolean(input.needsCustomBranding),
    needsDedicatedInfrastructure: Boolean(input.needsDedicatedInfrastructure),
    needsPrioritySupport: Boolean(input.needsPrioritySupport),
    needsSla: Boolean(input.needsSla),
    needsQr: Boolean(input.needsQr),
    needsEmbed: Boolean(input.needsEmbed),
    needsShare: Boolean(input.needsShare),
    needsAr: Boolean(input.needsAr),
    needsAnalytics: Boolean(input.needsAnalytics),
    additionalRequirements: optional(input.additionalRequirements, 10_000),
  };
}

export function validateEnterpriseRequest(input: EnterpriseRequestInput): EnterpriseRequestInput {
  const businessEmail = required(input.businessEmail, "Business email", 255).toLowerCase();
  if (!EMAIL_RE.test(businessEmail)) throw new EnterpriseSalesValidationError("Business email is invalid");

  const websiteInput = optional(input.companyWebsite, 500);
  let companyWebsite: string | null = null;
  if (websiteInput) {
    const candidate = /^https?:\/\//i.test(websiteInput) ? websiteInput : `https://${websiteInput}`;
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error();
      companyWebsite = parsed.toString();
    } catch {
      throw new EnterpriseSalesValidationError("Company website is invalid");
    }
  }

  return {
    companyName: required(input.companyName, "Company name", 191),
    contactName: required(input.contactName, "Contact name", 160),
    businessEmail,
    phone: required(input.phone, "Phone number", 40),
    companyWebsite,
    address: required(input.address, "Address", 500),
    country: required(input.country, "Country", 100),
    state: required(input.state, "State", 120),
    industry: required(input.industry, "Industry", 120),
    expectedProducts: nonNegativeInteger(input.expectedProducts, "Expected products"),
    expectedStorageGb: nonNegativeInteger(input.expectedStorageGb, "Expected storage"),
    expectedMonthlyBandwidthGb: nonNegativeInteger(
      input.expectedMonthlyBandwidthGb,
      "Expected monthly bandwidth",
    ),
    needsMoreStorage: Boolean(input.needsMoreStorage),
    needsMoreBandwidth: Boolean(input.needsMoreBandwidth),
    needsMoreProducts: Boolean(input.needsMoreProducts),
    needsTeamMembers: Boolean(input.needsTeamMembers),
    needsCustomBranding: Boolean(input.needsCustomBranding),
    needsDedicatedInfrastructure: Boolean(input.needsDedicatedInfrastructure),
    needsPrioritySupport: Boolean(input.needsPrioritySupport),
    needsSla: Boolean(input.needsSla),
    needsQr: Boolean(input.needsQr),
    needsEmbed: Boolean(input.needsEmbed),
    needsShare: Boolean(input.needsShare),
    needsAr: Boolean(input.needsAr),
    needsAnalytics: Boolean(input.needsAnalytics),
    additionalRequirements: optional(input.additionalRequirements, 10_000),
    source: optional(input.source, 80) || "pricing",
  };
}

export function validateCustomPlan(input: EnterpriseCustomPlanInput): EnterpriseCustomPlanInput {
  if (!["monthly", "yearly"].includes(input.billingCycle)) {
    throw new EnterpriseSalesValidationError("Billing cycle is invalid");
  }
  if (!Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0) {
    throw new EnterpriseSalesValidationError("Price must be a positive paise amount");
  }
  return {
    ...input,
    name: required(input.name, "Plan name", 160),
    storageLimitBytes: nonNegativeInteger(input.storageLimitBytes, "Storage limit"),
    bandwidthLimitBytes: nonNegativeInteger(input.bandwidthLimitBytes, "Bandwidth limit"),
    productLimit: nonNegativeInteger(input.productLimit, "Product limit"),
    modelLimit: nonNegativeInteger(input.modelLimit, "Model limit"),
    arExperienceLimit: nonNegativeInteger(input.arExperienceLimit, "AR experience limit"),
    teamMemberLimit: nonNegativeInteger(input.teamMemberLimit, "Team member limit"),
    customBranding: Boolean(input.customBranding),
    allowViewer: input.allowViewer !== false,
    allowUpload: input.allowUpload !== false,
    allowAr: input.allowAr !== false,
    allowQr: input.allowQr !== false,
    allowShare: input.allowShare !== false,
    allowEmbed: input.allowEmbed !== false,
    allowObjectCapture: input.allowObjectCapture !== false,
    allowCustomDomain: Boolean(input.allowCustomDomain),
    advancedAnalytics: Boolean(input.advancedAnalytics),
    qrLimit: nonNegativeInteger(input.qrLimit, "QR limit"),
    shareLinkLimit: nonNegativeInteger(input.shareLinkLimit, "Share link limit"),
    ocCapturesPerMonth: nonNegativeInteger(input.ocCapturesPerMonth, "OC captures/month"),
    ocComputeSecondsPerMonth: nonNegativeInteger(input.ocComputeSecondsPerMonth, "OC compute seconds/month"),
    ocConcurrentJobs: nonNegativeInteger(input.ocConcurrentJobs, "OC concurrent jobs"),
    ocMaxRetries: nonNegativeInteger(input.ocMaxRetries, "OC max retries"),
    prioritySupport: Boolean(input.prioritySupport),
    dedicatedInfrastructure: Boolean(input.dedicatedInfrastructure),
    slaSupport: Boolean(input.slaSupport),
    supportLevel: optional(input.supportLevel, 100),
    notes: optional(input.notes, 10_000),
  };
}

export function validateQuote(
  input: EnterpriseQuoteInput,
  today = new Date().toISOString().slice(0, 10),
): EnterpriseQuoteInput {
  if (!input.customPlanUid || !UID_RE.test(input.customPlanUid)) {
    throw new EnterpriseSalesValidationError("An active custom plan is required");
  }
  if (!["monthly", "yearly"].includes(input.billingCycle)) {
    throw new EnterpriseSalesValidationError("Billing cycle is invalid");
  }
  if (!Number.isSafeInteger(input.pricePaise) || input.pricePaise <= 0) {
    throw new EnterpriseSalesValidationError("Quote price must be a positive paise amount");
  }
  const currency = required(input.currency || "INR", "Currency", 3).toUpperCase();
  if (currency !== "INR") {
    throw new EnterpriseSalesValidationError("Enterprise quotes currently support INR only");
  }
  if (input.status && !["draft", "sent"].includes(input.status)) {
    throw new EnterpriseSalesValidationError("New quote status must be draft or sent");
  }
  const terms = optional(input.terms, 10_000);
  const validUntil = validateIsoDate(input.validUntil, "Quote validity");
  if (validUntil < today) {
    throw new EnterpriseSalesValidationError("Quote validity cannot be in the past");
  }
  return { ...input, customPlanUid: input.customPlanUid.trim(), currency, terms, validUntil };
}

export function validateIsoDate(value: string, label: string): string {
  const raw = String(value || "").trim();
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || raw.slice(0, 10);
  if (!DATE_RE.test(dateOnly) || Number.isNaN(Date.parse(`${dateOnly}T00:00:00`))) {
    throw new EnterpriseSalesValidationError(`${label} must be a valid YYYY-MM-DD date`);
  }
  return dateOnly;
}

export function validateContract(input: EnterpriseContractInput): EnterpriseContractInput {
  const startsOn = validateIsoDate(input.startsOn, "Contract start");
  const expiresOn = validateIsoDate(input.expiresOn, "Contract expiry");
  if (expiresOn < startsOn) throw new EnterpriseSalesValidationError("Contract expiry cannot precede its start");
  if (!Number.isSafeInteger(input.customerId) || input.customerId <= 0) {
    throw new EnterpriseSalesValidationError("Customer ID is invalid");
  }
  return { ...input, startsOn, expiresOn };
}

export function validatePayment(input: EnterprisePaymentInput): EnterprisePaymentInput {
  if (!UID_RE.test(input.requestUid) || !UID_RE.test(input.quoteUid)) {
    throw new EnterpriseSalesValidationError("Request or quote ID is invalid");
  }
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new EnterpriseSalesValidationError("Payment amount must be a positive paise amount");
  }
  if (input.paymentLink) {
    try {
      const url = new URL(input.paymentLink);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
    } catch {
      throw new EnterpriseSalesValidationError("Payment link must be a valid HTTPS URL");
    }
  }
  if (input.status === "paid" && (!input.transactionId?.trim() || !input.paidAt)) {
    throw new EnterpriseSalesValidationError("Paid payments require a transaction ID and paid date");
  }
  if (input.status && !["pending", "paid", "failed", "refunded"].includes(input.status)) {
    throw new EnterpriseSalesValidationError("Payment status is invalid");
  }
  if (input.paidAt && Number.isNaN(Date.parse(input.paidAt))) {
    throw new EnterpriseSalesValidationError("Paid date is invalid");
  }
  if (input.dueAt) {
    validateIsoDate(input.dueAt, "Installment due date");
  }
  return {
    ...input,
    currency: required(input.currency || "INR", "Currency", 3).toUpperCase(),
    paymentLink: optional(input.paymentLink, 2048),
    transactionId: optional(input.transactionId, 191),
    paymentMethod: optional(input.paymentMethod, 80),
    invoiceNumber: optional(input.invoiceNumber, 80),
    notes: optional(input.notes, 10_000),
    dueAt: input.dueAt || null,
    installmentLabel: optional(input.installmentLabel, 80),
    source: input.source === "razorpay_link" ? "razorpay_link" : "manual",
  };
}

/** Allow guided fulfill skips (e.g. new → quoted after first PDF) while keeping terminals strict. */
const STATUS_TRANSITIONS: Record<EnterpriseStatus, EnterpriseStatus[]> = {
  new: ["contacted", "negotiating", "quoted", "rejected", "closed"],
  contacted: ["negotiating", "quoted", "waiting_payment", "rejected", "closed"],
  negotiating: ["quoted", "waiting_payment", "rejected", "closed"],
  quoted: ["waiting_payment", "negotiating", "rejected", "closed"],
  waiting_payment: ["active", "negotiating", "quoted", "rejected", "closed"],
  active: ["closed"],
  rejected: [],
  closed: [],
};

export function assertStatusTransition(from: EnterpriseStatus, to: EnterpriseStatus): void {
  if (from === to) return;
  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    throw new EnterpriseSalesValidationError(
      `Cannot move Enterprise request from ${ENTERPRISE_STATUS_LABELS[from]} to ${ENTERPRISE_STATUS_LABELS[to]}`,
    );
  }
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["paid", "failed"],
  failed: ["pending", "paid"],
  paid: ["refunded"],
  refunded: [],
};

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (from === to) return;
  if (!PAYMENT_TRANSITIONS[from]?.includes(to)) {
    throw new EnterpriseSalesValidationError(`Cannot move payment from ${from} to ${to}`);
  }
}

export function isEnterpriseStatus(value: string): value is EnterpriseStatus {
  return Object.prototype.hasOwnProperty.call(ENTERPRISE_STATUS_LABELS, value);
}
