import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send-email";
import { generateInvoicePdfBuffer } from "@/lib/billing/invoice-pdf";
import {
  getEnterprisePaymentInvoiceContext,
  getEnterpriseQuoteForDocument,
} from "@/lib/enterprise-sales";
import { generateEnterpriseQuotePdfBuffer } from "@/lib/enterprise-sales/quote-pdf";
import { paymentInvoiceMatchesRequest } from "@/lib/enterprise-sales/workflow-policy";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getInvoiceByUid } from "@/server/billing/invoice.repository";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await guardAdminPermission(
    ["enterprise_requests.manage", "customers.read", "billing.read"] as any,
    { request },
  );
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  const html = typeof body.html === "string" ? body.html : undefined;
  const paymentLink = typeof body.paymentLink === "string" ? body.paymentLink.trim() : "";

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!subject || subject.length > 200) {
    return NextResponse.json({ error: "Subject is required (max 200 chars)." }, { status: 400 });
  }
  if (!text || text.length > 20_000) {
    return NextResponse.json({ error: "Message body is required (max 20,000 chars)." }, { status: 400 });
  }

  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
  const attached: string[] = [];

  try {
    if (body.attachQuote && typeof body.attachQuote === "object") {
      const requestUid = String(body.attachQuote.requestUid || "");
      const quoteUid = String(body.attachQuote.quoteUid || "");
      const quote = await getEnterpriseQuoteForDocument(requestUid, quoteUid);
      if (!quote) return NextResponse.json({ error: "Quote not found for attachment." }, { status: 404 });
      const pdf = await generateEnterpriseQuotePdfBuffer(quote);
      attachments.push({
        filename: `${quote.quote_number || "quote"}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      });
      attached.push(`quote:${quote.quote_number}`);
    }

    if (body.attachInvoice && typeof body.attachInvoice === "object") {
      const requestUid = String(body.attachInvoice.requestUid || "");
      const paymentUid = String(body.attachInvoice.paymentUid || "");
      if (requestUid && paymentUid) {
        const context = await getEnterprisePaymentInvoiceContext(requestUid, paymentUid);
        if (
          !context?.invoice_uid
          || !paymentInvoiceMatchesRequest(context, requestUid, paymentUid)
        ) {
          return NextResponse.json({ error: "Invoice not found for that installment." }, { status: 404 });
        }
        const invoice = await getInvoiceByUid(context.invoice_uid);
        if (!invoice) {
          return NextResponse.json({ error: "Invoice record missing." }, { status: 404 });
        }
        const pdf = await generateInvoicePdfBuffer(invoice);
        attachments.push({
          filename: `${invoice.invoice_number || invoice.invoice_uid || "invoice"}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        });
        attached.push(`invoice:${invoice.invoice_number || invoice.invoice_uid}`);
      }
    }

    const bodyText = paymentLink ? `${text}\n\nPayment link:\n${paymentLink}` : text;
    const bodyHtml = html
      || `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>${
        paymentLink
          ? `<p><a href="${escapeHtml(paymentLink)}">Open payment link</a></p>`
          : ""
      }`;

    const delivery = await sendEmail({
      to,
      subject,
      text: bodyText,
      html: bodyHtml,
      template: "master-admin-compose",
      attachments,
    });

    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "compose_mail.sent",
      entityType: "email",
      entityId: to,
      metadata: {
        subject,
        attached,
        paymentLink: Boolean(paymentLink),
        delivered: delivery.delivered,
        mode: delivery.mode,
        requestUid: body.requestUid || null,
        customerUid: body.customerUid || null,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      delivered: delivery.delivered,
      mode: delivery.mode,
      attached,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 },
    );
  }
}
