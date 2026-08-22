import {
  assignEnterpriseRequest,
  getEnterprisePaymentStatus,
  getEnterprisePaymentInvoiceContext,
  getEnterpriseRequest,
  getEnterpriseRequestDetail,
  insertEnterpriseContract,
  insertEnterpriseCustomPlan,
  insertEnterpriseNote,
  insertEnterprisePayment,
  insertEnterpriseQuote,
  insertEnterpriseRequest,
  linkEnterprisePaymentInvoice,
  listEnterpriseCustomPlans,
  listEnterpriseRequests,
  isCustomPlanLinkedToRequest,
  setEnterprisePaymentStatus,
  setEnterpriseCustomPlanActive,
  setEnterpriseRequestStatus,
  updateEnterpriseCustomPlanRow,
  updateEnterpriseRequestRequirements,
} from "./repository";
import {
  activatePaidEnterprisePayment,
  provisionEnterpriseCustomer,
  type EnterpriseActivationResult,
} from "./activation";
import { createTaxInvoice } from "@/server/billing/invoice.service";
import type {
  EnterpriseContractInput,
  EnterpriseCustomPlanInput,
  EnterprisePaymentInput,
  EnterpriseQuoteInput,
  EnterpriseRequestInput,
  EnterpriseRequestListFilters,
  EnterpriseRequestRequirementsPatch,
  EnterpriseStatus,
  PaymentStatus,
} from "./types";
import {
  assertPaymentTransition,
  assertStatusTransition,
  EnterpriseSalesValidationError,
  validateContract,
  validateCustomPlan,
  validateEnterpriseRequest,
  validateEnterpriseRequestRequirements,
  validatePayment,
  validateQuote,
} from "./validation";

export async function createPublicEnterpriseRequest(input: EnterpriseRequestInput): Promise<{ requestUid: string }> {
  const normalized = validateEnterpriseRequest(input);
  const requestUid = await insertEnterpriseRequest(normalized);

  await import("@/lib/master-admin/notifications")
    .then(({ createAdminNotification }) =>
      createAdminNotification({
        notificationUid: `enterprise-request:${requestUid}`,
        category: "customer",
        title: "New Enterprise quote request",
        body: `${normalized.companyName} · ${normalized.contactName} (${normalized.businessEmail}) · ${normalized.country}${normalized.state ? `, ${normalized.state}` : ""}`,
        href: `/master-admin/enterprise-requests/${requestUid}`,
      }),
    )
    .catch((error) => {
      console.error("[enterprise] admin notification failed", error);
    });

  return { requestUid };
}

export async function listEnterpriseSalesRequests(filters: EnterpriseRequestListFilters = {}) {
  return listEnterpriseRequests(filters);
}

export async function getEnterpriseSalesRequest(requestUid: string) {
  return getEnterpriseRequestDetail(requestUid.trim());
}

const STATUS_RANK: Partial<Record<EnterpriseStatus, number>> = {
  new: 0,
  contacted: 1,
  negotiating: 2,
  quoted: 3,
  waiting_payment: 4,
  active: 5,
};

export async function changeEnterpriseRequestStatus(
  requestUid: string,
  nextStatus: EnterpriseStatus,
  adminId?: number | null,
): Promise<void> {
  const current = await getEnterpriseRequest(requestUid);
  if (!current) throw new Error("Enterprise request not found");
  assertStatusTransition(current.status, nextStatus);
  await setEnterpriseRequestStatus(requestUid, nextStatus);
  await insertEnterpriseNote({
    requestUid,
    adminId,
    eventType: "status_change",
    body: `Status changed from ${current.statusLabel} to ${nextStatus.replace("_", " ")}`,
  });
}

/** Advance pipeline forward only (never regresses or touches rejected/closed). */
export async function advanceEnterpriseRequestStatus(
  requestUid: string,
  targetStatus: EnterpriseStatus,
  adminId?: number | null,
): Promise<boolean> {
  const current = await getEnterpriseRequest(requestUid);
  if (!current) return false;
  const fromRank = STATUS_RANK[current.status];
  const toRank = STATUS_RANK[targetStatus];
  if (fromRank == null || toRank == null || fromRank >= toRank) return false;
  assertStatusTransition(current.status, targetStatus);
  await setEnterpriseRequestStatus(requestUid, targetStatus);
  await insertEnterpriseNote({
    requestUid,
    adminId,
    eventType: "status_change",
    body: `Status advanced from ${current.statusLabel} to ${targetStatus.replace(/_/g, " ")}`,
  });
  return true;
}

export async function assignEnterpriseSalesRequest(
  requestUid: string,
  assignedAdminId: number | null,
  actorAdminId?: number | null,
): Promise<void> {
  if (!(await getEnterpriseRequest(requestUid))) throw new Error("Enterprise request not found");
  await assignEnterpriseRequest(requestUid, assignedAdminId);
  await insertEnterpriseNote({
    requestUid,
    adminId: actorAdminId,
    eventType: "assignment",
    body: assignedAdminId == null ? "Sales assignment cleared" : `Assigned to administrator ${assignedAdminId}`,
  });
}

export async function updateEnterpriseSalesRequestRequirements(
  requestUid: string,
  patch: EnterpriseRequestRequirementsPatch,
  actorAdminId?: number | null,
): Promise<void> {
  if (!(await getEnterpriseRequest(requestUid))) throw new Error("Enterprise request not found");
  const normalized = validateEnterpriseRequestRequirements(patch);
  await updateEnterpriseRequestRequirements(requestUid, normalized);
  await insertEnterpriseNote({
    requestUid,
    adminId: actorAdminId,
    eventType: "note",
    body: "Capacity & requirements updated by sales admin.",
  });
}

export async function addEnterpriseInternalNote(requestUid: string, body: string, adminId?: number | null) {
  const normalized = body.trim();
  if (!normalized) throw new EnterpriseSalesValidationError("Note body is required");
  if (normalized.length > 10_000) throw new EnterpriseSalesValidationError("Note body is too long");
  return insertEnterpriseNote({ requestUid, body: normalized, adminId, eventType: "note" });
}

export async function createEnterpriseCustomPlan(input: EnterpriseCustomPlanInput): Promise<{ customPlanUid: string }> {
  return { customPlanUid: await insertEnterpriseCustomPlan(validateCustomPlan(input)) };
}

export async function getReusableEnterpriseCustomPlans() {
  return listEnterpriseCustomPlans();
}

export async function changeEnterpriseCustomPlanAvailability(customPlanUid: string, isActive: boolean) {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(customPlanUid)) {
    throw new EnterpriseSalesValidationError("Custom plan ID is invalid");
  }
  if (!(await setEnterpriseCustomPlanActive(customPlanUid, isActive))) {
    throw new Error("Reusable custom plan not found");
  }
}

/**
 * Patch limits + feature gates on a custom plan already linked to this request
 * (quote or contract). Used when admin forgot toggles before Mark Paid.
 */
export async function updateEnterpriseCustomPlanForRequest(
  requestUid: string,
  customPlanUid: string,
  input: EnterpriseCustomPlanInput,
  adminId?: number | null,
): Promise<{ customPlanUid: string }> {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(customPlanUid)) {
    throw new EnterpriseSalesValidationError("Custom plan ID is invalid");
  }
  if (!(await isCustomPlanLinkedToRequest(requestUid, customPlanUid))) {
    throw new EnterpriseSalesValidationError(
      "Custom plan is not linked to this Enterprise request",
    );
  }
  const validated = validateCustomPlan(input);
  const ok = await updateEnterpriseCustomPlanRow(customPlanUid, validated);
  if (!ok) throw new Error("Custom plan not found");
  await insertEnterpriseNote({
    requestUid,
    adminId: adminId ?? null,
    eventType: "note",
    body: `Live plan features updated on ${customPlanUid} (${validated.name}).`,
  });
  return { customPlanUid };
}

export async function createEnterpriseQuote(input: EnterpriseQuoteInput): Promise<{ quoteUid: string }> {
  return { quoteUid: await insertEnterpriseQuote(validateQuote(input)) };
}

export async function generateEnterprisePaymentInvoice(requestUid: string, paymentUid: string) {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(paymentUid)) {
    throw new EnterpriseSalesValidationError("Payment ID is invalid");
  }
  let context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
  if (!context) throw new Error("Enterprise payment not found");
  if (context.invoice_id) throw new EnterpriseSalesValidationError("An invoice is already linked to this payment");
  if (!context.customer_uid) {
    // GST invoice needs a customer row — provision suspended account automatically
    // so admins don't have to click "Provision" before every first invoice.
    await provisionEnterpriseCustomer(requestUid);
    context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
    if (!context?.customer_uid) {
      throw new EnterpriseSalesValidationError(
        "Unable to provision Enterprise customer for GST invoice — check business email",
      );
    }
  }
  if (!context.custom_plan_uid) {
    throw new EnterpriseSalesValidationError("The payment quote has no selected custom plan");
  }
  const invoice = await createTaxInvoice({
    customerUid: context.customer_uid,
    planId: context.custom_plan_uid,
    period: context.billing_cycle,
    amountPaise: Number(context.amount_paise),
    status: context.status === "paid" ? "paid" : "draft",
    paidAt: context.status === "paid" ? context.paid_at : null,
  });
  if (!invoice) throw new Error("Invoice generation failed");
  await linkEnterprisePaymentInvoice(paymentUid, Number(invoice.id), invoice.invoice_number || null);
  await insertEnterpriseNote({
    requestUid,
    eventType: "payment",
    body: `GST invoice ${invoice.invoice_number || invoice.invoice_uid} generated for payment ${paymentUid}`,
  });
  return invoice;
}

export async function createEnterprisePayment(input: EnterprisePaymentInput): Promise<{ paymentUid: string }> {
  if (input.status === "paid") {
    throw new EnterpriseSalesValidationError(
      "Use settleNow / Mark Paid — payments are created pending then settled in one step",
    );
  }
  try {
    return { paymentUid: await insertEnterprisePayment(validatePayment(input)) };
  } catch (error) {
    if (error instanceof Error && /remaining balance|positive paise/i.test(error.message)) {
      throw new EnterpriseSalesValidationError(error.message);
    }
    throw error;
  }
}

/**
 * One-step settle: ensure GST invoice exists, then mark Paid + activate (first payment).
 * Transaction ID optional — auto receipt id if blank (cash / bank confirm).
 */
export async function settleEnterpriseInstallment(
  requestUid: string,
  paymentUid: string,
  details: {
    transactionId?: string | null;
    paymentMethod?: string | null;
    paidAt?: string | null;
    adminId?: number | null;
  } = {},
): Promise<EnterpriseActivationResult> {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(paymentUid)) {
    throw new EnterpriseSalesValidationError("Payment ID is invalid");
  }
  let context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
  if (!context) throw new Error("Enterprise payment not found");

  if (!context.invoice_id) {
    await generateEnterprisePaymentInvoice(requestUid, paymentUid);
    context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
  }
  if (!context?.invoice_id) {
    throw new EnterpriseSalesValidationError("Unable to generate GST invoice for this installment");
  }

  const transactionId = details.transactionId?.trim()
    || `RCPT-${paymentUid.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const paidAt = details.paidAt?.trim() || new Date().toISOString();
  if (Number.isNaN(Date.parse(paidAt))) {
    throw new EnterpriseSalesValidationError("Paid date is invalid");
  }

  return activatePaidEnterprisePayment(requestUid, paymentUid, "paid", {
    transactionId,
    paymentMethod: details.paymentMethod?.trim() || context.payment_method || "manual",
    paidAt,
    adminId: details.adminId,
  });
}

export async function changeEnterprisePaymentStatus(
  requestUid: string,
  paymentUid: string,
  nextStatus: PaymentStatus,
  details: { transactionId?: string | null; paymentMethod?: string | null; paidAt?: string | null } = {},
): Promise<void> {
  if (!["pending", "paid", "failed", "refunded"].includes(nextStatus)) {
    throw new EnterpriseSalesValidationError("Payment status is invalid");
  }
  const current = await getEnterprisePaymentStatus(requestUid, paymentUid);
  if (!current) throw new Error("Enterprise payment not found");
  assertPaymentTransition(current, nextStatus);
  if (nextStatus === "paid") {
    throw new EnterpriseSalesValidationError("Use settleEnterpriseInstallment to mark payments Paid");
  }
  if ((details.transactionId?.trim().length || 0) > 191 || (details.paymentMethod?.trim().length || 0) > 80) {
    throw new EnterpriseSalesValidationError("Transaction details are too long");
  }
  if (details.paidAt && Number.isNaN(Date.parse(details.paidAt))) {
    throw new EnterpriseSalesValidationError("Paid date is invalid");
  }
  await setEnterprisePaymentStatus(paymentUid, nextStatus, {
    transactionId: details.transactionId?.trim() || null,
    paymentMethod: details.paymentMethod?.trim() || null,
    paidAt: details.paidAt || null,
  });
}

export async function createEnterpriseContract(input: EnterpriseContractInput): Promise<{ contractUid: string }> {
  return { contractUid: await insertEnterpriseContract(validateContract(input)) };
}
