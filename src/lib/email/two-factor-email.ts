import { sendEmail } from "@/lib/email/send-email";

/** Sends a one-time login / enable-2FA code to the user's email. */
export async function sendTwoFactorCodeEmail(input: {
  to: string;
  name?: string;
  code: string;
  purpose?: "login" | "enable";
}) {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const purpose =
    input.purpose === "enable"
      ? "to enable two-factor authentication on your AR360 account"
      : "to finish signing in to AR360";

  const text = [
    greeting,
    "",
    `Your verification code is: ${input.code}`,
    "",
    `Enter this code ${purpose}.`,
    "This code expires in 10 minutes.",
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "— AR360 Studio",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <p style="margin:0 0 12px">${greeting}</p>
      <p style="margin:0 0 16px">Your verification code ${purpose}:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 16px">${input.code}</p>
      <p style="margin:0 0 8px;color:#525252">This code expires in 10 minutes.</p>
      <p style="margin:0;color:#737373;font-size:13px">If you did not request this, ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: input.to,
    subject: `AR360 verification code: ${input.code}`,
    text,
    html,
    template: "two_factor_code",
    metadata: { purpose: input.purpose || "login" },
  });
}
