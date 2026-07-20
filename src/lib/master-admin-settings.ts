import crypto from "crypto";
import { ensureAppSchema, query } from "@/lib/db";

export type PlatformSettings = {
  companyName: string;
  supportEmail: string;
  gstNumber: string;
  currency: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
  razorpayMode: "test" | "live";
  razorpayReconciliationEnabled: boolean;
  razorpayRolloutAllowlist: string;
  razorpayKillSwitch: boolean;
  nativeSubscriptionCheckoutEnabled: boolean;
  nativeSubscriptionRolloutPercent: number;
  legacyOneTimeRenewalsEnabled: boolean;
  stripeKey: string;
  smtpHost: string;
  smtpEmail: string;
  smtpPort: number;
  smtpPassword: string;
  smtpEnabled: boolean;
  resendEnabled: boolean;
  resendApiKey: string;
  resendFromEmail: string;
  resendReplyTo: string;
  storageProvider: string;
  maxLoginAttempts: number;
  lockMinutes: number;
  autoDeleteExpiredData: boolean;
  expiryWarningDays: number;
  storageWarningPercent: number;
  bandwidthWarningPercent: number;
  maintenanceMode: boolean;
  emailNotifications: boolean;
};

export const defaultPlatformSettings: PlatformSettings = {
  companyName: "AR360",
  supportEmail: "support@ar360.com",
  gstNumber: "",
  currency: "INR",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  razorpayMode: process.env.RAZORPAY_MODE === "live" ? "live" : "test",
  razorpayReconciliationEnabled: process.env.RAZORPAY_RECONCILIATION_ENABLED !== "false",
  razorpayRolloutAllowlist: process.env.RAZORPAY_ROLLOUT_ALLOWLIST || "",
  razorpayKillSwitch: process.env.RAZORPAY_CHECKOUT_KILL_SWITCH === "true",
  nativeSubscriptionCheckoutEnabled: process.env.RAZORPAY_NATIVE_SUBSCRIPTIONS === "true",
  nativeSubscriptionRolloutPercent: Number(process.env.RAZORPAY_NATIVE_SUBSCRIPTION_ROLLOUT || 0),
  legacyOneTimeRenewalsEnabled: process.env.RAZORPAY_LEGACY_RENEWALS === "true",
  stripeKey: "",
  smtpHost: "",
  smtpEmail: "",
  smtpPort: 587,
  smtpPassword: "",
  smtpEnabled: true,
  resendEnabled: Boolean(process.env.RESEND_API_KEY),
  resendApiKey: "",
  resendFromEmail: "",
  resendReplyTo: "",
  storageProvider: "Local",
  maxLoginAttempts: 5,
  lockMinutes: 30,
  autoDeleteExpiredData: false,
  expiryWarningDays: 7,
  storageWarningPercent: 80,
  bandwidthWarningPercent: 80,
  maintenanceMode: false,
  emailNotifications: true,
};

const numberKeys = new Set([
  "maxLoginAttempts",
  "lockMinutes",
  "expiryWarningDays",
  "storageWarningPercent",
  "bandwidthWarningPercent",
  "smtpPort",
  "nativeSubscriptionRolloutPercent",
]);
const booleanKeys = new Set([
  "autoDeleteExpiredData",
  "maintenanceMode",
  "emailNotifications",
  "smtpEnabled",
  "resendEnabled",
  "nativeSubscriptionCheckoutEnabled",
  "legacyOneTimeRenewalsEnabled",
  "razorpayReconciliationEnabled",
  "razorpayKillSwitch",
]);

const secretKeys = new Set([
  "razorpayKeySecret",
  "razorpayWebhookSecret",
  "smtpPassword",
  "resendApiKey",
  "stripeKey",
]);

function encryptionKey() {
  const raw = process.env.BILLING_SETTINGS_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

function encryptSecret(value: string) {
  if (!value) return "";
  const key = encryptionKey();
  if (!key) {
    throw new Error("BILLING_SETTINGS_ENCRYPTION_KEY is required before secrets can be persisted.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const key = encryptionKey();
  if (!key) throw new Error("BILLING_SETTINGS_ENCRYPTION_KEY is unavailable; encrypted billing settings cannot be read.");
  const [, , iv, tag, payload] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
}

function parseValue(key: string, value: string | null) {
  if (value == null) return (defaultPlatformSettings as any)[key];
  if (secretKeys.has(key)) return decryptSecret(value);
  if (numberKeys.has(key)) return Number(value || 0);
  if (booleanKeys.has(key)) return value === "true" || value === "1";
  return value;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  await ensureAppSchema();
  const rows = await query<{ setting_key: string; setting_value: string | null }>(
    "SELECT setting_key, setting_value FROM platform_settings",
  ).catch(() => []);
  const settings: any = { ...defaultPlatformSettings };
  for (const row of rows) {
    if (row.setting_key in settings) {
      settings[row.setting_key] = parseValue(row.setting_key, row.setting_value);
      if (secretKeys.has(row.setting_key) && row.setting_value && !row.setting_value.startsWith("enc:v1:") && encryptionKey()) {
        await query("UPDATE platform_settings SET setting_value = ?, is_secret = 1 WHERE setting_key = ?", [
          encryptSecret(row.setting_value), row.setting_key,
        ]);
      }
    }
  }
  return settings as PlatformSettings;
}

export async function savePlatformSettings(settings: Partial<PlatformSettings>) {
  await ensureAppSchema();
  const entries = Object.entries(settings).filter(([key]) => key in defaultPlatformSettings);
  for (const [key, raw] of entries) {
    const value = secretKeys.has(key) ? encryptSecret(String(raw ?? "")) : String(raw ?? "");
    await query(
      `INSERT INTO platform_settings (setting_key, setting_value, is_secret) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), is_secret=VALUES(is_secret), updated_at=NOW()`,
      [key, value, secretKeys.has(key)],
    );
  }
}

export async function getRazorpayKeys() {
  const settings = await getPlatformSettings();
  return {
    keyId: settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    keySecret: settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: settings.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || "",
    mode: settings.razorpayMode,
  };
}
