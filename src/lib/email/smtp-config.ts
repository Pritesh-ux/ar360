import {
  getPlatformSettings,
  type PlatformSettings,
} from "@/lib/master-admin-settings";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export async function resolveSmtpConfig(
  providedSettings?: PlatformSettings | null,
): Promise<SmtpConfig | null> {
  const platform =
    providedSettings === undefined
      ? await getPlatformSettings().catch(() => null)
      : providedSettings;

  if (platform?.smtpEnabled === false) return null;

  const host = process.env.SMTP_HOST?.trim() || platform?.smtpHost?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || platform?.smtpEmail?.trim() || "";
  const password = process.env.SMTP_PASSWORD?.trim() || platform?.smtpPassword?.trim() || "";
  const from =
    process.env.SMTP_FROM?.trim() ||
    platform?.smtpEmail?.trim() ||
    user ||
    platform?.supportEmail?.trim() ||
    "";

  if (!host || !user || !password) {
    return null;
  }

  const port = Number(
    process.env.SMTP_PORT || platform?.smtpPort || (host.includes("gmail") ? 587 : 587),
  );
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  return { host, port, secure, user, password, from: from || user };
}
