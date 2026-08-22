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
  const rawFrom =
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

  // Keep display name, but never send a From domain that doesn't match the SMTP login
  // (common spam trigger when SMTP_FROM uses a custom domain over Gmail SMTP).
  let from = rawFrom || user;
  const fromEmailMatch = from.match(/<([^>]+)>/) || [null, from.includes("@") ? from : ""];
  const fromEmail = String(fromEmailMatch[1] || "").trim().toLowerCase();
  const authEmail = user.trim().toLowerCase();
  if (fromEmail && authEmail && fromEmail !== authEmail) {
    const display = from.includes("<") ? from.slice(0, from.indexOf("<")).trim().replace(/^"|"$/g, "") : "AR360 Studio";
    from = `${display || "AR360 Studio"} <${user}>`;
  } else if (!from.includes("<") && from.includes("@")) {
    from = `AR360 Studio <${from}>`;
  }

  return { host, port, secure, user, password, from: from || user };
}
