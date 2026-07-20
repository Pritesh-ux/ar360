import { getRazorpayKeys } from "@/lib/master-admin-settings";

export type RazorpayRuntimeConfig = {
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  publicKeyId: string | null;
  mode: "test" | "live" | "unknown";
};

function detectMode(keyId: string | null): RazorpayRuntimeConfig["mode"] {
  if (!keyId) return "unknown";
  if (keyId.startsWith("rzp_test_")) return "test";
  if (keyId.startsWith("rzp_live_")) return "live";
  return "unknown";
}

/** Server-only Razorpay configuration — never expose secrets to the client. */
export async function getRazorpayRuntimeConfig(): Promise<RazorpayRuntimeConfig> {
  const keys = await getRazorpayKeys();
  const envPublic = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null;
  const keyId = keys.keyId || envPublic;

  return {
    keyId: keys.keyId || null,
    hasKeySecret: Boolean(keys.keySecret || process.env.RAZORPAY_KEY_SECRET),
    hasWebhookSecret: Boolean(keys.webhookSecret),
    publicKeyId: envPublic || keys.keyId || null,
    mode: detectMode(keyId),
  };
}

export async function assertRazorpayCheckoutReady() {
  const config = await getRazorpayRuntimeConfig();
  if (!config.keyId || !config.hasKeySecret) {
    throw new Error("Razorpay keys missing. Add keys in Master Admin → Settings → Payment Settings.");
  }
  return config;
}

export async function assertRazorpayWebhookReady() {
  const config = await getRazorpayRuntimeConfig();
  if (!config.hasWebhookSecret) {
    throw new Error("Razorpay webhook secret missing.");
  }
  return config;
}
