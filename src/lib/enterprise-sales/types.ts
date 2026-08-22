export const ENTERPRISE_STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  quoted: "Quoted",
  waiting_payment: "Waiting Payment",
  active: "Active",
  rejected: "Rejected",
  closed: "Closed",
} as const;

export type EnterpriseStatus = keyof typeof ENTERPRISE_STATUS_LABELS;
export type EnterpriseStatusLabel = (typeof ENTERPRISE_STATUS_LABELS)[EnterpriseStatus];
export type BillingCycle = "monthly" | "yearly";
export type QuoteStatus = "draft" | "sent" | "accepted" | "expired" | "rejected" | "superseded";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type ContractStatus = "draft" | "active" | "expired" | "cancelled" | "renewed";
export type CollectionStatus = "unpaid" | "partial" | "paid";
export type PaymentSource = "manual" | "razorpay_link";
export type EnterpriseEventType = "note" | "status_change" | "assignment" | "quote" | "payment" | "contract";

export interface EnterpriseRequestInput {
  companyName: string;
  contactName: string;
  businessEmail: string;
  phone: string;
  companyWebsite?: string | null;
  address: string;
  country: string;
  state: string;
  industry: string;
  expectedProducts?: number | null;
  expectedStorageGb?: number | null;
  expectedMonthlyBandwidthGb?: number | null;
  needsMoreStorage?: boolean;
  needsMoreBandwidth?: boolean;
  needsMoreProducts?: boolean;
  needsTeamMembers?: boolean;
  needsCustomBranding?: boolean;
  needsDedicatedInfrastructure?: boolean;
  needsPrioritySupport?: boolean;
  needsSla?: boolean;
  needsQr?: boolean;
  needsEmbed?: boolean;
  needsShare?: boolean;
  needsAr?: boolean;
  needsAnalytics?: boolean;
  additionalRequirements?: string | null;
  source?: string;
}

export interface EnterpriseRequest {
  id: number;
  requestUid: string;
  companyName: string;
  contactName: string;
  businessEmail: string;
  phone: string;
  companyWebsite: string | null;
  address: string | null;
  country: string;
  state: string | null;
  industry: string;
  expectedProducts: number | null;
  expectedStorageGb: number | null;
  expectedMonthlyBandwidthGb: number | null;
  needsMoreStorage: boolean;
  needsMoreBandwidth: boolean;
  needsMoreProducts: boolean;
  needsTeamMembers: boolean;
  needsCustomBranding: boolean;
  needsDedicatedInfrastructure: boolean;
  needsPrioritySupport: boolean;
  needsSla: boolean;
  needsQr: boolean;
  needsEmbed: boolean;
  needsShare: boolean;
  needsAr: boolean;
  needsAnalytics: boolean;
  additionalRequirements: string | null;
  assignedAdminId: number | null;
  assignedAdminName: string | null;
  status: EnterpriseStatus;
  statusLabel: EnterpriseStatusLabel;
  customerId: number | null;
  source: string;
  /** Set when password-setup / activation email was successfully recorded. */
  activationEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseRequestListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: EnterpriseStatus;
  country?: string;
  industry?: string;
  assignedAdminId?: number | null;
  createdFrom?: string;
  createdTo?: string;
}

/** Admin-editable capacity / interest fields on an Enterprise request. */
export type EnterpriseRequestRequirementsPatch = {
  expectedProducts?: number | null;
  expectedStorageGb?: number | null;
  expectedMonthlyBandwidthGb?: number | null;
  needsMoreStorage?: boolean;
  needsMoreBandwidth?: boolean;
  needsMoreProducts?: boolean;
  needsTeamMembers?: boolean;
  needsCustomBranding?: boolean;
  needsDedicatedInfrastructure?: boolean;
  needsPrioritySupport?: boolean;
  needsSla?: boolean;
  needsQr?: boolean;
  needsEmbed?: boolean;
  needsShare?: boolean;
  needsAr?: boolean;
  needsAnalytics?: boolean;
  additionalRequirements?: string | null;
};

export interface EnterpriseNoteInput {
  requestUid: string;
  adminId?: number | null;
  eventType?: EnterpriseEventType;
  body: string;
}

export interface EnterpriseCustomPlanInput {
  name: string;
  billingCycle: BillingCycle;
  pricePaise: number;
  storageLimitBytes?: number | null;
  bandwidthLimitBytes?: number | null;
  productLimit?: number | null;
  modelLimit?: number | null;
  arExperienceLimit?: number | null;
  teamMemberLimit?: number | null;
  customBranding?: boolean;
  allowViewer?: boolean;
  allowUpload?: boolean;
  allowAr?: boolean;
  allowQr?: boolean;
  allowShare?: boolean;
  allowEmbed?: boolean;
  allowObjectCapture?: boolean;
  allowCustomDomain?: boolean;
  advancedAnalytics?: boolean;
  qrLimit?: number | null;
  shareLinkLimit?: number | null;
  ocCapturesPerMonth?: number | null;
  ocComputeSecondsPerMonth?: number | null;
  ocConcurrentJobs?: number | null;
  ocMaxRetries?: number | null;
  prioritySupport?: boolean;
  dedicatedInfrastructure?: boolean;
  slaSupport?: boolean;
  supportLevel?: string | null;
  notes?: string | null;
  isActive?: boolean;
  isReusable?: boolean;
  createdByAdminId?: number | null;
}

export interface EnterpriseCustomPlan extends Omit<EnterpriseCustomPlanInput, "createdByAdminId"> {
  customPlanUid: string;
  createdByAdminId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseQuoteInput {
  requestUid: string;
  customPlanUid?: string | null;
  billingCycle: BillingCycle;
  pricePaise: number;
  currency?: string;
  validUntil: string;
  terms?: string | null;
  status?: QuoteStatus;
  createdByAdminId?: number | null;
}

export interface EnterprisePaymentInput {
  requestUid: string;
  quoteUid: string;
  contractUid?: string | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  amountPaise: number;
  currency?: string;
  paymentLink?: string | null;
  transactionId?: string | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  status?: PaymentStatus;
  notes?: string | null;
  dueAt?: string | null;
  installmentLabel?: string | null;
  source?: PaymentSource;
  providerPaymentLinkId?: string | null;
  createdByAdminId?: number | null;
}

export interface EnterpriseContractInput {
  requestUid: string;
  customerId: number;
  customPlanUid: string;
  subscriptionId?: number | null;
  startsOn: string;
  expiresOn: string;
  status?: ContractStatus;
  renewalOfContractUid?: string | null;
  createdByAdminId?: number | null;
}

export interface EnterpriseNote {
  noteUid: string;
  adminId: number | null;
  adminName: string | null;
  eventType: EnterpriseEventType;
  body: string;
  createdAt: string;
}

export interface EnterpriseQuote {
  quoteUid: string;
  customPlanUid: string | null;
  planName: string;
  quoteNumber: string;
  version: number;
  billingCycle: BillingCycle;
  pricePaise: number;
  currency: string;
  storageLimitBytes: number | null;
  bandwidthLimitBytes: number | null;
  productLimit: number | null;
  modelLimit: number | null;
  arExperienceLimit: number | null;
  teamMemberLimit: number | null;
  customBranding: boolean;
  prioritySupport: boolean;
  dedicatedInfrastructure: boolean;
  slaSupport: boolean;
  supportLevel: string | null;
  planNotes: string | null;
  validUntil: string;
  terms: string | null;
  status: QuoteStatus;
  collectionStatus: CollectionStatus;
  paidPaise: number;
  remainingPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterprisePayment {
  paymentUid: string;
  quoteUid: string;
  contractUid: string | null;
  invoiceId: number | null;
  invoiceUid: string | null;
  invoiceNumber: string | null;
  subscriptionId: number | null;
  amountPaise: number;
  currency: string;
  paymentLink: string | null;
  transactionId: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  status: PaymentStatus;
  notes: string | null;
  dueAt: string | null;
  installmentLabel: string | null;
  source: PaymentSource;
  providerPaymentLinkId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseBillSummary {
  quoteUid: string | null;
  quoteNumber: string | null;
  totalPaise: number;
  paidPaise: number;
  remainingPaise: number;
  currency: string;
  collectionStatus: CollectionStatus;
  installmentCount: number;
  paidInstallmentCount: number;
  customerUid: string | null;
  subscriptionStatus: string | null;
}

export interface EnterpriseContract {
  contractUid: string;
  customerId: number;
  customPlanUid: string;
  subscriptionId: number | null;
  startsOn: string;
  expiresOn: string;
  status: ContractStatus;
  renewalOfContractUid: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseRequestDetail extends EnterpriseRequest {
  notes: EnterpriseNote[];
  quotes: EnterpriseQuote[];
  payments: EnterprisePayment[];
  contracts: EnterpriseContract[];
  billSummary: EnterpriseBillSummary;
  /** Contract or latest-quote custom plan — used to edit live features after payment. */
  linkedCustomPlan?: EnterpriseCustomPlan | null;
}
