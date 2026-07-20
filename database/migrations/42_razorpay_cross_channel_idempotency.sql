-- Browser callbacks and webhook workers converge on the same provider objects.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_payment_razorpay_id
  ON billing_payments (razorpay_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_invoice_razorpay_payment
  ON billing_invoices (razorpay_payment_id);
