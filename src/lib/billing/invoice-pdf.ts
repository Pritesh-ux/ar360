import type { InvoiceRow } from "@/server/billing/invoice.types";
import {
  formatPeriodLabel,
  resolvePlanDisplayName,
} from "@/server/billing/invoice.service";

type PdfKitCtor = typeof import("pdfkit");

/** Load pdfkit via Node require so Helvetica.afm resolves under node_modules (not .next vendor-chunks). */
function loadPdfKit(): PdfKitCtor {
  // eslint-disable-next-line no-eval -- intentional: bypass webpack rewrite of require("pdfkit")
  const nodeRequire = eval("require") as NodeRequire;
  return nodeRequire("pdfkit") as PdfKitCtor;
}

/**
 * PDF built-in fonts (Helvetica) cannot render ₹ — it becomes a stray ¹.
 * Use ASCII "Rs." for PDFs; keep ₹ only in HTML/UI formatters.
 */
function money(paise: number) {
  return `Rs. ${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInvoiceDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function generateInvoicePdfBuffer(invoice: InvoiceRow): Promise<Buffer> {
  const PDFDocument = loadPdfKit();
  const planLabel = await resolvePlanDisplayName(invoice.plan_id);
  return new Promise((resolve, reject) => {
    // A4: 595.28 x 841.89 pt
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const sellerName = process.env.BILLING_SELLER_NAME || "AR360 Studio";
    const sellerAddress = process.env.BILLING_SELLER_ADDRESS || "India";
    const sellerState = process.env.BILLING_SELLER_STATE || "Gujarat";
    const sellerGstin = invoice.seller_gstin || process.env.BILLING_SELLER_GSTIN || "Not registered";
    const supportEmail = process.env.BILLING_SUPPORT_EMAIL || "support@ar360.studio";
    const invoiceNo = invoice.invoice_number || invoice.invoice_uid;
    const subtotal = invoice.subtotal_paise ?? invoice.amount_paise;
    const cgst = invoice.cgst_paise || 0;
    const sgst = invoice.sgst_paise || 0;
    const igst = invoice.igst_paise || 0;
    const periodLabel = formatPeriodLabel(invoice.period);
    const left = 54;
    const right = 541;
    const width = right - left;
    const totalLabel = money(invoice.total_paise);
    const issued = formatInvoiceDate(invoice.created_at);
    const paidAt = formatInvoiceDate(invoice.paid_at);
    const isPaid = String(invoice.status).toLowerCase() === "paid";

    // Title left + brand right
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(28).text("Invoice", left, 54);

    const brandX = right - 90;
    doc.roundedRect(brandX, 54, 22, 22, 4).lineWidth(2.5).strokeColor("#B9FF2C").stroke();
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(14).text("AR", brandX + 28, 58, {
      continued: true,
    });
    doc.fillColor("#84D400").text("360");

    let y = 100;

    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Invoice number", left, y, {
      continued: true,
    });
    doc.fillColor("#374151").font("Helvetica").text(`    ${invoiceNo}`);
    y += 16;
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Date of issue", left, y, {
      continued: true,
    });
    doc.fillColor("#374151").font("Helvetica").text(`    ${issued}`);
    y += 16;
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(invoice.paid_at ? "Date paid" : "Status", left, y, { continued: true });
    doc
      .fillColor("#374151")
      .font("Helvetica")
      .text(`    ${invoice.paid_at ? paidAt : String(invoice.status).toUpperCase()}`);
    y += 16;
    if (invoice.razorpay_payment_id) {
      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("Payment ref", left, y, {
        continued: true,
      });
      doc.fillColor("#374151").font("Helvetica").text(`    ${invoice.razorpay_payment_id}`);
      y += 16;
    }

    y += 18;
    const colW = (width - 24) / 2;

    doc.fillColor("#6B7280").font("Helvetica").fontSize(10).text(sellerName, left, y);
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(12).text("AR360", left, y + 16);
    doc
      .fillColor("#4B5563")
      .font("Helvetica")
      .fontSize(10)
      .text(`${sellerAddress}\nState: ${sellerState}\nGSTIN: ${sellerGstin}\n${supportEmail}`, left, y + 34, {
        width: colW,
        lineGap: 2,
      });

    const billX = left + colW + 24;
    doc.fillColor("#6B7280").font("Helvetica").fontSize(10).text("Bill to", billX, y);
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(invoice.buyer_name || "Customer", billX, y + 16, { width: colW });
    const buyerBlock = [
      invoice.buyer_email || "",
      invoice.buyer_address || "—",
      `GSTIN: ${invoice.buyer_gstin || "—"}`,
    ]
      .filter(Boolean)
      .join("\n");
    doc.fillColor("#4B5563").font("Helvetica").fontSize(10).text(buyerBlock, billX, y + 34, {
      width: colW,
      lineGap: 2,
    });

    y += 120;
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke();
    y += 16;

    const dueText = isPaid
      ? `${totalLabel} INR · Paid${invoice.paid_at ? ` ${paidAt}` : ""}`
      : `${totalLabel} INR due`;
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(16).text(dueText, left, y);
    y += 28;

    // Table header
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#E5E7EB")
      .stroke();
    y += 10;
    doc.fillColor("#6B7280").font("Helvetica").fontSize(10);
    doc.text("Description", left, y);
    doc.text("Qty", left + 250, y);
    doc.text("Unit price", left + 300, y);
    doc.text("Tax", left + 390, y);
    doc.text("Amount", left + 430, y, { width: width - 430, align: "right" });
    y += 16;
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#E5E7EB")
      .stroke();
    y += 12;

    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(11).text(`${planLabel} Plan`, left, y);
    doc
      .fillColor("#6B7280")
      .font("Helvetica")
      .fontSize(9)
      .text(`${periodLabel} subscription · AR360 SaaS`, left, y + 14);
    doc.fillColor("#111111").font("Helvetica").fontSize(10);
    doc.text("1", left + 250, y);
    doc.text(money(subtotal), left + 300, y);
    doc.text("18%", left + 390, y);
    doc.text(money(subtotal), left + 430, y, { width: width - 430, align: "right" });
    y += 40;
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#E5E7EB")
      .stroke();
    y += 16;

    const totals: Array<[string, string, boolean]> = [
      ["Subtotal", money(subtotal), false],
      ["Total excluding tax", money(subtotal), false],
    ];
    if (cgst > 0) totals.push([`CGST (9% on ${money(subtotal)})`, money(cgst), false]);
    if (sgst > 0) totals.push([`SGST (9% on ${money(subtotal)})`, money(sgst), false]);
    if (igst > 0) totals.push([`IGST (18% on ${money(subtotal)})`, money(igst), false]);
    totals.push([`Amount ${isPaid ? "paid" : "due"}`, `${totalLabel} INR`, true]);

    for (const [label, value, isGrand] of totals) {
      if (isGrand) {
        doc
          .moveTo(left + 260, y)
          .lineTo(right, y)
          .strokeColor("#111111")
          .stroke();
        y += 10;
      }
      doc
        .fillColor(isGrand ? "#111111" : "#4B5563")
        .font(isGrand ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isGrand ? 11 : 10)
        .text(label, left + 260, y, { width: 140 });
      doc
        .fillColor("#111111")
        .font(isGrand ? "Helvetica-Bold" : "Helvetica")
        .text(value, left + 400, y, { width: width - 400, align: "right" });
      y += isGrand ? 20 : 16;
    }

    // Footer pinned near A4 bottom
    const footerY = 780;
    doc
      .moveTo(left, footerY)
      .lineTo(right, footerY)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.fillColor("#6B7280").font("Helvetica").fontSize(9).text(sellerName, left, footerY + 12);
    doc.text(`GSTIN: ${sellerGstin} · Computer-generated tax invoice. No signature required.`, left, footerY + 24, {
      width,
    });

    doc.end();
  });
}
