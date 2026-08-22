import crypto from "crypto";
import { ensureAppSchema, query } from "@/lib/db";

export type PlatformSettings = {
  companyName: string;
  supportEmail: string;
  gstNumber: string;
  /** Legal address printed on tax invoices (Master Admin Settings). */
  sellerAddress: string;
  /** Seller state for GST CGST/SGST vs IGST and invoice header. */
  sellerState: string;
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
  objectCaptureEnabled: boolean;
  platformStorageLimitGb: number;
  platformBandwidthLimitGb: number;
  landingPrivacyPolicy: string;
  landingTermsOfService: string;
  landingHeroModel: string;
  landingAddress: string;
  landingFurnitureModel: string;
  landingTilesModel: string;
  landingShoesModel: string;
  landingPackagingModel: string;
  landingElectronicsModel: string;
  landingJewelryModel: string;
  landingFashionModel: string;
  landingAutomotiveModel: string;
};

export const defaultPlatformSettings: PlatformSettings = {
  companyName: process.env.BILLING_SELLER_NAME || "AR360 Studio",
  supportEmail: process.env.BILLING_SUPPORT_EMAIL || "support@ar360.studio",
  gstNumber: process.env.BILLING_SELLER_GSTIN || "",
  sellerAddress: process.env.BILLING_SELLER_ADDRESS || "India",
  sellerState: process.env.BILLING_SELLER_STATE || "Gujarat",
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
  objectCaptureEnabled: true,
  platformStorageLimitGb: 50,
  platformBandwidthLimitGb: 4096, // 4 TB
  landingPrivacyPolicy: `<p>Last updated: July 2026</p><p>AR360 Studio (&quot;we&quot;, &quot;us&quot;) provides a SaaS platform for 3D and AR product experiences. This policy describes how we collect, use, and protect information when you use our website and dashboard.</p><h2>Information we collect</h2><ul><li>Account details such as name, email, company, and billing information.</li><li>Product assets and metadata you upload to the platform.</li><li>Viewer analytics such as page views, device type, country, and engagement events.</li><li>Technical logs required for security, abuse prevention, and service reliability.</li></ul><h2>How we use information</h2><ul><li>Provide and improve the AR360 Studio service.</li><li>Process subscriptions and invoices.</li><li>Show analytics dashboards to account owners.</li><li>Detect fraud, enforce plan limits, and protect customer assets.</li></ul><h2>Sharing</h2><p>We do not sell personal data. We use payment processors (such as Razorpay) and infrastructure providers only as needed to operate the service. Viewer analytics may include hashed IP data for abuse prevention.</p><h2>Retention</h2><p>Account data is retained while your subscription is active. Analytics may be trimmed per plan settings. You may request deletion by contacting support.</p><h2>Security</h2><p>We use encrypted sessions, tenant-isolated storage paths, rate limiting, and access controls. No method of transmission over the Internet is 100% secure; we continuously improve our safeguards.</p><h2>Contact</h2><p>Privacy questions: privacy@ar360.studio</p>`,
  landingTermsOfService: `<p>Last updated: July 2026</p><p>By accessing AR360 Studio you agree to these terms. If you do not agree, do not use the service.</p><h2>Service</h2><p>AR360 Studio provides tools to host 3D models, publish viewers, generate QR/embed links, and view analytics. Features vary by plan and may change as the product evolves.</p><h2>Accounts</h2><p>You are responsible for safeguarding login credentials and for activity under your account. You must provide accurate registration information and comply with applicable laws.</p><h2>Acceptable use</h2><ul><li>Upload only content you have rights to distribute.</li><li>Do not upload malware, illegal content, or material that infringes third-party rights.</li><li>Do not attempt to bypass plan limits, security controls, or other customers&apos; data.</li></ul><h2>Plans &amp; billing</h2><p>Paid plans renew according to the billing cycle selected at checkout unless cancelled. Fees are non-refundable except where required by law or explicitly approved by AR360 Studio support.</p><h2>Availability</h2><p>We aim for high availability but do not guarantee uninterrupted service. Maintenance, third-party outages, or force majeure may cause downtime.</p><h2>Limitation of liability</h2><p>To the maximum extent permitted by law, AR360 Studio is not liable for indirect or consequential damages arising from use of the platform. Our total liability is limited to fees paid in the twelve months before the claim.</p><h2>Contact</h2><p>Legal inquiries: legal@ar360.studio</p>`,
  landingHeroModel: "/models/chair_01.glb",
  landingAddress: "AR360 Studio · India",
  landingFurnitureModel: "/models/use-cases/furniture.glb",
  landingTilesModel: "/models/use-cases/tiles.glb",
  landingShoesModel: "/models/use-cases/shoes.glb",
  landingPackagingModel: "/models/use-cases/packaging.glb",
  landingElectronicsModel: "/models/use-cases/electronics.glb",
  landingJewelryModel: "/models/use-cases/jewelry.glb",
  landingFashionModel: "/models/use-cases/fashion.glb",
  landingAutomotiveModel: "/models/use-cases/automotive.glb",
};

const numberKeys = new Set([
  "maxLoginAttempts",
  "lockMinutes",
  "expiryWarningDays",
  "storageWarningPercent",
  "bandwidthWarningPercent",
  "smtpPort",
  "nativeSubscriptionRolloutPercent",
  "platformStorageLimitGb",
  "platformBandwidthLimitGb",
]);
const booleanKeys = new Set([
  "autoDeleteExpiredData",
  "maintenanceMode",
  "emailNotifications",
  "objectCaptureEnabled",
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

let cachedPlatformSettings: { value: PlatformSettings; at: number } | null = null;
const PLATFORM_SETTINGS_TTL_MS = 30_000;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (
    cachedPlatformSettings &&
    Date.now() - cachedPlatformSettings.at < PLATFORM_SETTINGS_TTL_MS
  ) {
    return cachedPlatformSettings.value;
  }

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
  const resolved = settings as PlatformSettings;
  cachedPlatformSettings = { value: resolved, at: Date.now() };
  return resolved;
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
  cachedPlatformSettings = null;
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
