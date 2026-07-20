import {
  absoluteAppUrl,
  emailButton,
  emailDetails,
  emailGreeting,
  emailHeading,
  emailParagraph,
  emailSignOff,
  renderPremiumEmail,
} from "./email-shell";

export type CustomerEmailContent = {
  subject: string;
  title: string;
  intro: string;
  lines?: string[];
  details?: Array<{ label: string; value: string }>;
  actionLabel?: string;
  actionUrl?: string;
};

export { absoluteAppUrl };

export function renderCustomerLifecycleEmail(
  recipientName: string,
  content: CustomerEmailContent,
) {
  const greeting = `Hi ${recipientName || "there"},`;
  const textLines = [
    greeting,
    "",
    content.title,
    "",
    content.intro,
    ...(content.lines || []).flatMap((line) => ["", line]),
    ...(content.details || []).map((detail) => `${detail.label}: ${detail.value}`),
    content.actionUrl
      ? `\n${content.actionLabel || "Open AR360"}: ${content.actionUrl}`
      : "",
    "",
    "Best,",
    "AR360 Team",
  ].filter(Boolean);

  const bodyHtml = [
    emailGreeting(recipientName),
    emailHeading(content.title),
    emailParagraph(content.intro),
    ...(content.lines || []).map((line) => emailParagraph(line)),
    emailDetails(content.details || []),
    content.actionUrl && content.actionLabel
      ? emailButton(content.actionLabel, content.actionUrl)
      : "",
    emailSignOff(),
  ].join("");

  const html = renderPremiumEmail({
    preheader: content.intro,
    bodyHtml,
    bodyText: textLines.join("\n"),
  });

  return { subject: content.subject, text: textLines.join("\n"), html };
}
