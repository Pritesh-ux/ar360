import PDFDocument from "pdfkit";
import { drawAr360WordmarkOnPdf } from "@/lib/brand/ar360-logo";
import { formatQuoteDate, resolveQuoteServicePeriod } from "./quote-dates";

type QuoteDocument = {
  quote_number: string;
  version: number;
  plan_name: string;
  billing_cycle: "monthly" | "yearly";
  price_paise: number;
  currency: string;
  valid_until: string | Date;
  terms: string | null;
  company_name: string;
  contact_name: string;
  business_email: string;
  phone?: string | null;
  country?: string | null;
  created_at?: string | Date | null;
  storage_limit_bytes: number | null;
  bandwidth_limit_bytes: number | null;
  product_limit: number | null;
  model_limit: number | null;
  ar_experience_limit: number | null;
  team_member_limit: number | null;
  custom_branding: number | boolean;
  priority_support: number | boolean;
  dedicated_infrastructure: number | boolean;
  sla_support: number | boolean;
  support_level: string | null;
  plan_notes: string | null;
  period_starts_on?: string | Date | null;
  period_ends_on?: string | Date | null;
};

/** PDF fonts cannot render ₹ — use INR / Rs. */
function money(paise: number) {
  return `Rs. ${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function capacity(bytes: number | null, label: string) {
  if (bytes == null) return null;
  return `${label}: ${(Number(bytes) / 1024 ** 3).toLocaleString("en-IN")} GB`;
}

function truthy(value: number | boolean | null | undefined) {
  return Boolean(value);
}

/**
 * Cursor-style commercial quote: white page, no dark header bar.
 */
export async function generateEnterpriseQuotePdfBuffer(quote: QuoteDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      info: {
        Title: `AR360 Enterprise Quote ${quote.quote_number}`,
        Author: "AR360",
        Subject: "Enterprise commercial quote",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 54;
    const right = 541;
    const width = right - left;
    const ink = "#111111";
    const muted = "#6B7280";
    const soft = "#4B5563";
    const period = resolveQuoteServicePeriod(quote);
    const total = money(quote.price_paise);

    // Title + brand (landing wordmark)
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(28).text("Quote", left, 54);
    drawAr360WordmarkOnPdf(doc, right - 96, 54, 22);

    let y = 100;
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("Quote number", left, y, { continued: true });
    doc.fillColor(soft).font("Helvetica").text(`    ${quote.quote_number}  ·  v${quote.version}`);
    y += 16;
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("Date of issue", left, y, { continued: true });
    doc.fillColor(soft).font("Helvetica").text(`    ${formatQuoteDate(quote.created_at || new Date())}`);
    y += 16;
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("Valid until", left, y, { continued: true });
    doc.fillColor(soft).font("Helvetica").text(`    ${formatQuoteDate(quote.valid_until)}`);
    y += 28;

    const colW = (width - 24) / 2;
    doc.fillColor(muted).font("Helvetica").fontSize(10).text("AR360", left, y);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text("AR360 Studio", left, y + 16);
    doc.fillColor(soft).font("Helvetica").fontSize(10).text(
      "Enterprise commercial offer\nIndia",
      left,
      y + 34,
      { width: colW, lineGap: 2 },
    );

    const billX = left + colW + 24;
    doc.fillColor(muted).font("Helvetica").fontSize(10).text("Prepared for", billX, y);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(quote.company_name || "—", billX, y + 16, {
      width: colW,
    });
    const contact = [quote.contact_name, quote.business_email, quote.phone, quote.country]
      .filter(Boolean)
      .join("\n");
    doc.fillColor(soft).font("Helvetica").fontSize(10).text(contact || "—", billX, y + 34, {
      width: colW,
      lineGap: 2,
    });

    y += 110;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").lineWidth(1).stroke();
    y += 16;

    doc.fillColor(ink).font("Helvetica-Bold").fontSize(16).text(
      `${total} INR · ${quote.billing_cycle === "yearly" ? "Yearly" : "Monthly"}`,
      left,
      y,
    );
    y += 18;
    doc.fillColor(muted).font("Helvetica").fontSize(10).text(
      period.isEstimated
        ? `Estimated service: ${formatQuoteDate(period.startsOn)} → ${formatQuoteDate(period.endsOn)} (from first paid installment)`
        : `Service period: ${formatQuoteDate(period.startsOn)} → ${formatQuoteDate(period.endsOn)}`,
      left,
      y,
      { width },
    );
    y += 28;

    // Line items header
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").stroke();
    y += 10;
    doc.fillColor(muted).font("Helvetica").fontSize(10);
    doc.text("Description", left, y);
    doc.text("Qty", left + 280, y);
    doc.text("Amount", left + 360, y, { width: width - 360, align: "right" });
    y += 16;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").stroke();
    y += 12;

    doc.fillColor(ink).font("Helvetica-Bold").fontSize(11).text(quote.plan_name || "Enterprise Plan", left, y);
    doc.fillColor(muted).font("Helvetica").fontSize(9).text(
      `${quote.billing_cycle === "yearly" ? "Yearly" : "Monthly"} · Commercial quote (not a tax invoice)`,
      left,
      y + 14,
    );
    doc.fillColor(ink).font("Helvetica").fontSize(10);
    doc.text("1", left + 280, y);
    doc.text(total, left + 360, y, { width: width - 360, align: "right" });
    y += 40;

    const features = [
      capacity(quote.storage_limit_bytes, "Storage"),
      capacity(quote.bandwidth_limit_bytes, "Monthly bandwidth"),
      quote.product_limit == null ? null : `Products: ${quote.product_limit}`,
      quote.model_limit == null ? null : `3D models: ${quote.model_limit}`,
      quote.ar_experience_limit == null ? null : `AR experiences: ${quote.ar_experience_limit}`,
      quote.team_member_limit == null ? null : `Team members: ${quote.team_member_limit}`,
      truthy(quote.custom_branding) ? "Custom branding" : null,
      truthy(quote.priority_support) ? "Priority support" : null,
      truthy(quote.dedicated_infrastructure) ? "Dedicated infrastructure" : null,
      truthy(quote.sla_support) ? "SLA included" : null,
      quote.support_level ? `Support: ${quote.support_level}` : null,
    ].filter((item): item is string => Boolean(item));

    if (features.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text(features.join("  ·  "), left, y, {
        width,
        lineGap: 2,
      });
      y = doc.y + 16;
    }

    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").stroke();
    y += 16;

    const totals: Array<[string, string, boolean]> = [
      ["Subtotal", total, false],
      ["Amount quoted", `${total} INR`, true],
    ];
    for (const [label, value, isGrand] of totals) {
      if (isGrand) {
        doc.moveTo(left + 260, y).lineTo(right, y).strokeColor(ink).stroke();
        y += 10;
      }
      doc
        .fillColor(isGrand ? ink : soft)
        .font(isGrand ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isGrand ? 11 : 10)
        .text(label, left + 260, y, { width: 140 });
      doc
        .fillColor(ink)
        .font(isGrand ? "Helvetica-Bold" : "Helvetica")
        .text(value, left + 400, y, { width: width - 400, align: "right" });
      y += isGrand ? 20 : 16;
    }

    if (quote.terms) {
      y += 12;
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("Commercial terms", left, y);
      y += 14;
      doc.fillColor(soft).font("Helvetica").fontSize(9).text(String(quote.terms), left, y, {
        width,
        lineGap: 2,
      });
      y = doc.y + 12;
    }

    if (quote.plan_notes) {
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text("Plan notes", left, y);
      y += 14;
      doc.fillColor(soft).font("Helvetica").fontSize(9).text(String(quote.plan_notes), left, y, {
        width,
        lineGap: 2,
      });
    }

    const footerY = 780;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor("#E5E7EB").stroke();
    doc.fillColor(muted).font("Helvetica").fontSize(9).text(
      "This is a commercial quote, not a GST tax invoice. GST invoices are issued per paid installment.",
      left,
      footerY + 12,
      { width },
    );

    doc.end();
  });
}
