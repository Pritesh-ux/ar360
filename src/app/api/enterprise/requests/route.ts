import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send-email";
import {
  createPublicEnterpriseRequest,
  EnterpriseSalesValidationError,
  validateEnterpriseRequest,
  type EnterpriseRequestInput,
} from "@/lib/enterprise-sales";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { captureException } from "@/lib/monitoring";
import { enforceRateLimitForKey, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

type PublicRequestBody = Partial<Record<keyof EnterpriseRequestInput, unknown>> & {
  websiteAddress?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? value : Number(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] || character;
  });
}

function parseInput(body: PublicRequestBody): EnterpriseRequestInput {
  const requestedSource = text(body.source);
  const source = ["public-pricing:contact-sales", "public-pricing:request-quote"].includes(requestedSource)
    ? requestedSource
    : "public-pricing:request-quote";
  return {
    companyName: text(body.companyName),
    contactName: text(body.contactName),
    businessEmail: text(body.businessEmail),
    phone: text(body.phone),
    companyWebsite: text(body.companyWebsite),
    address: text(body.address),
    country: text(body.country),
    state: text(body.state),
    industry: text(body.industry),
    expectedProducts: optionalNumber(body.expectedProducts),
    expectedStorageGb: optionalNumber(body.expectedStorageGb),
    expectedMonthlyBandwidthGb: optionalNumber(body.expectedMonthlyBandwidthGb),
    needsMoreStorage: body.needsMoreStorage === true,
    needsMoreBandwidth: body.needsMoreBandwidth === true,
    needsMoreProducts: body.needsMoreProducts === true,
    needsTeamMembers: body.needsTeamMembers === true,
    needsCustomBranding: body.needsCustomBranding === true,
    needsDedicatedInfrastructure: body.needsDedicatedInfrastructure === true,
    needsPrioritySupport: body.needsPrioritySupport === true,
    needsSla: body.needsSla === true,
    needsQr: body.needsQr === true,
    needsEmbed: body.needsEmbed === true,
    needsShare: body.needsShare === true,
    needsAr: body.needsAr === true,
    needsAnalytics: body.needsAnalytics === true,
    additionalRequirements: text(body.additionalRequirements),
    source,
  };
}

function featureSummary(input: EnterpriseRequestInput): string[] {
  return [
    input.needsMoreStorage && "More Storage",
    input.needsMoreBandwidth && "More Bandwidth",
    input.needsMoreProducts && "More Products",
    input.needsQr && "QR Codes",
    input.needsEmbed && "Embed Viewer",
    input.needsShare && "Share Links",
    input.needsAr && "AR Experience",
    input.needsCustomBranding && "Custom Branding",
    input.needsAnalytics && "Advanced Analytics",
    input.needsTeamMembers && "Multiple Team Members",
    input.needsDedicatedInfrastructure && "Dedicated Infrastructure",
    input.needsPrioritySupport && "Priority Support",
    input.needsSla && "SLA",
  ].filter((value): value is string => Boolean(value));
}

async function sendRequestEmails(input: EnterpriseRequestInput, requestId: string): Promise<void> {
  const settings = await getPlatformSettings();
  const salesEmail =
    process.env.ENTERPRISE_SALES_EMAIL?.trim() ||
    settings.supportEmail ||
    settings.smtpEmail ||
    "support@ar360.studio";
  const features = featureSummary(input);
  const requirements = input.additionalRequirements || "None provided";
  const adminText = [
    `Enterprise request: ${requestId}`,
    `Company: ${input.companyName}`,
    `Contact: ${input.contactName}`,
    `Email: ${input.businessEmail}`,
    `Phone: ${input.phone}`,
    `Website: ${input.companyWebsite || "Not provided"}`,
    `Address: ${input.address}`,
    `Country: ${input.country}`,
    `State: ${input.state}`,
    `Industry: ${input.industry}`,
    `Expected products: ${input.expectedProducts ?? "Not provided"}`,
    `Expected storage: ${input.expectedStorageGb ?? "Not provided"} GB`,
    `Expected monthly bandwidth: ${input.expectedMonthlyBandwidthGb ?? "Not provided"} GB`,
    `Features: ${features.join(", ") || "None selected"}`,
    `Additional requirements: ${requirements}`,
  ].join("\n");

  const safeId = escapeHtml(requestId);
  const safeName = escapeHtml(input.contactName);
  const results = await Promise.allSettled([
    sendEmail({
      to: salesEmail,
      subject: `[Enterprise] ${input.companyName} — ${requestId}`,
      text: adminText,
      html: `<h2>New Enterprise request</h2><p><strong>Request ID:</strong> ${safeId}</p><pre style="white-space:pre-wrap">${escapeHtml(adminText)}</pre>`,
      template: "enterprise-request-admin",
    }),
    sendEmail({
      to: input.businessEmail,
      subject: `We received your AR360 Enterprise request — ${requestId}`,
      text: `Hi ${input.contactName},\n\nWe received your AR360 Enterprise request. Our sales team will contact you shortly.\n\nRequest ID: ${requestId}\n\nAR360`,
      html: `<p>Hi ${safeName},</p><p>We received your AR360 Enterprise request. Our sales team will contact you shortly.</p><p><strong>Request ID:</strong> ${safeId}</p><p>AR360</p>`,
      template: "enterprise-request-confirmation",
    }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      await captureException(result.reason, { route: "enterprise-requests", requestId, phase: "email" });
    }
  }
}

export async function POST(request: Request) {
  const ipLimit = await enforceRateLimitForKey(getClientIp(request), {
    scope: "enterprise-request:ip",
    limit: 5,
    windowSec: 3600,
  });
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit);

  let body: PublicRequestBody;
  try {
    const parsed: unknown = await request.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PublicRequestBody) : {};
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  if (text(body.websiteAddress).trim()) {
    return NextResponse.json({ success: true, requestId: "ER-RECEIVED" });
  }

  try {
    const input = validateEnterpriseRequest(parseInput(body));
    const emailKey = crypto.createHash("sha256").update(input.businessEmail).digest("hex");
    const emailLimit = await enforceRateLimitForKey(emailKey, {
      scope: "enterprise-request:email",
      limit: 3,
      windowSec: 86_400,
    });
    if (!emailLimit.allowed) return rateLimitResponse(emailLimit);

    const { requestUid } = await createPublicEnterpriseRequest(input);

    try {
      await sendRequestEmails(input, requestUid);
    } catch (error) {
      await captureException(error, { route: "enterprise-requests", requestId: requestUid, phase: "email-setup" });
    }

    return NextResponse.json({ success: true, requestId: requestUid }, { status: 201 });
  } catch (error) {
    if (error instanceof EnterpriseSalesValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    await captureException(error, { route: "enterprise-requests", phase: "save" });
    return NextResponse.json({ error: "Unable to submit your request right now." }, { status: 500 });
  }
}
