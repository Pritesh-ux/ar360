import type { EnterpriseQuote, EnterpriseRequestDetail } from "./types";

function money(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function gbFromBytes(bytes: number | null | undefined) {
  if (bytes == null) return "Custom / unlimited";
  const gb = bytes / 1024 / 1024 / 1024;
  if (!Number.isFinite(gb)) return "Custom / unlimited";
  return `${Number(gb.toFixed(gb >= 10 ? 0 : 1))} GB`;
}

function limitLabel(value: number | null | undefined, unit = "") {
  if (value == null) return "Custom / unlimited";
  return unit ? `${value} ${unit}` : String(value);
}

function featureLines(request: EnterpriseRequestDetail): string[] {
  const flags: Array<[string, boolean | undefined]> = [
    ["More storage", request.needsMoreStorage],
    ["More bandwidth", request.needsMoreBandwidth],
    ["More products", request.needsMoreProducts],
    ["QR Codes", request.needsQr],
    ["Embed Viewer", request.needsEmbed],
    ["Share Links", request.needsShare],
    ["AR Experience", request.needsAr],
    ["Custom branding", request.needsCustomBranding],
    ["Advanced analytics", request.needsAnalytics],
    ["Team members", request.needsTeamMembers],
    ["Dedicated infrastructure", request.needsDedicatedInfrastructure],
    ["Priority support", request.needsPrioritySupport],
    ["SLA", request.needsSla],
  ];
  return flags.filter(([, on]) => Boolean(on)).map(([label]) => `• ${label}`);
}

function locationLine(request: EnterpriseRequestDetail) {
  return [request.address, request.state, request.country].filter(Boolean).join(", ");
}

/** Rich default body for Master Admin → Compose mail on an Enterprise request. */
export function buildEnterpriseComposeMailText(
  request: EnterpriseRequestDetail,
  quote: EnterpriseQuote | null,
): string {
  const lines: string[] = [
    `Hello ${request.contactName},`,
    "",
    `Thank you for your interest in AR360 Enterprise for ${request.companyName}.`,
    "",
    "Request summary",
    `• Request ID: ${request.requestUid}`,
    `• Company: ${request.companyName}`,
    `• Contact: ${request.contactName}`,
    `• Email: ${request.businessEmail}`,
    `• Phone: ${request.phone || "—"}`,
  ];

  if (request.companyWebsite) lines.push(`• Website: ${request.companyWebsite}`);
  lines.push(`• Industry: ${request.industry || "—"}`);

  const location = locationLine(request);
  if (location) lines.push(`• Address: ${location}`);

  lines.push("");
  lines.push("Expected usage");
  lines.push(`• Products: ${request.expectedProducts ?? "To be confirmed"}`);
  lines.push(`• Storage: ${request.expectedStorageGb != null ? `${request.expectedStorageGb} GB` : "To be confirmed"}`);
  lines.push(
    `• Bandwidth / month: ${
      request.expectedMonthlyBandwidthGb != null
        ? `${request.expectedMonthlyBandwidthGb} GB`
        : "To be confirmed"
    }`,
  );

  const features = featureLines(request);
  if (features.length) {
    lines.push("");
    lines.push("Features requested");
    lines.push(...features);
  }

  if (request.additionalRequirements?.trim()) {
    lines.push("");
    lines.push("Additional requirements");
    lines.push(request.additionalRequirements.trim());
  }

  if (quote) {
    lines.push("");
    lines.push("Proposed plan");
    lines.push(`• Quote: ${quote.quoteNumber} (v${quote.version})`);
    lines.push(`• Plan: ${quote.planName}`);
    lines.push(`• Billing: ${quote.billingCycle}`);
    lines.push(`• Amount: ${money(quote.pricePaise, quote.currency)} (incl. applicable taxes as quoted)`);
    lines.push(`• Valid until: ${quote.validUntil}`);
    lines.push(`• Products: ${limitLabel(quote.productLimit)}`);
    lines.push(`• Storage: ${gbFromBytes(quote.storageLimitBytes)}`);
    lines.push(`• Bandwidth: ${gbFromBytes(quote.bandwidthLimitBytes)}`);
    lines.push(`• Team members: ${limitLabel(quote.teamMemberLimit)}`);
    if (quote.customBranding) lines.push("• Custom branding: Included");
    if (quote.prioritySupport) lines.push("• Priority support: Included");
    if (quote.dedicatedInfrastructure) lines.push("• Dedicated infrastructure: Included");
    if (quote.slaSupport) lines.push(`• SLA: ${quote.supportLevel || "Included"}`);
    if (quote.terms?.trim()) {
      lines.push("");
      lines.push("Terms");
      lines.push(quote.terms.trim());
    }
    if (quote.remainingPaise > 0) {
      lines.push("");
      lines.push(
        `Outstanding balance: ${money(quote.remainingPaise, quote.currency)} (paid ${money(quote.paidPaise, quote.currency)} of ${money(quote.pricePaise, quote.currency)}).`,
      );
    }
    lines.push("");
    lines.push(
      "Please review the attached quote. If everything looks good, you can proceed using the payment link (if included below) or reply to this email with any questions.",
    );
  } else {
    lines.push("");
    lines.push(
      "Our sales team is preparing a custom plan based on the details above. We will share a formal quote with pricing, limits, and next steps shortly.",
    );
  }

  lines.push("");
  lines.push("Regards,");
  lines.push("AR360 Enterprise Team");
  lines.push("support@ar360.studio");

  return lines.join("\n");
}

export function buildEnterpriseComposeMailSubject(
  request: EnterpriseRequestDetail,
  quote: EnterpriseQuote | null,
): string {
  if (quote) {
    return `AR360 Enterprise quote ${quote.quoteNumber} — ${request.companyName}`;
  }
  return `AR360 Enterprise request ${request.requestUid} — ${request.companyName}`;
}
