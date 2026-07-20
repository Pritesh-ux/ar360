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
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function renderPremiumEmail(input: {
  preheader?: string;
  bodyHtml: string;
  bodyText: string;
}) {
  const preheader = escapeHtml(input.preheader || "");
  const year = new Date().getFullYear();
  const appUrl = absoluteAppUrl("/");
  const supportUrl = absoluteAppUrl("/contact");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AR360</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #ececee;">
          <tr>
            <td style="padding:32px 40px 24px;">
              <a href="${escapeHtml(appUrl)}" style="text-decoration:none;color:#0A0B14;display:inline-block;line-height:0;">
                <img
                  src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='118' height='28' viewBox='0 0 118 28' fill='none'><path d='M14 2.4C19.6 2.4 22.4 3.4 24 5C25.6 6.6 26.6 9.4 26.6 14C26.6 18.6 25.6 21.4 24 23C22.4 24.6 19.6 25.6 14 25.6C8.4 25.6 5.6 24.6 4 23C2.4 21.4 1.4 18.6 1.4 14C1.4 9.4 2.4 6.6 4 5C5.6 3.4 8.4 2.4 14 2.4Z' stroke='%23B9FF2C' stroke-width='2.4' stroke-linejoin='round'/><text x='34' y='20.5' fill='%230A0B14' font-family='system-ui,Segoe UI,Arial,sans-serif' font-size='18' font-weight='700' letter-spacing='-0.5'>AR<tspan fill='%23B9FF2C'>360</tspan></text></svg>`)}"
                  width="118"
                  height="28"
                  alt="AR360"
                  style="display:block;width:118px;height:28px;border:0;"
                />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px;font-size:15px;line-height:1.7;color:#3f3f46;">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:#ececee;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#a1a1aa;">
                <a href="${escapeHtml(appUrl)}" style="color:#71717a;text-decoration:underline;">Dashboard</a>
                &nbsp;&nbsp;·&nbsp;&nbsp;
                <a href="${escapeHtml(supportUrl)}" style="color:#71717a;text-decoration:underline;">Support</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa;">
                © ${year} AR360 Studio<br />
                3D and AR product experiences
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
  return `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.7;">${escapeHtml(text)}</p>`;
}

export function emailGreeting(name: string) {
  return emailParagraph(`Hi ${name || "there"},`);
}

export function emailHeading(text: string) {
  return `<p style="margin:0 0 16px;color:#18181b;font-size:22px;line-height:1.35;font-weight:600;">${escapeHtml(text)}</p>`;
}

export function emailDetails(
  details: Array<{ label: string; value: string }>,
) {
  if (!details.length) return "";
  const rows = details
    .map(
      (detail, index) => `
      <tr>
        <td style="padding:12px 0;${index < details.length - 1 ? "border-bottom:1px solid #f4f4f5;" : ""}width:40%;color:#71717a;font-size:14px;line-height:1.5;vertical-align:top;">${escapeHtml(detail.label)}</td>
        <td style="padding:12px 0;${index < details.length - 1 ? "border-bottom:1px solid #f4f4f5;" : ""}color:#18181b;font-size:14px;line-height:1.5;font-weight:500;text-align:right;vertical-align:top;">${escapeHtml(detail.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;border-top:1px solid #ececee;border-bottom:1px solid #ececee;">${rows}</table>`;
}

export function emailButton(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td style="border-radius:8px;background:#18181b;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.01em;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function emailLink(label: string, url: string) {
  return `<a href="${escapeHtml(url)}" style="color:#18181b;text-decoration:underline;font-weight:500;">${escapeHtml(label)}</a>`;
}

export function emailSignOff() {
  return `<p style="margin:24px 0 0;color:#3f3f46;font-size:15px;line-height:1.7;">Best,<br />AR360 Team</p>`;
}
