import { NextRequest, NextResponse } from "next/server";
import { startCustomerImpersonation } from "@/lib/auth";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: Context) {
  const auth = await guardAdminPermission("customers.impersonate");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const { id: customerUid } = await context.params;

  try {
    await startCustomerImpersonation(admin, customerUid);
    await writeMasterAdminAudit({
      adminId: admin.id,
      action: "customer.impersonate",
      entityType: "customer",
      entityId: customerUid,
      metadata: { adminEmail: admin.email },
    });

    return NextResponse.json({ ok: true, redirectUrl: "/dashboard" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impersonation failed." },
      { status: 400 },
    );
  }
}
