import { getRazorpayClient } from "@/server/billing/razorpay";
import {
  getEnterpriseSalesRequest,
  insertEnterprisePayment,
  updateEnterprisePaymentLink,
  type EnterprisePaymentInput,
} from "@/lib/enterprise-sales";
import { EnterpriseSalesValidationError } from "@/lib/enterprise-sales/validation";

type CreateInstallmentLinkInput = EnterprisePaymentInput & {
  emailProspect?: boolean;
};

export async function createEnterpriseInstallmentWithRazorpayLink(
  input: CreateInstallmentLinkInput,
): Promise<{ paymentUid: string; paymentLink: string; providerPaymentLinkId: string }> {
  const enterpriseRequest = await getEnterpriseSalesRequest(input.requestUid);
  if (!enterpriseRequest) throw new Error("Enterprise request not found");

  const paymentUid = await insertEnterprisePayment({
    ...input,
    status: "pending",
    source: "razorpay_link",
    paymentLink: null,
  });

  const amountPaise = Number(input.amountPaise);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new EnterpriseSalesValidationError("Payment amount must be a positive paise amount");
  }

  const client = await getRazorpayClient();
  const link = await (client as any).paymentLink.create({
    amount: amountPaise,
    currency: input.currency || "INR",
    accept_partial: false,
    description: input.installmentLabel || `AR360 Enterprise installment ${paymentUid}`,
    customer: {
      name: enterpriseRequest.contactName,
      email: enterpriseRequest.businessEmail,
      contact: enterpriseRequest.phone || undefined,
    },
    notify: {
      sms: false,
      email: Boolean(input.emailProspect),
    },
    reminder_enable: true,
    notes: {
      enterprise_payment_uid: paymentUid,
      enterprise_request_uid: input.requestUid,
      enterprise_quote_uid: input.quoteUid,
    },
  });

  const paymentLink = String(link?.short_url || "");
  const providerPaymentLinkId = String(link?.id || "");
  if (!paymentLink.startsWith("https://") || !providerPaymentLinkId) {
    throw new Error("Razorpay did not return a valid payment link");
  }

  await updateEnterprisePaymentLink(paymentUid, paymentLink, providerPaymentLinkId);
  return { paymentUid, paymentLink, providerPaymentLinkId };
}

export async function findEnterprisePaymentByRazorpayNotes(notes: Record<string, unknown> | null | undefined) {
  const paymentUid = String(notes?.enterprise_payment_uid || "").trim();
  const requestUid = String(notes?.enterprise_request_uid || "").trim();
  if (!paymentUid || !requestUid) return null;
  return { paymentUid, requestUid };
}
