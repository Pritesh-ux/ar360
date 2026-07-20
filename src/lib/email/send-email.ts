import nodemailer from "nodemailer";
import { writeEmailLog } from "@/lib/email/email-log";
import { resolveEmailDeliveryConfig } from "@/lib/email/delivery-config";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  skipLog?: boolean;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export type SendEmailResult = {
  delivered: boolean;
  mode: "smtp" | "resend" | "console" | "skipped";
  messageId?: string;
};

/**
 * Email delivery for auth and system notifications.
 * Uses enabled SMTP first, then Resend as the live fallback provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const delivery = await resolveEmailDeliveryConfig();

  if (delivery.provider === "disabled") {
    if (delivery.reason === "disabled") {
      if (!input.skipLog) {
        await writeEmailLog({
          recipient: input.to,
          subject: input.subject,
          template: input.template,
          status: "skipped",
          metadata: { mode: "skipped", reason: "email_notifications_disabled" },
        });
      }
      return { delivered: false, mode: "skipped" };
    }

    console.log("[email:console]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    if (!input.skipLog) {
      await writeEmailLog({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        status: "console",
        metadata: { mode: "console" },
      });
    }
    return {
      delivered: process.env.NODE_ENV !== "production",
      mode: "console",
    };
  }

  try {
    let messageId: string | undefined;
    let mode: "smtp" | "resend";

    if (delivery.provider === "smtp") {
      const transporter = nodemailer.createTransport({
        host: delivery.smtp.host,
        port: delivery.smtp.port,
        secure: delivery.smtp.secure,
        auth: {
          user: delivery.smtp.user,
          pass: delivery.smtp.password,
        },
      });

      const info = await transporter.sendMail({
        from: delivery.smtp.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
        attachments: input.attachments,
      });
      messageId = info.messageId;
      mode = "smtp";
    } else {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${delivery.resend.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: delivery.resend.from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html || undefined,
          reply_to: delivery.resend.replyTo,
          attachments: input.attachments?.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content.toString("base64"),
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.message || payload.error?.message || `Resend request failed (${response.status})`,
        );
      }
      messageId = payload.id;
      mode = "resend";
    }

    if (!input.skipLog) {
      await writeEmailLog({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        status: "sent",
        providerMessageId: messageId,
        metadata: { mode },
      });
    }

    return {
      delivered: true,
      mode,
      messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    if (!input.skipLog) {
      await writeEmailLog({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        status: "failed",
        errorMessage: message,
        metadata: { mode: delivery.provider },
      });
    }
    throw error;
  }
}
