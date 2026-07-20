import { query } from "@/lib/db";
import { uid } from "@/server/billing/razorpay";

export type LedgerPaymentRow = {
  id: string;
  invoice: string;
  customer: string;
  email: string;
  plan: string;
  billing: string;
  amount: number;
  gst: number;
  total: number;
  status: string;
  gateway: string;
  transactionId: string;
  date: Date | string;
  paymentMethod: string;
  notes: string | null;
};

const LEDGER_PAYMENT_SELECT = `
  SELECT
    bp.payment_uid AS id,
    COALESCE(bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
    COALESCE(c.contact_name, 'Unknown') AS customer,
    COALESCE(c.email, '') AS email,
    COALESCE(bo.plan_id, '') AS plan,
    CASE LOWER(COALESCE(bo.billing_period, 'monthly'))
      WHEN 'yearly' THEN 'Yearly'
      ELSE 'Monthly'
    END AS billing,
    ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
    ROUND(COALESCE(bi.tax_paise, 0) / 100) AS gst,
    ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
    CASE bp.status
      WHEN 'captured' THEN 'Paid'
      WHEN 'failed' THEN 'Failed'
      WHEN 'refunded' THEN 'Refunded'
      ELSE 'Pending'
    END AS status,
    CASE
      WHEN bp.razorpay_payment_id IS NOT NULL AND bp.razorpay_payment_id != '' THEN 'Razorpay'
      WHEN bo.razorpay_order_id LIKE 'manual_%' THEN 'Manual'
      ELSE 'Razorpay'
    END AS gateway,
    COALESCE(NULLIF(bp.razorpay_payment_id, ''), bp.razorpay_order_id, '') AS transactionId,
    bp.created_at AS date,
    '' AS paymentMethod,
    NULL AS notes
  FROM billing_payments bp
  LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
  LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
  LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
`;

export async function listLedgerPayments(options?: { customerUid?: string; limit?: number }) {
  const limit = options?.limit ?? 500;
  const customerUid = options?.customerUid?.trim();

  if (customerUid) {
    return query<LedgerPaymentRow>(
      `${LEDGER_PAYMENT_SELECT}
       WHERE bp.customer_uid = ?
       ORDER BY bp.created_at DESC
       LIMIT ?`,
      [customerUid, limit],
    );
  }

  return query<LedgerPaymentRow>(
    `${LEDGER_PAYMENT_SELECT}
     ORDER BY bp.created_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function getLedgerPaymentByUid(paymentUid: string) {
  const rows = await query<
    LedgerPaymentRow & {
      customer_uid: string;
      amount_paise: number;
      raw_status: string;
      razorpay_payment_id: string | null;
      razorpay_order_id: string;
      provider_mode: "test" | "live" | null;
    }
  >(
    `SELECT
      bp.customer_uid,
      bp.amount_paise,
      bp.status AS raw_status,
      bp.razorpay_payment_id,
      bp.razorpay_order_id,
      bp.provider_mode,
      bp.payment_uid AS id,
      COALESCE(bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
      COALESCE(c.contact_name, 'Unknown') AS customer,
      COALESCE(c.email, '') AS email,
      COALESCE(bo.plan_id, '') AS plan,
      CASE LOWER(COALESCE(bo.billing_period, 'monthly'))
        WHEN 'yearly' THEN 'Yearly'
        ELSE 'Monthly'
      END AS billing,
      ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
      ROUND(COALESCE(bi.tax_paise, 0) / 100) AS gst,
      ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
      CASE bp.status
        WHEN 'captured' THEN 'Paid'
        WHEN 'failed' THEN 'Failed'
        WHEN 'refunded' THEN 'Refunded'
        ELSE 'Pending'
      END AS status,
      CASE
        WHEN bp.razorpay_payment_id IS NOT NULL AND bp.razorpay_payment_id != '' THEN 'Razorpay'
        WHEN bo.razorpay_order_id LIKE 'manual_%' THEN 'Manual'
        ELSE 'Razorpay'
      END AS gateway,
      COALESCE(NULLIF(bp.razorpay_payment_id, ''), bp.razorpay_order_id, '') AS transactionId,
      bp.created_at AS date,
      '' AS paymentMethod,
      NULL AS notes
    FROM billing_payments bp
    LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
    WHERE bp.payment_uid = ?
    LIMIT 1`,
    [paymentUid],
  );
  return rows[0] || null;
}

export async function getMonthlyCapturedRevenuePaise() {
  const rows = await query<{ total: number }>(`
    SELECT COALESCE(SUM(COALESCE(bi.total_paise, bp.amount_paise)), 0) AS total
    FROM billing_payments bp
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    WHERE bp.status = 'captured'
      AND bp.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
  `);
  return Number(rows[0]?.total || 0);
}

export async function createManualLedgerPayment(input: {
  customerUid: string;
  planId: string;
  billing: "Monthly" | "Yearly" | string;
  amountInr: number;
  gateway?: string;
  paymentMethod?: string;
  notes?: string;
}) {
  const amount = Math.round(Number(input.amountInr) || 0);
  const gst = Math.round(amount * 0.18);
  const total = amount + gst;
  const amountPaise = total * 100;
  const period = String(input.billing).toLowerCase() === "yearly" ? "yearly" : "monthly";
  const orderUid = uid("bo");
  const paymentUid = uid("pay");
  const manualOrderId = `manual_${Date.now()}_${paymentUid.slice(-6)}`;

  await query(
    `INSERT INTO billing_orders
       (order_uid, customer_uid, plan_id, billing_period, razorpay_order_id, amount_paise, currency, status, metadata)
     VALUES (?, ?, ?, ?, ?, ?, 'INR', 'created', ?)`,
    [
      orderUid,
      input.customerUid,
      input.planId,
      period,
      manualOrderId,
      amountPaise,
      JSON.stringify({ source: "master_admin_manual", notes: input.notes || null }),
    ],
  );

  await query(
    `INSERT INTO billing_payments
       (payment_uid, customer_uid, order_uid, razorpay_order_id, amount_paise, currency, status)
     VALUES (?, ?, ?, ?, ?, 'INR', 'created')`,
    [paymentUid, input.customerUid, orderUid, manualOrderId, amountPaise],
  );

  return {
    id: paymentUid,
    invoice: `INV-${paymentUid}`,
    amount,
    gst,
    total,
    status: "Pending",
    gateway: input.gateway || "Manual",
    transactionId: manualOrderId,
    paymentMethod: input.paymentMethod || "",
    notes: input.notes || "Manual payment created by admin.",
  };
}

export async function updateLedgerPaymentStatus(paymentUid: string, status: string) {
  const mapped =
    status === "Paid" ? "captured"
    : status === "Failed" ? "failed"
    : status === "Refunded" ? "refunded"
    : "created";

  await query(
    `UPDATE billing_payments SET status = ?, updated_at = NOW() WHERE payment_uid = ?`,
    [mapped, paymentUid],
  );

  if (mapped === "captured") {
    await query(
      `UPDATE billing_orders bo
       INNER JOIN billing_payments bp ON bp.order_uid = bo.order_uid
       SET bo.status = 'paid', bo.updated_at = NOW()
       WHERE bp.payment_uid = ?`,
      [paymentUid],
    );

    const rows = await query<{
      customer_uid: string;
      order_uid: string;
      plan_id: string;
      billing_period: string;
      amount_paise: number;
      invoice_uid: string | null;
      razorpay_order_id: string;
    }>(
      `SELECT bp.customer_uid, bp.order_uid, bp.amount_paise, bp.invoice_uid, bp.razorpay_order_id,
              bo.plan_id, bo.billing_period
         FROM billing_payments bp
         INNER JOIN billing_orders bo ON bo.order_uid = bp.order_uid
        WHERE bp.payment_uid = ?
        LIMIT 1`,
      [paymentUid],
    );

    const row = rows[0];
    if (row && !row.invoice_uid) {
      const { finalizePaymentInvoice } = await import("@/server/billing/invoice.service");
      const { activatePaidSubscription } = await import("@/server/billing/subscription.service");

      const period = row.billing_period === "yearly" ? "yearly" : "monthly";
      await activatePaidSubscription({
        customerUid: row.customer_uid,
        planId: row.plan_id,
        period,
        amountPaise: row.amount_paise,
        resetBandwidth: false,
      });

      await finalizePaymentInvoice({
        customerUid: row.customer_uid,
        planId: row.plan_id,
        period,
        amountPaise: row.amount_paise,
        razorpayPaymentId: row.razorpay_order_id.startsWith("manual_") ? row.razorpay_order_id : null,
        orderUid: row.order_uid,
        paidAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      });
    }
  }
}

export function formatLedgerPayment(row: LedgerPaymentRow) {
  const d = new Date(row.date);
  const dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  let expiryDate = "Expired";
  if (row.status === "Paid") {
    const exp = new Date(d);
    if (row.billing === "Yearly") exp.setFullYear(exp.getFullYear() + 1);
    else exp.setMonth(exp.getMonth() + 1);
    expiryDate = exp.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } else if (row.status === "Pending") {
    expiryDate = "Pending";
  }

  return {
    ...row,
    amount: Number(row.amount || 0),
    gst: Number(row.gst || 0),
    total: Number(row.total || 0),
    date: dateStr,
    expiryDate,
  };
}
