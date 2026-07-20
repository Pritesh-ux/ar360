import {
  emailButton,
  emailParagraph,
  emailSignOff,
  escapeHtml,
  renderPremiumEmail,
} from "./email-shell";

export function passwordResetEmail(input: {
  resetUrl: string;
  ttlMinutes: number;
}) {
  const subject = "Reset your AR360 Studio password";
  const text = [
    "Hi there,",
    "",
    "You requested a password reset for your AR360 Studio account.",
    "",
    `Reset your password (valid for ${input.ttlMinutes} minutes):`,
    input.resetUrl,
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "Best,",
    "AR360 Team",
  ].join("\n");

  const bodyHtml = [
    emailParagraph("Hi there,"),
    emailParagraph(
      "You requested a password reset for your AR360 Studio account.",
    ),
    emailParagraph(
      `Use the button below to choose a new password. This link expires in ${input.ttlMinutes} minutes.`,
    ),
    emailButton("Reset password", input.resetUrl),
    `<p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.6;word-break:break-all;">Or copy this link:<br /><a href="${escapeHtml(input.resetUrl)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(input.resetUrl)}</a></p>`,
    emailParagraph("If you did not request this, you can safely ignore this email."),
    emailSignOff(),
  ].join("");

  const html = renderPremiumEmail({
    preheader: "Reset your AR360 Studio password",
    bodyHtml,
    bodyText: text,
  });

  return { subject, text, html };
}
