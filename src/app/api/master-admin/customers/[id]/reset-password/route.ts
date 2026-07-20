import { NextRequest, NextResponse } from "next/server";
import { requestPasswordResetForCustomerUid } from "@/lib/auth/password-reset";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: Context) {
  const auth = await guardAdminPermission("customers.update");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id: customerUid } = await context.params;

  try {
    const result = await requestPasswordResetForCustomerUid(customerUid);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await writeMasterAdminAudit({
      adminId: admin.id,
      action: "customer.password_reset_sent",
      entityType: "customer",
      entityId: customerUid,
      metadata: {
        email: result.email,
        delivered: result.delivered,
        mode: result.mode,
      },
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      delivered: result.delivered,
      mode: result.mode,
      devResetUrl: result.devResetUrl,
      message: result.delivered
        ? `Password reset email sent to ${result.email}.`
        : `Reset link created but email was not delivered (${result.mode}). Check SMTP/Resend settings.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password reset failed." },
      { status: 500 },
    );
  }
}
