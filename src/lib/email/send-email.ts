import nodemailer from "nodemailer";
import { writeEmailLog } from "@/lib/email/email-log";
import { resolveEmailDeliveryConfig } from "@/lib/email/delivery-config";
import {
  htmlNeedsAr360EmailLogo,
  loadAr360EmailLogoAttachment,
} from "@/lib/email/brand-inline";
import { AR360_EMAIL_LOGO_CID, getAr360EmailWordmarkUrl } from "@/lib/brand/ar360-logo";
import { absoluteUrl } from "@/lib/url";

type SendEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
  contentDisposition?: "inline" | "attachment";
};

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  skipLog?: boolean;
  metadata?: Record<string, unknown>;
  attachments?: SendEmailAttachment[];
  replyTo?: string;
};

function buildLogMetadata(input: SendEmailInput, extra: Record<string, unknown> = {}) {
  const bodyPreview = input.text?.trim() ? input.text.trim().slice(0, 4000) : undefined;
  return {
    ...extra,
    ...(input.metadata || {}),
    ...(bodyPreview ? { bodyPreview } : {}),
  };
}

function prepareHtmlAndAttachments(input: SendEmailInput): {
  html?: string;
  attachments: SendEmailAttachment[];
} {
  let html = input.html;
  const list = [...(input.attachments || [])];
  if (htmlNeedsAr360EmailLogo(html)) {
    const alreadyAttached = list.some((item) => item.cid === AR360_EMAIL_LOGO_CID);
    if (!alreadyAttached) {
      const logo = loadAr360EmailLogoAttachment("dark");
      if (logo) {
        list.unshift(logo);
      } else if (html) {
        // Fallback to hosted absolute URL if the PNG is missing on disk.
        html = html.split(`cid:${AR360_EMAIL_LOGO_CID}`).join(getAr360EmailWordmarkUrl("dark"));
      }
    }
  }
  return { html, attachments: list };
}

function buildDeliverabilityHeaders(to: string) {
  const unsubscribeUrl = absoluteUrl("/contact");
  const supportMailto = "mailto:support@ar360studio.com?subject=Unsubscribe";
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <${supportMailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Entity-Ref-ID": `${Date.now()}-${Buffer.from(to).toString("base64url").slice(0, 16)}`,
  };
}

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
  const prepared = prepareHtmlAndAttachments(input);
  const attachments = prepared.attachments;
  const html = prepared.html;
  const headers = buildDeliverabilityHeaders(input.to);

  if (delivery.provider === "disabled") {
    if (delivery.reason === "disabled") {
      if (!input.skipLog) {
        await writeEmailLog({
          recipient: input.to,
          subject: input.subject,
          template: input.template,
          status: "skipped",
          metadata: buildLogMetadata(input, {
            mode: "skipped",
            reason: "email_notifications_disabled",
          }),
        });
      }
      return { delivered: false, mode: "skipped" };
    }

    // Never dump OTP/reset bodies to logs (especially in production).
    if (process.env.NODE_ENV !== "production") {
      console.log("[email:console]", {
        to: "[REDACTED]",
        subject: input.subject,
        template: input.template || null,
      });
    } else {
      console.warn("[email] provider unconfigured; message not sent", {
        template: input.template || null,
      });
    }
    if (!input.skipLog) {
      await writeEmailLog({
        recipient: input.to,
        subject: input.subject,
        template: input.template,
        status: "console",
        metadata: buildLogMetadata(input, { mode: "console" }),
      });
    }
    return {
      delivered: false,
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
        replyTo: input.replyTo,
        subject: input.subject,
        text: input.text,
        html: html || undefined,
        headers,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          cid: attachment.cid,
          contentDisposition: attachment.contentDisposition || (attachment.cid ? "inline" : "attachment"),
        })),
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
          html: html || undefined,
          reply_to: input.replyTo || delivery.resend.replyTo,
          headers,
          attachments: attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content.toString("base64"),
            content_id: attachment.cid,
            content_type: attachment.contentType,
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
        metadata: buildLogMetadata(input, { mode, logoInline: htmlNeedsAr360EmailLogo(html) }),
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
        metadata: buildLogMetadata(input, { mode: delivery.provider }),
      });
    }
    throw error;
  }
}
