import { absoluteUrl } from "@/lib/url";
import { BRAND_INK, BRAND_LIME, getAr360EmailLogoHtml } from "@/lib/brand/ar360-logo";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export { escapeHtml };

export function absoluteAppUrl(pathname: string) {
  return absoluteUrl(pathname);
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** AR360-branded transactional email shell (table layout, hosted PNG logo). */
export function renderPremiumEmail(input: {
  preheader?: string;
  bodyHtml: string;
  bodyText: string;
}) {
  const preheader = escapeHtml(input.preheader || "");
  const year = new Date().getFullYear();
  const appUrl = absoluteAppUrl("/");
  const supportUrl = absoluteAppUrl("/contact");
  const logo = getAr360EmailLogoHtml({ height: 32, href: appUrl, tone: "dark" });

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>AR360</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;color:${BRAND_INK};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND_INK};padding:0;">
              <div style="height:4px;line-height:4px;font-size:4px;background:${BRAND_LIME};">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:24px 28px 22px;">
                    ${logo}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-size:15px;line-height:1.7;color:#3F3F46;">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;">
              <div style="height:1px;line-height:1px;font-size:1px;background:#ECECEE;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#71717A;">
                <a href="${escapeHtml(appUrl)}" style="color:#52525B;text-decoration:underline;">Home</a>
                &nbsp;&nbsp;·&nbsp;&nbsp;
                <a href="${escapeHtml(supportUrl)}" style="color:#52525B;text-decoration:underline;">Support</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#A1A1AA;">
                © ${year} AR360 Studio · 3D · AR · QR · Embed
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 16px;color:#3F3F46;font-size:15px;line-height:1.7;">${escapeHtml(text)}</p>`;
}

export function emailGreeting(name: string) {
  return emailParagraph(`Hi ${name || "there"},`);
}

export function emailHeading(text: string) {
  return `<p style="margin:0 0 14px;color:${BRAND_INK};font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(text)}</p>`;
}

export function emailDetails(
  details: Array<{ label: string; value: string }>,
) {
  if (!details.length) return "";
  const rows = details
    .map(
      (detail, index) => `
      <tr>
        <td style="padding:12px 14px;${index < details.length - 1 ? "border-bottom:1px solid #EEF0F2;" : ""}width:42%;color:#737373;font-size:13px;line-height:1.5;vertical-align:top;">${escapeHtml(detail.label)}</td>
        <td style="padding:12px 14px;${index < details.length - 1 ? "border-bottom:1px solid #EEF0F2;" : ""}color:${BRAND_INK};font-size:13px;line-height:1.5;font-weight:600;text-align:right;vertical-align:top;">${escapeHtml(detail.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;background:#F8FAF4;border:1px solid #E4E9D8;border-radius:12px;overflow:hidden;">${rows}</table>`;
}

export function emailButton(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px;">
  <tr>
    <td style="border-radius:10px;background:${BRAND_LIME};">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:${BRAND_INK};text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.01em;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function emailLink(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="color:${BRAND_INK};text-decoration:underline;font-weight:600;">${escapeHtml(label)}</a>`;
}

export function emailSignOff() {
  return `<p style="margin:20px 0 0;color:#3F3F46;font-size:15px;line-height:1.7;">Best,<br /><strong style="color:${BRAND_INK};">AR360 Team</strong></p>`;
}
