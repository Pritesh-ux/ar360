import { NextRequest, NextResponse } from "next/server";
import {
  EnterpriseSalesValidationError,
  generateEnterprisePaymentInvoice,
  getEnterpriseSalesRequest,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, paymentId } = await params;
  try {
    const invoice = await generateEnterprisePaymentInvoice(id, paymentId);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_payment.invoice_generated",
      entityType: "enterprise_payment",
      entityId: paymentId,
      metadata: { requestUid: id, invoiceUid: invoice.invoice_uid, invoiceNumber: invoice.invoice_number },
    });
    return NextResponse.json({
      ok: true,
      invoiceUid: invoice.invoice_uid,
      invoiceNumber: invoice.invoice_number,
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice generation failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
