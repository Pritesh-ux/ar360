import { resolveSmtpConfig, type SmtpConfig } from "@/lib/email/smtp-config";
import {
  getPlatformSettings,
  type PlatformSettings,
} from "@/lib/master-admin-settings";

export type ResendConfig = {
  apiKey: string;
  from: string;
  replyTo?: string;
};

export type EmailDeliveryConfig =
  | { provider: "smtp"; smtp: SmtpConfig }
  | { provider: "resend"; resend: ResendConfig }
  | { provider: "disabled"; reason: "disabled" | "unconfigured" };

export type EmailDeliveryStatus = {
  emailEnabled: boolean;
  activeProvider: "smtp" | "resend" | "disabled" | "unconfigured";
  smtp: { enabled: boolean; configured: boolean };
  resend: { enabled: boolean; configured: boolean };
};

export function selectEmailProvider(input: {
  emailEnabled: boolean;
  smtpEnabled: boolean;
  smtpConfigured: boolean;
  resendEnabled: boolean;
  resendConfigured: boolean;
}): EmailDeliveryStatus["activeProvider"] {
  if (!input.emailEnabled) return "disabled";
  if (input.smtpEnabled && input.smtpConfigured) return "smtp";
  if (input.resendEnabled && input.resendConfigured) return "resend";
  return "unconfigured";
}

function resolveResendConfig(settings: PlatformSettings): ResendConfig | null {
  if (!settings.resendEnabled) return null;
  const apiKey = process.env.RESEND_API_KEY?.trim() || settings.resendApiKey.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    settings.resendFromEmail.trim();
  const replyTo =
    process.env.RESEND_REPLY_TO?.trim() ||
    settings.resendReplyTo.trim() ||
    settings.supportEmail.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: replyTo || undefined };
}

async function resolveAll() {
  const settings = await getPlatformSettings();
  const [smtp, resend] = await Promise.all([
    resolveSmtpConfig(settings),
    Promise.resolve(resolveResendConfig(settings)),
  ]);
  const activeProvider = selectEmailProvider({
    emailEnabled: settings.emailNotifications,
    smtpEnabled: settings.smtpEnabled,
    smtpConfigured: Boolean(smtp),
    resendEnabled: settings.resendEnabled,
    resendConfigured: Boolean(resend),
  });
  return { settings, smtp, resend, activeProvider };
}

export async function resolveEmailDeliveryConfig(): Promise<EmailDeliveryConfig> {
  const { smtp, resend, activeProvider } = await resolveAll();
  if (activeProvider === "smtp" && smtp) return { provider: "smtp", smtp };
  if (activeProvider === "resend" && resend) return { provider: "resend", resend };
  return {
    provider: "disabled",
    reason: activeProvider === "disabled" ? "disabled" : "unconfigured",
  };
}

export async function getEmailDeliveryStatus(): Promise<EmailDeliveryStatus> {
  const { settings, smtp, resend, activeProvider } = await resolveAll();
  return {
    emailEnabled: settings.emailNotifications,
    activeProvider,
    smtp: {
      enabled: settings.smtpEnabled,
      configured: Boolean(smtp),
    },
    resend: {
      enabled: settings.resendEnabled,
      configured: Boolean(resend),
    },
  };
}
