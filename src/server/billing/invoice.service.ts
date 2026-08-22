import { randomUUID } from "crypto";
import {
  getBillingProfile,
  getCustomerFallbackProfile,
  getInvoiceByRazorpayPaymentId,
  getInvoiceForCustomer,
  insertInvoice,
  listAllInvoices,
  listInvoicesForCustomer,
  nextInvoiceNumber,
  upsertBillingProfile,
} from "./invoice.repository";
import { query } from "@/lib/db";
import { getAr360WordmarkHtml } from "@/lib/brand/ar360-logo";
import { absoluteUrl } from "@/lib/url";
import { billingInvoiceViewPath } from "@/lib/subscription/subscription-paths";
import {
  emailButton,
  emailDetails,
  emailGreeting,
  emailHeading,
  emailParagraph,
  emailSignOff,
  renderPremiumEmail,
} from "@/lib/email/templates/email-shell";
import type { BillingProfile, CreateInvoiceInput, InvoiceRow } from "./invoice.types";
import {
  bytesToInvoiceGb,
  entitlementsFromPriceSnapshot,
  formatPlanEntitlementLine,
  type InvoicePlanEntitlements,
} from "@/lib/billing/invoice-plan-entitlements";
import {
  resolveInvoiceSellerProfile,
  type InvoiceSellerProfile,
} from "@/lib/billing/invoice-seller";

const GST_RATE = 18;

function formatMoney(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatPlanLabel(planId: string) {
  const key = String(planId || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    basic: "Basic",
    starter: "Starter",
    professional: "Professional",
    pro: "Professional",
    business: "Business",
    enterprise: "Enterprise",
    free: "Free",
    trial: "Trial",
  };
  if (labels[key]) return labels[key];
  return String(planId || "Plan")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve human plan name for billing_plans + enterprise custom plans (ecp_*). */
export async function resolvePlanDisplayName(planId: string): Promise<string> {
  const id = String(planId || "").trim();
  if (!id) return "Plan";
  const mapped = formatPlanLabel(id);
  if (!id.startsWith("ecp_") && mapped !== id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) {
    return mapped;
  }
  try {
    const { query } = await import("@/lib/db");
    if (id.startsWith("ecp_")) {
      const rows = await query<{ name: string }>(
        "SELECT name FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1",
        [id],
      );
      if (rows[0]?.name) return rows[0].name;
    }
    const plans = await query<{ name: string }>(
      "SELECT name FROM billing_plans WHERE id = ? LIMIT 1",
      [id],
    );
    if (plans[0]?.name) return plans[0].name;
  } catch {
    // fall through
  }
  return mapped;
}

export async function resolvePlanEntitlements(planId: string): Promise<InvoicePlanEntitlements | null> {
  const id = String(planId || "").trim();
  if (!id) return null;
  try {
    if (id.startsWith("ecp_")) {
      const rows = await query<{
        product_limit: number | null;
        storage_limit_bytes: number | null;
        bandwidth_limit_bytes: number | null;
      }>(
        `SELECT product_limit, storage_limit_bytes, bandwidth_limit_bytes
           FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;
      const storageGb = bytesToInvoiceGb(row.storage_limit_bytes);
      const bandwidthGb = bytesToInvoiceGb(row.bandwidth_limit_bytes);
      return {
        products: row.product_limit == null ? null : Number(row.product_limit),
        storageGb,
        bandwidthGb,
        unlimitedProducts: row.product_limit == null,
        unlimitedStorage: storageGb == null,
        unlimitedBandwidth: bandwidthGb == null,
      };
    }

    const plans = await query<{
      products: number | null;
      storage_gb: number | null;
      bandwidth_gb: number | null;
      unlimited_storage?: number | null;
      unlimited_bandwidth?: number | null;
    }>(
      `SELECT products, storage_gb, bandwidth_gb, unlimited_storage, unlimited_bandwidth
         FROM billing_plans WHERE id = ? LIMIT 1`,
      [id],
    );
    const plan = plans[0];
    if (!plan) return null;
    const unlimitedStorage = Number(plan.unlimited_storage) === 1;
    const unlimitedBandwidth = Number(plan.unlimited_bandwidth) === 1;
    return {
      products: plan.products == null ? null : Number(plan.products),
      storageGb: unlimitedStorage ? null : plan.storage_gb == null ? null : Number(plan.storage_gb),
      bandwidthGb: unlimitedBandwidth ? null : plan.bandwidth_gb == null ? null : Number(plan.bandwidth_gb),
      unlimitedProducts: plan.products == null || Number(plan.products) < 0,
      unlimitedStorage,
      unlimitedBandwidth,
    };
  } catch {
    return null;
  }
}

export async function resolveInvoicePlanEntitlements(invoice: Pick<InvoiceRow, "plan_id" | "price_snapshot">) {
  return (
    entitlementsFromPriceSnapshot(invoice.price_snapshot) ||
    (await resolvePlanEntitlements(invoice.plan_id))
  );
}

export function formatPeriodLabel(period: string) {
  const key = String(period || "").toLowerCase();
  if (key === "yearly" || key === "annual" || key === "year") return "Yearly";
  if (key === "monthly" || key === "month") return "Monthly";
  return String(period || "—").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatInvoiceDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusMeta(status: string) {
  const key = String(status || "").toLowerCase();
  if (key === "paid") return { label: "Paid", bg: "#EEF9E0", fg: "#3D6600", border: "#C8E6A0" };
  if (key === "failed") return { label: "Failed", bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" };
  if (key === "void" || key === "refunded") {
    return { label: key === "void" ? "Void" : "Refunded", bg: "#F3F4F6", fg: "#4B5563", border: "#E5E7EB" };
  }
  return { label: "Draft", bg: "#F8FAFC", fg: "#64748B", border: "#E2E8F0" };
}

function addressFromProfile(profile: Partial<BillingProfile> | null) {
  if (!profile) return "";
  return [profile.address_line1, profile.address_line2, profile.city, profile.state, profile.postal_code, profile.country]
    .filter(Boolean)
    .join(", ");
}

function isSameState(profile: Partial<BillingProfile> | null, sellerState: string) {
  return (profile?.state || "").toLowerCase() === String(sellerState || "").toLowerCase();
}

/** GST-inclusive: amountPaise is what the customer paid (matches Razorpay). */
export function splitInclusiveGst(totalPaise: number) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
    throw new Error("Invoice total must be positive paise.");
  }
  const subtotalPaise = Math.round(totalPaise / (1 + GST_RATE / 100));
  const taxPaise = totalPaise - subtotalPaise;
  return { subtotalPaise, taxPaise, totalPaise };
}

/** CGST/SGST vs IGST split for inclusive totals — matches createTaxInvoice. */
export function computeInclusiveGstBreakdown(
  totalPaise: number,
  buyerState: string | null | undefined,
  sellerState: string,
) {
  const split = splitInclusiveGst(totalPaise);
  const sameState = isSameState({ state: buyerState ?? undefined }, sellerState);
  const cgstPaise = sameState ? Math.round(split.taxPaise / 2) : 0;
  const sgstPaise = sameState ? split.taxPaise - cgstPaise : 0;
  const igstPaise = sameState ? 0 : split.taxPaise;
  return {
    subtotalPaise: split.subtotalPaise,
    taxPaise: split.taxPaise,
    totalPaise: split.totalPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
  };
}

function buildInvoiceHtml(
  invoice: InvoiceRow,
  planDisplayName: string | undefined,
  seller: InvoiceSellerProfile,
  entitlements?: InvoicePlanEntitlements | null,
) {
  const invoiceUid = escapeHtml(invoice.invoice_uid);
  const invoiceNo = escapeHtml(invoice.invoice_number || invoice.invoice_uid);
  const sellerName = escapeHtml(seller.name);
  const sellerAddress = escapeHtml(seller.address);
  const sellerGstin = escapeHtml(invoice.seller_gstin || seller.gstin || "Not registered");
  const sellerState = escapeHtml(seller.state);
  const buyerName = escapeHtml(invoice.buyer_name || "Customer");
  const buyerEmail = escapeHtml(invoice.buyer_email || "");
  const buyerAddress = escapeHtml(invoice.buyer_address || "");
  const buyerGstin = escapeHtml(invoice.buyer_gstin || "—");
  const planLabel = escapeHtml(planDisplayName || formatPlanLabel(invoice.plan_id));
  const periodLabel = escapeHtml(formatPeriodLabel(invoice.period));
  const entitlementLine = escapeHtml(formatPlanEntitlementLine(entitlements));
  const supportEmail = escapeHtml(seller.supportEmail);
  const paymentId = invoice.razorpay_payment_id ? escapeHtml(invoice.razorpay_payment_id) : "";
  const status = statusMeta(invoice.status);
  const subtotal = invoice.subtotal_paise ?? invoice.amount_paise;
  const cgst = invoice.cgst_paise || 0;
  const sgst = invoice.sgst_paise || 0;
  const igst = invoice.igst_paise || 0;
  const taxPaise = (invoice.tax_paise ?? 0) || cgst + sgst + igst;
  const issued = formatInvoiceDate(invoice.created_at);
  const paidAt = formatInvoiceDate(invoice.paid_at);
  const totalLabel = formatMoney(invoice.total_paise);
  const pdfHref = `/api/billing/invoices/${invoiceUid}/download?format=pdf`;

  const taxDetailRows: string[] = [];
  if (cgst > 0) {
    taxDetailRows.push(
      `<tr><td>CGST (9% on ${formatMoney(subtotal)})</td><td class="num">${formatMoney(cgst)}</td></tr>`,
    );
  }
  if (sgst > 0) {
    taxDetailRows.push(
      `<tr><td>SGST (9% on ${formatMoney(subtotal)})</td><td class="num">${formatMoney(sgst)}</td></tr>`,
    );
  }
  if (igst > 0) {
    taxDetailRows.push(
      `<tr><td>IGST (18% on ${formatMoney(subtotal)})</td><td class="num">${formatMoney(igst)}</td></tr>`,
    );
  }

  const amountDueLine =
    invoice.status === "paid"
      ? `${totalLabel} INR · Paid${invoice.paid_at ? ` ${paidAt}` : ""}`
      : `${totalLabel} INR due`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${invoiceNo}</title>
  <style>
    @page { size: A4; margin: 0; }
    :root {
      --ink: #111111;
      --muted: #6B7280;
      --line: #E5E7EB;
      --lime: #B9FF2C;
      --lime-ink: #3D6600;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #E8EAED;
      color: var(--ink);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.92);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    .toolbar a, .toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .toolbar a.primary {
      border-color: #0A0B14;
      background: #0A0B14;
      color: #fff;
    }
    .toolbar a.primary:hover { background: #1a1b24; }
    .toolbar button:hover, .toolbar a:not(.primary):hover { background: #FAFAFA; }
    .sheet-wrap {
      padding: 28px 16px 40px;
      display: flex;
      justify-content: center;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      background: #fff;
      padding: 18mm 18mm 14mm;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
    }
    .sheet-body { flex: 1 1 auto; }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .top h1 {
      margin: 0;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .logo {
      display: flex;
      align-items: center;
      line-height: 0;
    }
    .logo img {
      display: block;
      width: 118px;
      height: 28px;
    }
    .meta {
      margin-top: 22px;
      font-size: 13px;
      line-height: 1.7;
      color: #374151;
    }
    .meta strong { color: var(--ink); font-weight: 700; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 28px;
    }
    .party .label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .party .name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .party p {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: #4B5563;
    }
    .due {
      margin-top: 28px;
      padding: 4px 0 18px;
      border-bottom: 1px solid var(--line);
    }
    .due .amount {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .due .badge {
      display: inline-flex;
      margin-left: 10px;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid ${status.border};
      background: ${status.bg};
      color: ${status.fg};
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      vertical-align: middle;
    }
    .due .ref {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.items th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      padding: 12px 8px;
      border-bottom: 1px solid var(--line);
    }
    table.items th.num, table.items td.num { text-align: right; }
    table.items th.qty, table.items td.qty { text-align: center; width: 48px; }
    table.items td {
      padding: 14px 8px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      vertical-align: top;
    }
    table.items .desc { font-weight: 700; }
    table.items .desc-sub {
      margin-top: 2px;
      font-size: 12px;
      color: var(--muted);
    }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    table.totals { width: 280px; border-collapse: collapse; }
    table.totals td {
      padding: 7px 0;
      font-size: 13px;
      color: #4B5563;
    }
    table.totals td.num { text-align: right; color: var(--ink); font-weight: 600; }
    table.totals tr.grand td {
      padding-top: 12px;
      border-top: 1px solid var(--ink);
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }
    .footer {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
      line-height: 1.55;
      flex-shrink: 0;
    }
    .footer a { color: var(--lime-ink); font-weight: 700; text-decoration: none; }
    @media print {
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm;
        height: 297mm;
      }
      .toolbar { display: none !important; }
      .sheet-wrap {
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .sheet {
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        margin: 0 !important;
        padding: 16mm 16mm 12mm !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        page-break-after: avoid;
      }
      .sheet-body { flex: 1 1 auto !important; }
      .footer { margin-top: auto !important; }
      .top { flex-direction: row !important; }
      .parties { grid-template-columns: 1fr 1fr !important; }
    }
    /* screen-only: avoid print preview picking up mobile layout */
    @media screen and (max-width: 820px) {
      .sheet {
        width: 100%;
        height: auto;
        min-height: 0;
        padding: 28px 20px;
      }
      .parties { grid-template-columns: 1fr; gap: 18px; }
      .top { flex-direction: column-reverse; }
      .footer { margin-top: 40px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a class="primary" href="${pdfHref}">Download PDF</a>
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div class="sheet-wrap">
    <article class="sheet">
      <div class="sheet-body">
      <div class="top">
        <h1>Invoice</h1>
        <div class="logo">
          ${getAr360WordmarkHtml({ tone: "light", height: 28 })}
        </div>
      </div>

      <div class="meta">
        <div><strong>Invoice number</strong>&nbsp;&nbsp;${invoiceNo}</div>
        <div><strong>Date of issue</strong>&nbsp;&nbsp;${issued}</div>
        <div><strong>${invoice.paid_at ? "Date paid" : "Status"}</strong>&nbsp;&nbsp;${invoice.paid_at ? paidAt : status.label}</div>
        ${paymentId ? `<div><strong>Payment ref</strong>&nbsp;&nbsp;${paymentId}</div>` : ""}
      </div>

      <div class="parties">
        <section class="party">
          <div class="label">${sellerName}</div>
          <div class="name">AR360</div>
          <p>${sellerAddress}</p>
          <p>State: ${sellerState}</p>
          <p>GSTIN: ${sellerGstin}</p>
          <p><a href="mailto:${supportEmail}">${supportEmail}</a></p>
        </section>
        <section class="party">
          <div class="label">Bill to</div>
          <div class="name">${buyerName}</div>
          ${buyerEmail ? `<p>${buyerEmail}</p>` : ""}
          <p>${buyerAddress || "—"}</p>
          <p>GSTIN: ${buyerGstin}</p>
        </section>
      </div>

      <div class="due">
        <div class="amount">${amountDueLine}<span class="badge">${status.label}</span></div>
        ${paymentId ? `<div class="ref">Paid via Razorpay · ${paymentId}</div>` : ""}
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="qty">Qty</th>
            <th class="num">Unit price</th>
            <th class="num">Tax</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="desc">${planLabel} Plan</div>
              <div class="desc-sub">${periodLabel} subscription · AR360 SaaS</div>
              ${entitlementLine ? `<div class="desc-sub">${entitlementLine}</div>` : ""}
            </td>
            <td class="qty">1</td>
            <td class="num">${formatMoney(subtotal)}</td>
            <td class="num">${GST_RATE}%</td>
            <td class="num">${formatMoney(subtotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tr><td>Subtotal</td><td class="num">${formatMoney(subtotal)}</td></tr>
          <tr><td>Total excluding tax</td><td class="num">${formatMoney(subtotal)}</td></tr>
          ${taxDetailRows.join("")}
          ${
            taxDetailRows.length === 0 && taxPaise > 0
              ? `<tr><td>GST (${GST_RATE}%)</td><td class="num">${formatMoney(taxPaise)}</td></tr>`
              : ""
          }
          <tr class="grand"><td>Amount ${invoice.status === "paid" ? "paid" : "due"}</td><td class="num">${totalLabel} INR</td></tr>
        </table>
      </div>
      </div>

      <footer class="footer">
        <div>${sellerName}</div>
        <div>GSTIN: ${sellerGstin} · This is a computer-generated tax invoice. No signature required.</div>
      </footer>
    </article>
  </div>
</body>
</html>`;
}

export async function saveBillingProfile(customerUid: string, input: Partial<BillingProfile>) {
  return upsertBillingProfile({ ...input, customer_uid: customerUid });
}

export async function getBillingProfileForCustomer(customerUid: string) {
  const profile = await getBillingProfile(customerUid);
  if (profile) return profile;
  return getCustomerFallbackProfile(customerUid);
}

async function resolveBuyerProfile(customerUid: string): Promise<Partial<BillingProfile> | null> {
  const profile = await getBillingProfile(customerUid);
  if (profile) return profile;
  return getCustomerFallbackProfile(customerUid);
}

export async function createTaxInvoice(input: CreateInvoiceInput) {
  const [profile, seller] = await Promise.all([
    resolveBuyerProfile(input.customerUid),
    resolveInvoiceSellerProfile(),
  ]);
  const invoiceNumber = await nextInvoiceNumber();
  const { subtotalPaise, taxPaise, totalPaise, cgstPaise, sgstPaise, igstPaise } =
    computeInclusiveGstBreakdown(input.amountPaise, profile?.state, seller.state);

  const draft = {
    invoice_uid: `INV_${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
    invoice_number: invoiceNumber,
    customer_uid: input.customerUid,
    subscription_id: input.subscriptionId || null,
    plan_id: input.planId,
    period: input.period,
    amount_paise: subtotalPaise,
    subtotal_paise: subtotalPaise,
    tax_paise: taxPaise,
    cgst_paise: cgstPaise,
    sgst_paise: sgstPaise,
    igst_paise: igstPaise,
    total_paise: totalPaise,
    currency: "INR",
    status: input.status || "paid",
    razorpay_payment_id: input.razorpayPaymentId || null,
    paid_at: input.paidAt || null,
    buyer_name: profile?.company_name || profile?.billing_name || "Customer",
    buyer_email: profile?.billing_email || null,
    buyer_gstin: profile?.gstin || null,
    buyer_address: addressFromProfile(profile),
    seller_gstin: seller.gstin || null,
    created_at: new Date().toISOString(),
  } as InvoiceRow;

  const planDisplayName = await resolvePlanDisplayName(input.planId);
  const entitlements = await resolvePlanEntitlements(input.planId);
  const priceSnapshot = entitlements ? { entitlements } : null;

  return insertInvoice({
    ...input,
    amountPaise: subtotalPaise,
    invoiceUid: draft.invoice_uid,
    invoiceNumber,
    subtotalPaise,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalPaise,
    buyerName: draft.buyer_name,
    buyerEmail: draft.buyer_email,
    buyerGstin: draft.buyer_gstin,
    buyerAddress: draft.buyer_address,
    sellerGstin: seller.gstin || null,
    invoiceHtml: buildInvoiceHtml(draft, planDisplayName, seller, entitlements),
    priceSnapshot,
  });
}

/** Idempotent invoice creation + payment link for canonical billing flow. */
export async function finalizePaymentInvoice(input: {
  customerUid: string;
  planId: string;
  period: "monthly" | "yearly";
  amountPaise: number;
  razorpayPaymentId?: string | null;
  orderUid?: string | null;
  subscriptionId?: number | null;
  paidAt?: string | null;
}) {
  if (input.razorpayPaymentId) {
    const existing = await getInvoiceByRazorpayPaymentId(input.razorpayPaymentId);
    if (existing) {
      if (input.orderUid) {
        await query(
          `UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?`,
          [existing.invoice_uid, input.orderUid],
        );
      }
      return existing;
    }
  }

  const invoice = await createTaxInvoice({
    customerUid: input.customerUid,
    planId: input.planId,
    period: input.period,
    amountPaise: input.amountPaise,
    status: "paid",
    razorpayPaymentId: input.razorpayPaymentId || null,
    subscriptionId: input.subscriptionId || null,
    paidAt: input.paidAt || null,
  });

  if (invoice?.invoice_uid) {
    if (input.orderUid) {
      await query(
        `UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?`,
        [invoice.invoice_uid, input.orderUid],
      );
    }
    if (input.razorpayPaymentId) {
      await query(
        `UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE razorpay_payment_id = ?`,
        [invoice.invoice_uid, input.razorpayPaymentId],
      );
    }
  }

  return invoice;
}

export async function getCustomerInvoices(customerUid: string) {
  return listInvoicesForCustomer(customerUid);
}

export async function getCustomerInvoice(customerUid: string, invoiceUid: string) {
  return getInvoiceForCustomer(customerUid, invoiceUid);
}

export async function getCustomerInvoiceHtml(customerUid: string, invoiceUid: string) {
  const invoice = await getInvoiceForCustomer(customerUid, invoiceUid);
  if (!invoice) return null;
  const [planDisplayName, seller, entitlements] = await Promise.all([
    resolvePlanDisplayName(invoice.plan_id),
    resolveInvoiceSellerProfile(),
    resolveInvoicePlanEntitlements(invoice),
  ]);
  return buildInvoiceHtml(invoice, planDisplayName, seller, entitlements);
}

export async function getMasterInvoiceHtml(invoiceUid: string) {
  const { resolveCanonicalInvoice } = await import("./invoice.repository");
  const invoice = await resolveCanonicalInvoice(invoiceUid);
  if (!invoice) return null;
  const [planDisplayName, seller, entitlements] = await Promise.all([
    resolvePlanDisplayName(invoice.plan_id),
    resolveInvoiceSellerProfile(),
    resolveInvoicePlanEntitlements(invoice),
  ]);
  return buildInvoiceHtml(invoice, planDisplayName, seller, entitlements);
}

/** Email-client safe invoice (hosted logo + table layout). Never reuse print HTML / data-URI logos. */
export function buildInvoiceEmailHtml(
  invoice: InvoiceRow,
  planDisplayName?: string,
  entitlements?: InvoicePlanEntitlements | null,
) {
  const invoiceNo = invoice.invoice_number || invoice.invoice_uid;
  const planLabel = planDisplayName || formatPlanLabel(invoice.plan_id);
  const periodLabel = formatPeriodLabel(invoice.period);
  const entitlementLine = formatPlanEntitlementLine(entitlements);
  const status = statusMeta(invoice.status);
  const issued = formatInvoiceDate(invoice.created_at);
  const paidAt = formatInvoiceDate(invoice.paid_at);
  const subtotal = invoice.subtotal_paise ?? invoice.amount_paise;
  const cgst = invoice.cgst_paise || 0;
  const sgst = invoice.sgst_paise || 0;
  const igst = invoice.igst_paise || 0;
  const taxPaise = (invoice.tax_paise ?? 0) || cgst + sgst + igst;
  const billingUrl = absoluteUrl(billingInvoiceViewPath(invoice.invoice_uid));
  const pdfUrl = absoluteUrl(`/api/billing/invoices/${invoice.invoice_uid}/download?format=pdf`);

  const details = [
    { label: "Invoice", value: invoiceNo },
    { label: "Plan", value: `${planLabel} · ${periodLabel}` },
    ...(entitlementLine ? [{ label: "Included", value: entitlementLine }] : []),
    { label: "Issued", value: issued },
    ...(invoice.paid_at ? [{ label: "Paid on", value: paidAt }] : [{ label: "Status", value: status.label }]),
    { label: "Subtotal", value: formatMoney(subtotal) },
    ...(taxPaise > 0 ? [{ label: `GST (${GST_RATE}%)`, value: formatMoney(taxPaise) }] : []),
    { label: invoice.status === "paid" ? "Amount paid" : "Amount due", value: `${formatMoney(invoice.total_paise)} INR` },
  ];

  const bodyHtml = [
    emailGreeting(invoice.buyer_name || "there"),
    emailHeading("Your invoice is ready"),
    emailParagraph(
      invoice.status === "paid"
        ? `Thanks for your payment. Invoice ${invoiceNo} is attached below for your records.`
        : `Invoice ${invoiceNo} is ready. You can review the details below or open billing in your dashboard.`,
    ),
    emailDetails(details),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background:#0A0B14;border-radius:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 4px;color:#B9FF2C;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Total</p>
          <p style="margin:0;color:#FAFAFA;font-size:28px;line-height:1.2;font-weight:700;">${escapeHtml(formatMoney(invoice.total_paise))} <span style="font-size:14px;font-weight:600;color:#A3A3A3;">INR</span></p>
          <p style="margin:8px 0 0;color:#A3A3A3;font-size:12px;">${escapeHtml(status.label)}${invoice.razorpay_payment_id ? ` · ${escapeHtml(invoice.razorpay_payment_id)}` : ""}</p>
        </td>
      </tr>
    </table>`,
    emailButton("View invoice", billingUrl),
    `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#737373;"><a href="${escapeHtml(pdfUrl)}" style="color:#0A0B14;font-weight:600;text-decoration:underline;">Download PDF invoice</a></p>`,
    emailSignOff(),
  ].join("");

  return renderPremiumEmail({
    preheader: `Invoice ${invoiceNo} · ${formatMoney(invoice.total_paise)} INR`,
    bodyHtml,
    bodyText: [
      `Hi ${invoice.buyer_name || "there"},`,
      "",
      "Your invoice is ready",
      `Invoice ${invoiceNo}`,
      `Plan: ${planLabel} · ${periodLabel}`,
      ...(entitlementLine ? [`Included: ${entitlementLine}`] : []),
      `Total: ${formatMoney(invoice.total_paise)} INR`,
      `View invoice: ${billingUrl}`,
      `PDF: ${pdfUrl}`,
    ].join("\n"),
  });
}

export async function getMasterInvoiceEmailHtml(invoiceUid: string) {
  const { resolveCanonicalInvoice } = await import("./invoice.repository");
  const invoice = await resolveCanonicalInvoice(invoiceUid);
  if (!invoice) return null;
  const planDisplayName = await resolvePlanDisplayName(invoice.plan_id);
  const entitlements = await resolveInvoicePlanEntitlements(invoice);
  return buildInvoiceEmailHtml(invoice, planDisplayName, entitlements);
}

export async function getMasterInvoices() {
  return listAllInvoices();
}

export { formatMoney };
