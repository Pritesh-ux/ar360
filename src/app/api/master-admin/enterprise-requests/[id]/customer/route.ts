import { NextRequest, NextResponse } from "next/server";
import {
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  provisionEnterpriseCustomer,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const customer = await provisionEnterpriseCustomer(id, Number(auth.admin.id));
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_customer.provisioned_for_invoice",
      entityType: "enterprise_request",
      entityId: id,
      metadata: {
        customerId: customer.customerId,
        customerUid: customer.customerUid,
        state: "Suspended",
      },
    });
    return NextResponse.json({
      ok: true,
      customer,
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer provisioning failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
