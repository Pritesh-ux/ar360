import { query } from "@/lib/db";
import { uid } from "@/server/billing/razorpay";
import { finalizePaymentInvoice } from "@/server/billing/invoice.service";
import { activatePaidSubscription } from "@/server/billing/subscription.service";
import { addBillingHistory } from "@/server/billing/subscription.repository";
import type { BillingPeriod } from "@/server/billing/subscription.types";
import {
  sendInvoiceEmail,
  sendPlanActivatedEmail,
} from "@/lib/email/customer-lifecycle.service";

export type FinalizePaymentInput = {
  customerUid: string;
  orderUid: string;
  planId: string;
  period: BillingPeriod;
  amountPaise: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  rawPayload?: unknown;
};

function toMysqlDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function findPaymentByRazorpayId(razorpayPaymentId: string) {
  const rows = await query<{
    payment_uid: string;
    invoice_uid: string | null;
    order_uid: string;
  }>(
    `SELECT payment_uid, invoice_uid, order_uid
       FROM billing_payments
      WHERE razorpay_payment_id = ?
      LIMIT 1`,
    [razorpayPaymentId],
  );
  return rows[0] || null;
}

/** Canonical post-payment flow: subscription → order → payment → invoice → link. */
export async function finalizeSuccessfulPayment(input: FinalizePaymentInput) {
  const existing = await findPaymentByRazorpayId(input.razorpayPaymentId);
  if (existing?.invoice_uid) {
    return {
      planId: input.planId,
      period: input.period,
      invoiceUid: existing.invoice_uid,
      alreadyProcessed: true,
    };
  }

  // Captured payment row without invoice: resume invoice only — do NOT re-activate
  // (would extend period / reset bandwidth again on webhook retry).
  const resumeInvoiceOnly = Boolean(existing?.payment_uid);

  const subscription = resumeInvoiceOnly
    ? null
    : await activatePaidSubscription({
        customerUid: input.customerUid,
        planId: input.planId,
        period: input.period,
        amountPaise: input.amountPaise,
        razorpayPaymentId: input.razorpayPaymentId,
        resetBandwidth: true,
      });

  if (!resumeInvoiceOnly) {
    await query(`UPDATE billing_orders SET status = 'paid', updated_at = NOW() WHERE order_uid = ?`, [input.orderUid]);

    // Record coupon redemption if a coupon was applied
    try {
      const orderRows = await query<{ metadata: string | null }>(
        "SELECT metadata FROM billing_orders WHERE order_uid = ? LIMIT 1",
        [input.orderUid],
      );
      const meta = orderRows[0]?.metadata ? JSON.parse(orderRows[0].metadata) : null;
      if (meta?.couponUid) {
        const { recordCouponRedemption } = await import("@/lib/coupons/coupon-customer.service");
        const redemption = await recordCouponRedemption(
          meta.couponUid,
          input.customerUid,
          Number(meta.discountPaise || 0),
          input.orderUid,
        );
        if (!redemption.recorded && redemption.reason === "limit_reached") {
          console.warn(
            "[payment-finalize] coupon claim failed after payment (limit); order=%s coupon=%s",
            input.orderUid,
            meta.couponUid,
          );
        }
      }
    } catch (couponErr) {
      console.error("[payment-finalize] coupon redemption recording failed (non-fatal)", couponErr);
    }
  } else {
    await query(`UPDATE billing_orders SET status = 'paid', updated_at = NOW() WHERE order_uid = ?`, [input.orderUid]);
  }

  const paymentUid = existing?.payment_uid || uid("pay");

  await query(
    `INSERT INTO billing_payments
       (payment_uid, customer_uid, order_uid, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount_paise, currency, status, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'captured', ?)
     ON DUPLICATE KEY UPDATE
       status = 'captured',
       razorpay_signature = COALESCE(VALUES(razorpay_signature), razorpay_signature),
       raw_payload = COALESCE(VALUES(raw_payload), raw_payload),
       updated_at = NOW()`,
    [
      paymentUid,
      input.customerUid,
      input.orderUid,
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature || null,
      input.amountPaise,
      input.rawPayload ? JSON.stringify(input.rawPayload) : null,
    ],
  );

  const invoice = await finalizePaymentInvoice({
    customerUid: input.customerUid,
    planId: input.planId,
    period: input.period,
    amountPaise: input.amountPaise,
    razorpayPaymentId: input.razorpayPaymentId,
    orderUid: input.orderUid,
    subscriptionId: subscription?.id ?? null,
    paidAt: toMysqlDate(new Date()),
  });

  await query(
    `UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW()
     WHERE razorpay_payment_id = ? OR payment_uid = ?`,
    [invoice?.invoice_uid || null, input.razorpayPaymentId, paymentUid],
  );

  await addBillingHistory({
    customerUid: input.customerUid,
    subscriptionId: subscription?.id,
    eventType: "payment_captured",
    title: "Payment successful",
    description: `${input.planId} plan activated. Invoice ${invoice?.invoice_number || invoice?.invoice_uid || ""}.`,
    amountPaise: input.amountPaise,
    meta: {
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      invoiceUid: invoice?.invoice_uid,
    },
  });

  const { createCustomerNotification } = await import("@/lib/account/notify.service");
  void createCustomerNotification({
    customerUid: input.customerUid,
    category: "billing",
    title: "Payment successful",
    body: `Your ${input.planId} plan is now active.`,
    href: "/dashboard/billing",
    dedupeKey: `payment-success:${input.razorpayPaymentId}`,
  }).catch(() => {});

  // Emails must not block the checkout response — fire and forget.
  void Promise.allSettled([
    sendPlanActivatedEmail({
      customerUid: input.customerUid,
      planId: input.planId,
      period: input.period,
      periodEnd: subscription?.current_period_end,
      amountPaise: input.amountPaise,
      invoiceNumber: invoice?.invoice_number,
      eventKey: input.razorpayPaymentId,
    }),
    ...(invoice?.invoice_uid
      ? [
          sendInvoiceEmail({
            customerUid: input.customerUid,
            invoiceUid: invoice.invoice_uid,
            invoiceNumber: invoice.invoice_number,
            planId: input.planId,
            amountPaise: invoice.total_paise ?? input.amountPaise,
            status: invoice.status,
          }),
        ]
      : []),
  ]);

  return {
    planId: input.planId,
    period: input.period,
    invoiceUid: invoice?.invoice_uid || null,
    alreadyProcessed: false,
  };
}
