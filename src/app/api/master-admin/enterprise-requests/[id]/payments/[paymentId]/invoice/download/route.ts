import { NextRequest, NextResponse } from "next/server";
import { generateInvoicePdfBuffer } from "@/lib/billing/invoice-pdf";
import { getEnterprisePaymentInvoiceContext } from "@/lib/enterprise-sales";
import { paymentInvoiceMatchesRequest } from "@/lib/enterprise-sales/workflow-policy";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getInvoiceByUid } from "@/server/billing/invoice.repository";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, paymentId } = await params;
  const context = await getEnterprisePaymentInvoiceContext(id, paymentId);
  if (
    !context?.invoice_uid
    || !paymentInvoiceMatchesRequest(context, id, paymentId)
  ) {
    return NextResponse.json({ error: "Linked invoice not found" }, { status: 404 });
  }
  const invoice = await getInvoiceByUid(context.invoice_uid);
  if (!invoice) return NextResponse.json({ error: "Linked invoice not found" }, { status: 404 });
  const pdf = await generateInvoicePdfBuffer(invoice);
  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "enterprise_payment.invoice_downloaded",
    entityType: "enterprise_payment",
    entityId: paymentId,
    metadata: { requestUid: id, invoiceUid: invoice.invoice_uid },
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number || invoice.invoice_uid}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
