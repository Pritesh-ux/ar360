import {
  emailButton,
  emailGreeting,
  emailHeading,
  emailParagraph,
  emailSignOff,
  escapeHtml,
  renderPremiumEmail,
} from "./email-shell";

export function enterpriseActivationEmail(input: {
  contactName: string;
  companyName: string;
  setupUrl: string;
  ttlMinutes: number;
}) {
  const subject = "Your AR360 Enterprise account is active";
  const text = [
    `Hi ${input.contactName},`,
    "",
    `Your AR360 Enterprise account for ${input.companyName} is now active.`,
    `Set your password using this one-time link (valid for ${input.ttlMinutes} minutes):`,
    input.setupUrl,
    "",
    "For security, this link can be used only once.",
    "",
    "Best,",
    "AR360 Team",
  ].join("\n");

  const bodyHtml = [
    emailGreeting(input.contactName),
    emailHeading("Your Enterprise account is active"),
    emailParagraph(
      `AR360 Enterprise access for ${input.companyName} is ready.`,
    ),
    emailParagraph(
      `Set your password with the one-time link below. It expires in ${input.ttlMinutes} minutes and can be used only once.`,
    ),
    emailButton("Set your password", input.setupUrl),
    `<p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.6;word-break:break-all;">Or copy this link:<br /><a href="${escapeHtml(input.setupUrl)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(input.setupUrl)}</a></p>`,
    emailSignOff(),
  ].join("");

  const html = renderPremiumEmail({
    preheader: `Enterprise access for ${input.companyName} is ready`,
    bodyHtml,
    bodyText: text,
  });

  return { subject, text, html };
}
