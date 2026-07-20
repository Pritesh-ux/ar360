/**
 * Create billing_invoices for captured payments that have no linked invoice.
 * Usage: node scripts/backfill-invoices-from-payments.mjs [customer_uid]
 */
import mysql from "mysql2/promise";

const customerUid = process.argv[2] || "";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "arstudio",
});

const where = customerUid ? "AND bp.customer_uid = ?" : "";
const params = customerUid ? [customerUid] : [];

const [rows] = await conn.query(
  `SELECT bp.payment_uid, bp.customer_uid, bp.order_uid, bp.razorpay_payment_id, bp.amount_paise,
          bo.plan_id, bo.billing_period
     FROM billing_payments bp
     INNER JOIN billing_orders bo ON bo.order_uid = bp.order_uid
     LEFT JOIN billing_invoices bi ON bi.razorpay_payment_id = bp.razorpay_payment_id
    WHERE bp.status = 'captured'
      AND (bp.invoice_uid IS NULL OR bp.invoice_uid = '')
      AND bi.id IS NULL
      ${where}
    ORDER BY bp.created_at ASC`,
  params,
);

console.log(`Found ${rows.length} payment(s) without invoices.`);

for (const row of rows) {
  const period = row.billing_period === "yearly" ? "yearly" : "monthly";
  const totalPaise = Number(row.amount_paise);
  const subtotalPaise = Math.round(totalPaise / 1.18);
  const taxPaise = totalPaise - subtotalPaise;
  const invoiceUid = `INV_BACKFILL_${row.payment_uid.slice(-12).toUpperCase()}`;
  const invoiceNumber = `AR360/BF/${row.payment_uid.slice(-8).toUpperCase()}`;

  await conn.query(
    `INSERT INTO billing_invoices
       (invoice_uid, invoice_number, customer_uid, plan_id, period,
        amount_paise, subtotal_paise, tax_paise, cgst_paise, sgst_paise, igst_paise,
        total_paise, currency, status, razorpay_payment_id, paid_at, buyer_name)
     SELECT ?, ?, c.customer_uid, ?, ?,
            ?, ?, ?, ?, 0, 0,
            ?, 'INR', 'paid', ?, bp.created_at, COALESCE(c.company_name, c.contact_name)
       FROM customers c
       INNER JOIN billing_payments bp ON bp.payment_uid = ?
      WHERE c.customer_uid = ?
      LIMIT 1`,
    [
      invoiceUid,
      invoiceNumber,
      row.plan_id,
      period,
      subtotalPaise,
      subtotalPaise,
      taxPaise,
      Math.round(taxPaise / 2),
      totalPaise,
      row.razorpay_payment_id,
      row.payment_uid,
      row.customer_uid,
    ],
  );

  await conn.query(
    `UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE payment_uid = ?`,
    [invoiceUid, row.payment_uid],
  );

  console.log(`Invoice ${invoiceNumber} → ${row.customer_uid} (${row.plan_id})`);
}

console.log("Backfill complete.");
await conn.end();
