import { NextRequest, NextResponse } from "next/server";
import {
  changeEnterprisePaymentStatus,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  insertEnterpriseNote,
  markEnterpriseActivationEmailSent,
  settleEnterpriseInstallment,
  type PaymentStatus,
} from "@/lib/enterprise-sales";
import { issueEnterpriseActivationPasswordSetup } from "@/lib/auth/password-reset";
import {
  shouldIssueActivationPasswordSetup,
  shouldMarkActivationEmailSent,
} from "@/lib/enterprise-sales/workflow-policy";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, paymentId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(paymentId)) {
    return NextResponse.json({ error: "Payment ID is invalid" }, { status: 400 });
  }
  try {
    if (!(await getEnterpriseSalesRequest(id))) {
      return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    }
    const status = typeof body.status === "string" ? body.status as PaymentStatus : "" as PaymentStatus;
    const details = {
      transactionId: typeof body.transactionId === "string" ? body.transactionId : null,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : null,
      paidAt: typeof body.paidAt === "string" ? body.paidAt : null,
      adminId: Number(auth.admin.id),
    };
    const activation = status === "paid"
      ? await settleEnterpriseInstallment(id, paymentId, details)
      : null;
    if (!activation) {
      await changeEnterprisePaymentStatus(id, paymentId, status, details);
      await insertEnterpriseNote({
        requestUid: id,
        adminId: Number(auth.admin.id),
        eventType: "payment",
        body: `Payment ${paymentId} marked ${status}`,
      });
    }
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: activation ? "enterprise_payment.paid_activated" : "enterprise_payment.status_changed",
      entityType: "enterprise_payment",
      entityId: paymentId,
      metadata: {
        requestUid: id,
        status,
        hasTransactionId: Boolean(body.transactionId),
        hasPaidAt: Boolean(body.paidAt),
        customerUid: activation?.customerUid,
        subscriptionId: activation?.subscriptionId,
        contractUid: activation?.contractUid,
        idempotentReplay: activation?.alreadyActivated,
      },
    });

    let activationEmail:
      | { attempted: boolean; delivered: boolean; message: string; devSetupUrl?: string }
      | undefined;
    if (shouldIssueActivationPasswordSetup(activation)) {
      try {
        const delivery = await issueEnterpriseActivationPasswordSetup({
          userId: activation.userId,
          email: activation.email,
          contactName: activation.contactName,
          companyName: (await getEnterpriseSalesRequest(id))?.companyName || "your company",
        });
        activationEmail = {
          attempted: true,
          delivered: delivery.delivered,
          message: delivery.mode,
          devSetupUrl: delivery.devSetupUrl,
        };
        if (shouldMarkActivationEmailSent(delivery.delivered)) {
          await markEnterpriseActivationEmailSent(id);
        }
      } catch (emailError) {
        console.error("[enterprise-activation] Setup email failed", emailError);
        activationEmail = {
          attempted: true,
          delivered: false,
          message: emailError instanceof Error ? emailError.message : "Email delivery failed",
        };
      }
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "enterprise_activation.email_attempted",
        entityType: "enterprise_request",
        entityId: id,
        metadata: { delivered: activationEmail.delivered, paymentUid: paymentId },
      });
    }
    return NextResponse.json({
      ok: true,
      activation,
      activationEmail,
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment update failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
