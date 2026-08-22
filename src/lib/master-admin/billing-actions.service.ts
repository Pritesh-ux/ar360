import { query } from "@/lib/db";
import { getBillingPlans } from "@/lib/billing/admin-plans";
import { getLedgerPaymentByUid } from "@/lib/billing/payment-ledger";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { createTaxInvoice, formatMoney } from "@/server/billing/invoice.service";
import {
  sendInvoiceEmail,
  sendSubscriptionStateEmail,
} from "@/lib/email/customer-lifecycle.service";

export type BillingFilterParams = {
  search?: string;
  plan?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function buildBillingWhere(params: BillingFilterParams) {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  const search = (params.search || "").trim().toLowerCase();

  if (search) {
    conditions.push(`(
      LOWER(COALESCE(c.contact_name, '')) LIKE ?
      OR LOWER(COALESCE(c.email, '')) LIKE ?
      OR LOWER(COALESCE(bi.invoice_number, bi.invoice_uid, '')) LIKE ?
      OR LOWER(COALESCE(bo.plan_id, '')) LIKE ?
    )`);
    const like = `%${search}%`;
    values.push(like, like, like, like);
  }
  if (params.dateFrom) {
    conditions.push("DATE(bp.created_at) >= ?");
    values.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push("DATE(bp.created_at) <= ?");
    values.push(params.dateTo);
  }
  if (params.plan) {
    conditions.push("COALESCE(bo.plan_id, '') = ?");
    values.push(params.plan);
  }
  if (params.status && params.status !== "all") {
    const raw =
      params.status === "Paid" ? "captured"
      : params.status === "Failed" ? "failed"
      : params.status === "Refunded" ? "refunded"
      : "created";
    conditions.push("bp.status = ?");
    values.push(raw);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function exportBillingCsv(params: BillingFilterParams) {
  const { where, values } = buildBillingWhere(params);
  const rows = await query<any>(`
    SELECT
      COALESCE(bi.invoice_number, bi.invoice_uid, CONCAT('INV-', bp.payment_uid)) AS invoice,
      COALESCE(c.contact_name, 'Unknown') AS customer,
      COALESCE(c.email, '') AS email,
      COALESCE(bo.plan_id, '') AS plan,
      ROUND(COALESCE(bi.amount_paise, bp.amount_paise) / 100) AS amount,
      ROUND(COALESCE(bi.tax_paise, 0) / 100) AS tax,
      ROUND(COALESCE(bi.total_paise, bp.amount_paise) / 100) AS total,
      bp.created_at AS date,
      CASE bp.status
        WHEN 'captured' THEN 'Paid'
        WHEN 'failed' THEN 'Failed'
        WHEN 'refunded' THEN 'Refunded'
        ELSE 'Pending'
      END AS status
    FROM billing_payments bp
    LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
    LEFT JOIN billing_invoices bi ON bi.invoice_uid = bp.invoice_uid
    LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
    ${where}
    ORDER BY bp.created_at DESC
    LIMIT 5000
  `, values);

  const header = ["Invoice", "Customer", "Email", "Plan", "Amount", "Tax", "Total", "Date", "Status"];
  const lines = rows.map((row) => [
    row.invoice,
    row.customer,
    row.email,
    row.plan,
    row.amount,
    row.tax,
    row.total,
    new Date(row.date).toISOString().slice(0, 10),
    row.status,
  ]);

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

async function resolvePlanAmountPaise(planId: string, period: "monthly" | "yearly") {
  const plans = await getBillingPlans({ activeOnly: false });
  const plan = plans.find((p) => p.id === planId);
  if (!plan) throw new Error("Plan not found.");
  const inr = period === "yearly" ? plan.priceYearlyInr : plan.priceMonthlyInr;
  if (inr === null || inr <= 0) throw new Error("Plan has no price configured.");
  return inr * 100;
}

export async function adminGenerateInvoice(input: {
  customerUid: string;
  planId: string;
  period: "monthly" | "yearly";
  amountPaise?: number;
  adminId?: number;
}) {
  const customerRows = await query<{ email: string; contact_name: string }>(
    "SELECT email, contact_name FROM customers WHERE customer_uid = ? LIMIT 1",
    [input.customerUid],
  );
  if (!customerRows[0]) throw new Error("Customer not found.");

  const amountPaise = input.amountPaise ?? (await resolvePlanAmountPaise(input.planId, input.period));
  const invoice = await createTaxInvoice({
    customerUid: input.customerUid,
    planId: input.planId,
    period: input.period,
    amountPaise,
    status: "draft",
  });

  await writeMasterAdminAudit({
    adminId: input.adminId,
    action: "invoice.generate",
    entityType: "invoice",
    entityId: invoice?.invoice_uid,
    metadata: { customerUid: input.customerUid, planId: input.planId, period: input.period },
  });

  if (invoice?.invoice_uid) {
    await sendInvoiceEmail({
      customerUid: input.customerUid,
      invoiceUid: invoice.invoice_uid,
      invoiceNumber: invoice.invoice_number,
      planId: input.planId,
      amountPaise: invoice.total_paise ?? amountPaise,
      status: invoice.status,
    }).catch(() => undefined);
  }

  return invoice;
}

export async function sendPaymentReminder(input: {
  paymentUid: string;
  adminId?: number;
}) {
  const payment = await getLedgerPaymentByUid(input.paymentUid);
  if (!payment) throw new Error("Payment not found.");
  if (payment.status !== "Pending") throw new Error("Only pending payments can receive reminders.");
  if (!payment.email) throw new Error("Customer email is missing.");

  const total = Number(payment.total || 0);
  const result = await sendEmail({
    to: payment.email,
    subject: `Payment reminder — ${payment.invoice}`,
    text: `Hello ${payment.customer},\n\nThis is a reminder that your ${payment.plan} subscription payment of ${formatMoney(total * 100)} is pending.\n\nInvoice: ${payment.invoice}\n\nPlease complete payment from your dashboard billing page.\n\nThank you,\nAR360 Team`,
    html: `<p>Hello ${payment.customer},</p><p>Your <strong>${payment.plan}</strong> payment of <strong>${formatMoney(total * 100)}</strong> is pending.</p><p>Invoice: ${payment.invoice}</p><p>Please complete payment from your dashboard.</p>`,
  });

  await writeMasterAdminAudit({
    adminId: input.adminId,
    action: "billing.payment_reminder",
    entityType: "payment",
    entityId: input.paymentUid,
    metadata: { to: payment.email, mode: result.mode },
  });

  return {
    delivered: result.delivered,
    mode: result.mode,
    message: result.delivered
      ? `Reminder sent to ${payment.email}.`
      : `Reminder logged (SMTP not configured). Recipient: ${payment.email}.`,
  };
}

export async function recordBillingRefund(input: {
  paymentUid: string;
  refundId?: string | null;
  note?: string;
  adminId?: number;
  amountPaise: number;
}) {
  await writeMasterAdminAudit({
    adminId: input.adminId,
    action: "billing.refund",
    entityType: "payment",
    entityId: input.paymentUid,
    metadata: { refundId: input.refundId, note: input.note, amountPaise: input.amountPaise },
  });

  const payments = await query<{ customer_uid: string; plan_id: string | null }>(
    `SELECT bp.customer_uid, bo.plan_id
       FROM billing_payments bp
       LEFT JOIN billing_orders bo ON bo.order_uid = bp.order_uid
      WHERE bp.payment_uid = ? LIMIT 1`,
    [input.paymentUid],
  ).catch(() => []);
  if (payments[0]?.customer_uid) {
    await sendSubscriptionStateEmail({
      customerUid: payments[0].customer_uid,
      state: "refunded",
      planId: payments[0].plan_id,
      amountPaise: input.amountPaise,
      eventKey: input.refundId || input.paymentUid,
    }).catch(() => undefined);
  }
}

export async function getInvoiceForDownload(invoiceUid: string) {
  const { resolveCanonicalInvoice } = await import("@/server/billing/invoice.repository");
  return resolveCanonicalInvoice(invoiceUid);
}
