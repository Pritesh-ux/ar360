import { NextRequest, NextResponse } from "next/server";
import {
  createEnterprisePayment,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  insertEnterpriseNote,
  markEnterpriseActivationEmailSent,
  settleEnterpriseInstallment,
} from "@/lib/enterprise-sales";
import { createEnterpriseInstallmentWithRazorpayLink } from "@/lib/enterprise-sales/razorpay-payment-link";
import { issueEnterpriseActivationPasswordSetup } from "@/lib/auth/password-reset";
import {
  shouldIssueActivationPasswordSetup,
  shouldMarkActivationEmailSent,
} from "@/lib/enterprise-sales/workflow-policy";
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
    const createRazorpayLink = body.createRazorpayLink === true;
    const settleNow = body.settleNow === true && !createRazorpayLink;
    const paymentLinkValue = typeof body.paymentLink === "string" ? body.paymentLink.trim() : "";
    if (body.emailProspect === true && !createRazorpayLink && !paymentLinkValue) {
      throw new EnterpriseSalesValidationError("A payment link is required when emailing the prospect");
    }

    const paymentInput = {
      requestUid: id,
      quoteUid: typeof body.quoteUid === "string" ? body.quoteUid : "",
      amountPaise: Number(body.amountPaise),
      currency: "INR",
      paymentLink: paymentLinkValue || null,
      transactionId: typeof body.transactionId === "string" ? body.transactionId : null,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : null,
      paidAt: typeof body.paidAt === "string" ? body.paidAt : null,
      status: "pending" as const,
      notes: typeof body.notes === "string" ? body.notes : null,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      installmentLabel: typeof body.installmentLabel === "string" ? body.installmentLabel : null,
      source: (createRazorpayLink ? "razorpay_link" : "manual") as "manual" | "razorpay_link",
      createdByAdminId: Number(auth.admin.id),
    };

    const result = createRazorpayLink
      ? await createEnterpriseInstallmentWithRazorpayLink({
        ...paymentInput,
        emailProspect: body.emailProspect === true,
      })
      : await createEnterprisePayment(paymentInput);

    const paymentUid = result.paymentUid;
    const paymentLink = "paymentLink" in result
      ? result.paymentLink
      : paymentInput.paymentLink;

    const activation = settleNow
      ? await settleEnterpriseInstallment(id, paymentUid, {
        transactionId: paymentInput.transactionId,
        paymentMethod: paymentInput.paymentMethod,
        paidAt: paymentInput.paidAt || new Date().toISOString(),
        adminId: Number(auth.admin.id),
      })
      : null;

    await insertEnterpriseNote({
      requestUid: id,
      adminId: Number(auth.admin.id),
      eventType: "payment",
      body: createRazorpayLink
        ? `Installment ${paymentUid} created with Razorpay payment link`
        : settleNow
          ? `Cash/received installment ${paymentUid} settled (invoice + paid + activate)`
          : `Payment ${paymentUid} saved as pending`,
    });
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: createRazorpayLink
        ? "enterprise_payment.razorpay_link_created"
        : settleNow
          ? "enterprise_payment.settled_on_create"
          : "enterprise_payment.created",
      entityType: "enterprise_payment",
      entityId: paymentUid,
      metadata: {
        requestUid: id,
        quoteUid: body.quoteUid,
        amountPaise: Number(body.amountPaise),
        createRazorpayLink,
        settleNow,
        customerUid: activation?.customerUid,
      },
    });

    let email = { attempted: false, delivered: false, message: "" };
    if (body.emailProspect === true && paymentLink) {
      try {
        const delivery = await sendEmail({
          to: enterpriseRequest.businessEmail,
          subject: "Your AR360 Enterprise payment link",
          text: `Hello ${enterpriseRequest.contactName},\n\nUse this secure payment link to complete your AR360 Enterprise installment:\n${paymentLink}\n\nRegards,\nAR360 Team`,
          html: `<p>Hello ${escapeHtml(enterpriseRequest.contactName)},</p><p>Use the secure link below to complete your AR360 Enterprise installment.</p><p><a href="${escapeHtml(paymentLink)}">Pay securely</a></p><p>Regards,<br>AR360 Team</p>`,
          template: "enterprise-payment-link",
        });
        email = { attempted: true, delivered: delivery.delivered, message: delivery.mode };
      } catch (emailError) {
        email = { attempted: true, delivered: false, message: emailError instanceof Error ? emailError.message : "Email delivery failed" };
      }
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "enterprise_payment_link.email_attempted",
        entityType: "enterprise_payment",
        entityId: paymentUid,
        metadata: { requestUid: id, delivered: email.delivered },
      });
    }

    let activationEmail:
      | { attempted: boolean; delivered: boolean; message: string; devSetupUrl?: string }
      | undefined;
    if (shouldIssueActivationPasswordSetup(activation)) {
      try {
        const delivery = await issueEnterpriseActivationPasswordSetup({
          userId: activation.userId,
          email: activation.email,
          contactName: activation.contactName,
          companyName: enterpriseRequest.companyName || "your company",
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
        activationEmail = {
          attempted: true,
          delivered: false,
          message: emailError instanceof Error ? emailError.message : "Email delivery failed",
        };
      }
    }

    return NextResponse.json({
      ok: true,
      paymentUid,
      paymentLink: paymentLink || null,
      email,
      activation,
      activationEmail,
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment creation failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
