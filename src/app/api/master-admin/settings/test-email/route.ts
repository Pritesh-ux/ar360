import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { sendEmail } from "@/lib/email/send-email";
import { getPlatformSettings } from "@/lib/master-admin-settings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const admin = auth.admin;

  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const settings = await getPlatformSettings();
  const to = String(body.to || settings.supportEmail || settings.smtpEmail || admin.email || "").trim();

  if (!to) {
    return NextResponse.json({ error: "No recipient email configured." }, { status: 400 });
  }

  try {
    const result = await sendEmail({
      to,
      subject: "AR360 Studio live email test",
      text: "This is a live delivery test from AR360 Studio Master Admin email settings.",
      html: "<p>This is a <strong>live delivery test</strong> from AR360 Studio Master Admin email settings.</p>",
    });

    return NextResponse.json({
      success: true,
      delivered: result.delivered,
      mode: result.mode,
      to,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
