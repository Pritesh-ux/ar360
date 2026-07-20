import type { PaymentStatus } from "./types";

export function isDuplicateEntryError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
}

export function shouldRetryPublicRequestUid(error: unknown, attempt: number, maxAttempts = 3): boolean {
  return isDuplicateEntryError(error) && attempt + 1 < maxAttempts;
}

export function isActivationReplay(payment: {
  status: PaymentStatus;
  subscriptionId?: number | null;
  contractId?: number | null;
}): boolean {
  return payment.status === "paid"
    && Number(payment.subscriptionId) > 0
    && Number(payment.contractId) > 0;
}

export function effectiveActivationPaymentDetails(
  payment: {
    status: PaymentStatus;
    transactionId?: string | null;
    paymentMethod?: string | null;
    paidAt?: string | Date | null;
  },
  requested: { transactionId: string; paymentMethod?: string | null; paidAt: Date },
) {
  const replay = payment.status === "paid";
  return {
    transactionId: replay ? payment.transactionId || requested.transactionId : requested.transactionId,
    paymentMethod: replay ? payment.paymentMethod || requested.paymentMethod || null : requested.paymentMethod || null,
    paidAt: replay && payment.paidAt ? payment.paidAt : requested.paidAt,
  };
}

export function shouldIssueActivationPasswordSetup<T extends {
  activationEmailSent: boolean;
  firstActivation?: boolean;
}>(
  activation: T | null | undefined,
): activation is T {
  // Retry until delivered — not only on the first installment click.
  return Boolean(activation && !activation.activationEmailSent);
}

export function shouldMarkActivationEmailSent(delivered: boolean): boolean {
  return delivered;
}

export function renewalResultFromExisting(
  row: { request_uid?: string | null } | null | undefined,
): { requestUid: string; created: false } | null {
  return row?.request_uid ? { requestUid: row.request_uid, created: false } : null;
}

export function invoiceBelongsToCustomer(
  invoiceCustomerUid: string | null | undefined,
  customerUid: string,
): boolean {
  return Boolean(invoiceCustomerUid && invoiceCustomerUid === customerUid);
}

export function paymentInvoiceMatchesRequest(
  context: { request_uid?: string | null; payment_uid?: string | null },
  requestUid: string,
  paymentUid: string,
): boolean {
  return context.request_uid === requestUid && context.payment_uid === paymentUid;
}
