import { query } from "@/lib/db";
import type { BillingProfile, CreateInvoiceInput, InvoiceRow } from "./invoice.types";

export async function getBillingProfile(customerUid: string) {
  const rows = await query<BillingProfile>(
    "SELECT * FROM billing_profiles WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  );
  return rows[0] || null;
}

export async function upsertBillingProfile(input: Partial<BillingProfile> & { customer_uid: string }) {
  await query(
    `INSERT INTO billing_profiles
      (customer_uid, company_name, billing_name, billing_email, billing_phone, gstin, address_line1, address_line2, city, state, postal_code, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name), billing_name = VALUES(billing_name), billing_email = VALUES(billing_email),
      billing_phone = VALUES(billing_phone), gstin = VALUES(gstin), address_line1 = VALUES(address_line1),
      address_line2 = VALUES(address_line2), city = VALUES(city), state = VALUES(state), postal_code = VALUES(postal_code),
      country = VALUES(country), updated_at = NOW()`,
    [
      input.customer_uid,
      input.company_name || null,
      input.billing_name || null,
      input.billing_email || null,
      input.billing_phone || null,
      input.gstin || null,
      input.address_line1 || null,
      input.address_line2 || null,
      input.city || null,
      input.state || null,
      input.postal_code || null,
      input.country || "India",
    ],
  );
  return getBillingProfile(input.customer_uid);
}

export async function nextInvoiceNumber() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fy = `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;

  await query(
    `INSERT INTO invoice_counters (financial_year, last_number) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE last_number = last_number`,
    [fy],
  );
  await query("UPDATE invoice_counters SET last_number = last_number + 1 WHERE financial_year = ?", [fy]);
  const rows = await query<{ last_number: number }>(
    "SELECT last_number FROM invoice_counters WHERE financial_year = ? LIMIT 1",
    [fy],
  );
  return `AR360/${fy}/${String(rows[0]?.last_number || 1).padStart(5, "0")}`;
}

export async function insertInvoice(input: CreateInvoiceInput & {
  invoiceUid: string;
  invoiceNumber: string;
  subtotalPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerGstin?: string | null;
  buyerAddress?: string | null;
  sellerGstin?: string | null;
  invoiceHtml?: string | null;
  priceSnapshot?: unknown;
}) {
  await query(
    `INSERT INTO billing_invoices
      (invoice_uid, invoice_number, customer_uid, subscription_id, plan_id, period, amount_paise, subtotal_paise,
       tax_paise, cgst_paise, sgst_paise, igst_paise, total_paise, currency, status, razorpay_payment_id, paid_at,
       buyer_name, buyer_email, buyer_gstin, buyer_address, seller_gstin, invoice_html, price_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.invoiceUid,
      input.invoiceNumber,
      input.customerUid,
      input.subscriptionId || null,
      input.planId,
      input.period,
      input.amountPaise,
      input.subtotalPaise,
      input.taxPaise,
      input.cgstPaise,
      input.sgstPaise,
      input.igstPaise,
      input.totalPaise,
      input.status || "paid",
      input.razorpayPaymentId || null,
      input.paidAt || null,
      input.buyerName || null,
      input.buyerEmail || null,
      input.buyerGstin || null,
      input.buyerAddress || null,
      input.sellerGstin || null,
      input.invoiceHtml || null,
      input.priceSnapshot ? JSON.stringify(input.priceSnapshot) : null,
    ],
  );
  return getInvoiceByUid(input.invoiceUid);
}

export async function getInvoiceByUid(invoiceUid: string) {
  const rows = await query<InvoiceRow>("SELECT * FROM billing_invoices WHERE invoice_uid = ? LIMIT 1", [invoiceUid]);
  return rows[0] || null;
}

export async function getInvoiceByRazorpayPaymentId(razorpayPaymentId: string) {
  const rows = await query<InvoiceRow>(
    `SELECT * FROM billing_invoices
      WHERE razorpay_payment_id = ?
      ORDER BY
        CASE
          WHEN invoice_number LIKE 'AR360/%' THEN 0
          WHEN invoice_uid REGEXP '^INV_' THEN 1
          ELSE 2
        END,
        created_at DESC
      LIMIT 1`,
    [razorpayPaymentId],
  );
  return rows[0] || null;
}

/**
 * Resolve a downloadable/canonical invoice from invoice UID, payment UID,
 * Razorpay payment id, or legacy display ids like `INV-pay_...`.
 */
export async function resolveCanonicalInvoice(id: string) {
  const raw = String(id || "").trim();
  if (!raw) return null;

  const direct = await getInvoiceByUid(raw);
  if (direct && !String(direct.invoice_number || "").startsWith("RZP-") && !String(direct.invoice_uid).startsWith("inv_rzp_")) {
    return direct;
  }

  const paymentKey = raw.replace(/^INV-/i, "");
  const payments = await query<{
    payment_uid: string;
    invoice_uid: string | null;
    razorpay_payment_id: string | null;
  }>(
    `SELECT payment_uid, invoice_uid, razorpay_payment_id
       FROM billing_payments
      WHERE payment_uid = ? OR razorpay_payment_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [paymentKey, paymentKey],
  ).catch(() => []);

  const payment = payments[0];
  if (payment?.invoice_uid) {
    const linked = await getInvoiceByUid(payment.invoice_uid);
    if (linked && !String(linked.invoice_number || "").startsWith("RZP-") && !String(linked.invoice_uid).startsWith("inv_rzp_")) {
      return linked;
    }
  }
  if (payment?.razorpay_payment_id) {
    const byRzp = await getInvoiceByRazorpayPaymentId(payment.razorpay_payment_id);
    if (byRzp) return byRzp;
  }

  if (direct) return direct;
  return getInvoiceByRazorpayPaymentId(raw);
}

export async function getCustomerFallbackProfile(customerUid: string) {
  const rows = await query<{
    contact_name: string;
    company_name: string | null;
    email: string;
    phone: string | null;
    country: string | null;
  }>(
    "SELECT contact_name, company_name, email, phone, country FROM customers WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    company_name: row.company_name || row.contact_name,
    billing_name: row.contact_name,
    billing_email: row.email,
    billing_phone: row.phone,
    country: row.country || "India",
  } satisfies Partial<BillingProfile>;
}

export async function getInvoiceForCustomer(customerUid: string, invoiceUid: string) {
  const rows = await query<InvoiceRow>(
    "SELECT * FROM billing_invoices WHERE customer_uid = ? AND invoice_uid = ? LIMIT 1",
    [customerUid, invoiceUid],
  );
  return rows[0] || null;
}

export async function listInvoicesForCustomer(customerUid: string, limit = 50) {
  return query<InvoiceRow>(
    "SELECT * FROM billing_invoices WHERE customer_uid = ? ORDER BY created_at DESC LIMIT ?",
    [customerUid, limit],
  );
}

export async function listAllInvoices(limit = 100) {
  return query<InvoiceRow & { customer_name?: string | null; customer_email?: string | null }>(
    `SELECT bi.*,
            COALESCE(c.company_name, c.contact_name) AS customer_name,
            c.email AS customer_email
       FROM billing_invoices bi
       LEFT JOIN customers c ON c.customer_uid = bi.customer_uid
      ORDER BY bi.created_at DESC
      LIMIT ?`,
    [limit],
  );
}
