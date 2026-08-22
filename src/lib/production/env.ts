export type EnvCheckResult = {
  key: string;
  required: boolean;
  present: boolean;
  feature: string;
};

export const productionEnvSpec = [
  { key: "MYSQL_HOST", required: true, feature: "database" },
  { key: "MYSQL_USER", required: true, feature: "database" },
  { key: "MYSQL_DATABASE", required: true, feature: "database" },
  { key: "NEXT_PUBLIC_APP_URL", required: true, feature: "app" },
  { key: "AUTH_SECRET", required: true, feature: "auth" },
  { key: "WORKER_SECRET", required: true, feature: "workers" },
  { key: "RAZORPAY_KEY_ID", required: false, feature: "billing" },
  { key: "RAZORPAY_KEY_SECRET", required: false, feature: "billing" },
  { key: "NEXT_PUBLIC_RAZORPAY_KEY_ID", required: false, feature: "billing" },
  { key: "RAZORPAY_WEBHOOK_SECRET", required: false, feature: "billing" },
  { key: "BILLING_SELLER_NAME", required: false, feature: "invoice" },
  { key: "BILLING_SELLER_GSTIN", required: false, feature: "invoice" },
  { key: "SMTP_HOST", required: false, feature: "email" },
  { key: "SMTP_USER", required: false, feature: "email" },
  { key: "SMTP_PASSWORD", required: false, feature: "email" },
  { key: "SMTP_FROM", required: false, feature: "email" },
  { key: "SENTRY_DSN", required: false, feature: "monitoring" },
  { key: "AR360_INTERNAL_KEY", required: false, feature: "custom-domain" },
] as const;

export function getProductionEnvReport(): EnvCheckResult[] {
  return productionEnvSpec.map((item) => ({
    ...item,
    present: Boolean(process.env[item.key]),
  }));
}

export function getMissingRequiredEnv() {
  return getProductionEnvReport().filter((item) => item.required && !item.present);
}

export function isAuthSecretStrong() {
  const secret = process.env.AUTH_SECRET || "";
  return secret.length >= 32 && secret !== "replace-with-a-long-random-secret" && secret !== "dev-only-change-this-auth-secret";
}
