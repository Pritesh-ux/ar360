import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getMasterInvoiceHtml } from "@/server/billing/invoice.service";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { id } = await params;
  const html = await getMasterInvoiceHtml(id);
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
  const result = await sendEmail({
    to,
    subject: `Your AR360 invoice ${invoiceLabel}`,
    text: `Hello${invoice.buyer_name ? ` ${invoice.buyer_name}` : ""},\n\nPlease find your invoice ${invoiceLabel} attached below.\n\nThank you,\nAR360 Team`,
    html,
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
