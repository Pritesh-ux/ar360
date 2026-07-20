import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { getLedgerPaymentByUid } from "@/lib/billing/payment-ledger";
import { recordBillingRefund } from "@/lib/master-admin/billing-actions.service";
import { getRazorpayClient } from "@/server/billing/razorpay";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await guardAdminPermission("billing.refund");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;
    const denied = await guardBillingMutation(req, `admin:${admin.id}`);
    if (denied) return denied;

    await ensureAppSchema();

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (body.confirm !== true || note.length < 5) {
      return NextResponse.json({ error: "Explicit confirmation and a refund reason of at least 5 characters are required." }, { status: 400 });
    }

    const payment = await getLedgerPaymentByUid(id);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    if (!["Paid", "Refunded"].includes(payment.status)) {
      return NextResponse.json({ error: "Only paid payments can be refunded." }, { status: 400 });
    }
    const paidPaise = Number(payment.amount_paise || payment.total * 100);
    const refundedRows = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount_paise),0) total FROM billing_refunds
       WHERE payment_uid = ? AND status IN ('created','pending','processed')`, [payment.id],
    ).catch(() => [{ total: 0 }]);
    const alreadyRefunded = Number(refundedRows[0]?.total || 0);
    const amountPaise = Number(body.amountPaise || paidPaise - alreadyRefunded);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > paidPaise - alreadyRefunded) {
      return NextResponse.json({ error: `Refund must be between 1 and ${Math.max(0, paidPaise - alreadyRefunded)} paise.` }, { status: 400 });
    }

    let refundId: string | null = null;
    let gatewayMessage = "";

    const billingPaymentId =
      payment.razorpay_payment_id && !payment.razorpay_payment_id.startsWith("manual")
        ? payment.razorpay_payment_id
        : null;

    if (payment.gateway === "Razorpay" && billingPaymentId) {
      try {
        const razorpay = await getRazorpayClient();
        const refund = await razorpay.payments.refund(billingPaymentId, {
          amount: amountPaise,
          notes: { reason: note || "Admin refund", payment_uid: payment.id },
        });
        refundId = refund.id;
        gatewayMessage = "Razorpay refund initiated.";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Razorpay refund failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    } else {
      gatewayMessage = payment.gateway === "Manual"
        ? "Manual refund recorded in AR360."
        : "No Razorpay payment id linked — marked refunded in AR360 only.";
    }

    const fullyRefunded = alreadyRefunded + amountPaise === paidPaise;
    await query(
      `UPDATE billing_payments
          SET status = ?, updated_at = NOW()
        WHERE payment_uid = ?`,
      [fullyRefunded ? "refunded" : "captured", payment.id],
    );

    await recordBillingRefund({
      paymentUid: payment.id,
      refundId,
      note,
      adminId: admin.id,
      amountPaise,
    });
    const refundUid = `refund_${crypto.randomUUID().replace(/-/g, "")}`;
    await query(`INSERT INTO billing_refunds
      (refund_uid, payment_uid, customer_uid, invoice_uid, provider, provider_mode,
       provider_payment_id, provider_refund_id, amount_paise, status, reason, admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status=VALUES(status), updated_at=NOW()`,
    [refundUid, payment.id, payment.customer_uid, payment.invoice || null,
      payment.gateway === "Razorpay" ? "razorpay" : "manual", payment.provider_mode || "test", billingPaymentId || payment.id,
      refundId, amountPaise, refundId ? "pending" : "processed", note, String(admin.id)]);
    if (payment.invoice) {
      const creditNoteUid = `cn_${crypto.randomUUID().replace(/-/g, "")}`;
      await query(`INSERT INTO billing_credit_notes
        (credit_note_uid, invoice_uid, refund_uid, credit_note_number, amount_paise, status, issued_at)
        VALUES (?, ?, ?, ?, ?, 'issued', NOW())`,
      [creditNoteUid, payment.invoice, refundUid, `CN-${Date.now()}`, amountPaise]);
      if (fullyRefunded) {
        await query("UPDATE billing_invoices SET status='refunded', updated_at=NOW() WHERE invoice_uid=?", [payment.invoice]).catch(() => undefined);
      }
    }

    return NextResponse.json({
      success: true,
      refundId,
      message: gatewayMessage,
      payment: {
        id: payment.id,
        status: fullyRefunded ? "Refunded" : "Partially Refunded",
      },
    });
  } catch (error) {
    console.error("[master-admin/payments/refund]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
