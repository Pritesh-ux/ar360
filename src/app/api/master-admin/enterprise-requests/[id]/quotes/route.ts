import { NextRequest, NextResponse } from "next/server";
import {
  createEnterpriseQuote,
  EnterpriseSalesValidationError,
  getEnterpriseQuoteForDocument,
  getEnterpriseSalesRequest,
  insertEnterpriseNote,
  setEnterpriseQuoteStatus,
} from "@/lib/enterprise-sales";
import { generateEnterpriseQuotePdfBuffer } from "@/lib/enterprise-sales/quote-pdf";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const enterpriseRequest = await getEnterpriseSalesRequest(id);
    if (!enterpriseRequest) return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    const result = await createEnterpriseQuote({
      requestUid: id,
      customPlanUid: typeof body.customPlanUid === "string" ? body.customPlanUid : null,
      billingCycle: body.billingCycle,
      pricePaise: Number(body.pricePaise),
      currency: "INR",
      validUntil: typeof body.validUntil === "string" ? body.validUntil : "",
      terms: typeof body.terms === "string" ? body.terms : null,
      status: "draft",
      createdByAdminId: Number(auth.admin.id),
    });
    await insertEnterpriseNote({
      requestUid: id,
      adminId: Number(auth.admin.id),
      eventType: "quote",
      body: `Quote ${result.quoteUid} created`,
    });
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_quote.created",
      entityType: "enterprise_quote",
      entityId: result.quoteUid,
      metadata: { requestUid: id, customPlanUid: body.customPlanUid, pricePaise: Number(body.pricePaise) },
    });

    let email: { attempted: boolean; delivered: boolean; message?: string } = { attempted: false, delivered: false };
    if (body.emailProspect === true) {
      email.attempted = true;
      try {
        const quote = await getEnterpriseQuoteForDocument(id, result.quoteUid);
        if (!quote) throw new Error("Quote document could not be loaded");
        const pdf = await generateEnterpriseQuotePdfBuffer(quote);
        const delivery = await sendEmail({
          to: enterpriseRequest.businessEmail,
          subject: `AR360 Enterprise quote ${quote.quote_number}`,
          text: `Hello ${enterpriseRequest.contactName},\n\nAttached is AR360 Enterprise quote ${quote.quote_number}, valid until ${quote.valid_until}.\n\nRegards,\nAR360 Team`,
          html: `<p>Hello ${escapeHtml(enterpriseRequest.contactName)},</p><p>Attached is your AR360 Enterprise quote <strong>${escapeHtml(quote.quote_number)}</strong>, valid until ${escapeHtml(String(quote.valid_until))}.</p><p>Regards,<br>AR360 Team</p>`,
          template: "enterprise-quote",
          attachments: [{ filename: `${quote.quote_number}.pdf`, content: pdf, contentType: "application/pdf" }],
        });
        email = { attempted: true, delivered: delivery.delivered, message: delivery.mode };
        if (delivery.delivered) await setEnterpriseQuoteStatus(result.quoteUid, "sent");
      } catch (emailError) {
        email = {
          attempted: true,
          delivered: false,
          message: emailError instanceof Error ? emailError.message : "Email delivery failed",
        };
      }
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "enterprise_quote.email_attempted",
        entityType: "enterprise_quote",
        entityId: result.quoteUid,
        metadata: { requestUid: id, delivered: email.delivered },
      });
    }
    return NextResponse.json({ ok: true, quoteUid: result.quoteUid, email, request: await getEnterpriseSalesRequest(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote creation failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
