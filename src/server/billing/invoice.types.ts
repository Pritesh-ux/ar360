export type BillingProfile = {
  id: number;
  customer_uid: string;
  company_name?: string | null;
  billing_name?: string | null;
  billing_email?: string | null;
  billing_phone?: string | null;
  gstin?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type InvoiceRow = {
  id: number;
  invoice_uid: string;
  invoice_number?: string | null;
  customer_uid: string;
  subscription_id?: number | null;
  plan_id: string;
  period: "monthly" | "yearly";
  amount_paise: number;
  tax_paise: number;
  subtotal_paise?: number;
  cgst_paise?: number;
  sgst_paise?: number;
  igst_paise?: number;
  total_paise: number;
  currency: string;
  status: "draft" | "paid" | "failed" | "void" | "refunded";
  razorpay_payment_id?: string | null;
  paid_at?: string | null;
  due_at?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_gstin?: string | null;
  buyer_address?: string | null;
  seller_gstin?: string | null;
  invoice_html?: string | null;
  price_snapshot?: unknown;
  created_at: string;
};

export type CreateInvoiceInput = {
  customerUid: string;
  subscriptionId?: number | null;
  planId: string;
  period: "monthly" | "yearly";
  amountPaise: number;
  status?: "draft" | "paid";
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
};
