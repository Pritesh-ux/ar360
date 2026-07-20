import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send-email";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { captureException } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, {
    scope: "contact:submit",
    limit: 5,
    windowSec: 3600,
  });
  if (limited instanceof Response) return limited;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const subject = String(body.subject || "AR360 Studio inquiry").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const settings = await getPlatformSettings();
  const to = settings.supportEmail || settings.smtpEmail || "support@ar360.studio";

  try {
    const result = await sendEmail({
      to,
      subject: `[Contact] ${subject}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${message.replace(/\n/g, "<br/>")}</p>`,
    });

    return NextResponse.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
    });
  } catch (error) {
    await captureException(error, { route: "contact", email });
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 502 });
  }
}
