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
  // Platform settings win; env is fallback only when panel keys are empty.
  const keyId = keys.keyId || envPublic;

  // Key prefix wins when present so stale razorpayMode cannot disagree with the active key.
  const detected = detectMode(keyId);
  const mode =
    detected === "live" || detected === "test"
      ? detected
      : keys.mode === "live" || keys.mode === "test"
        ? keys.mode
        : "unknown";

  return {
    keyId: keyId || null,
    hasKeySecret: Boolean(keys.keySecret),
    hasWebhookSecret: Boolean(keys.webhookSecret),
    publicKeyId: keyId || null,
    mode,
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
