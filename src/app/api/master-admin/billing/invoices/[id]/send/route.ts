import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getMasterInvoiceEmailHtml } from "@/server/billing/invoice.service";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { id: rawId } = await params;
  const { resolveCanonicalInvoice } = await import("@/server/billing/invoice.repository");
  const resolved = await resolveCanonicalInvoice(rawId);
  if (!resolved) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const id = resolved.invoice_uid;

  const html = await getMasterInvoiceEmailHtml(id);
  if (!html) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const rows = await query<{
    invoice_number: string | null;
    buyer_email: string | null;
    buyer_name: string | null;
    customer_uid: string;
  }>(
    `SELECT invoice_number, buyer_email, buyer_name, customer_uid
     FROM billing_invoices WHERE invoice_uid = ? LIMIT 1`,
    [id],
  );
  const invoice = rows[0];
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const to = invoice.buyer_email?.trim();
  if (!to) {
    return NextResponse.json({ error: "Customer email is missing on this invoice." }, { status: 400 });
  }

  const invoiceLabel = invoice.invoice_number || id;
  const text = `Hello${invoice.buyer_name ? ` ${invoice.buyer_name}` : ""},\n\nPlease find your invoice ${invoiceLabel} attached below.\n\nThank you,\nAR360 Team`;
  const result = await sendEmail({
    to,
    subject: `Your AR360 invoice ${invoiceLabel}`,
    text,
    html,
    template: "invoice_ready",
    metadata: {
      invoiceUid: id,
      invoiceNumber: invoice.invoice_number || invoiceLabel,
      customerUid: invoice.customer_uid,
      content: {
        title: "Your invoice is ready",
        intro: `Please find your invoice ${invoiceLabel} below.`,
        details: [
          { label: "Invoice", value: invoiceLabel },
          ...(invoice.buyer_name ? [{ label: "Customer", value: invoice.buyer_name }] : []),
        ],
      },
    },
  });

  await writeMasterAdminAudit({
    adminId: admin.id,
    action: "invoice.send_email",
    entityType: "invoice",
    entityId: id,
    metadata: { to, mode: result.mode, delivered: result.delivered },
  });

  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    mode: result.mode,
    message: result.delivered
      ? `Invoice sent to ${to}.`
      : result.mode === "console"
        ? `Invoice logged to console (SMTP not configured). Recipient: ${to}.`
        : `Invoice email skipped.`,
  });
}
