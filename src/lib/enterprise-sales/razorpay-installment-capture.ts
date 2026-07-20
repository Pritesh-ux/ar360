import {
  getEnterprisePaymentInvoiceContext,
  getEnterpriseSalesRequest,
  settleEnterpriseInstallment,
} from "@/lib/enterprise-sales";
import { findEnterprisePaymentByRazorpayNotes } from "@/lib/enterprise-sales/razorpay-payment-link";
import { query } from "@/lib/db";

/**
 * When a Razorpay payment.captured event references an enterprise installment
 * (via payment notes or payment link id), mark it paid and run partial activation.
 */
export async function applyEnterpriseInstallmentCapture(input: {
  paymentId: string;
  amountPaise?: number | null;
  currency?: string | null;
  notes?: Record<string, unknown> | null;
  paymentLinkId?: string | null;
  capturedAt?: string | null;
  paymentMethod?: string | null;
}): Promise<{ handled: boolean; paymentUid?: string; requestUid?: string }> {
  const refs = await findEnterprisePaymentByRazorpayNotes(input.notes);
  let paymentUid = refs?.paymentUid || "";
  let requestUid = refs?.requestUid || "";

  if (!paymentUid && input.paymentLinkId) {
    const byLink = await query<{ payment_uid: string; request_uid: string }>(
      `SELECT p.payment_uid, r.request_uid
         FROM enterprise_payments p
         JOIN enterprise_requests r ON r.id = p.request_id
        WHERE p.provider_payment_link_id = ?
        LIMIT 1`,
      [input.paymentLinkId],
    ).catch(() => []);
    if (byLink[0]) {
      paymentUid = byLink[0].payment_uid;
      requestUid = byLink[0].request_uid;
    }
  }

  if (!paymentUid) {
    const byTxn = await query<{ payment_uid: string; request_uid: string }>(
      `SELECT p.payment_uid, r.request_uid
         FROM enterprise_payments p
         JOIN enterprise_requests r ON r.id = p.request_id
        WHERE p.transaction_id = ?
        LIMIT 1`,
      [input.paymentId],
    ).catch(() => []);
    if (byTxn[0]) {
      paymentUid = byTxn[0].payment_uid;
      requestUid = byTxn[0].request_uid;
    }
  }

  if (!paymentUid || !requestUid) {
    return { handled: false };
  }

  const enterpriseRequest = await getEnterpriseSalesRequest(requestUid);
  if (!enterpriseRequest) return { handled: false };

  const context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
  if (!context) return { handled: false };
  if (context.status === "paid") {
    return { handled: true, paymentUid, requestUid };
  }

  await settleEnterpriseInstallment(requestUid, paymentUid, {
    transactionId: input.paymentId,
    paymentMethod: input.paymentMethod || "razorpay",
    paidAt: input.capturedAt || new Date().toISOString(),
  });

  return { handled: true, paymentUid, requestUid };
}
