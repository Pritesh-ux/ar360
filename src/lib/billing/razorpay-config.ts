import { getRazorpayKeys } from "@/lib/master-admin-settings";
import {
  assertStagingRazorpayNotLive,
  detectRazorpayKeyMode,
  isStagingDeployTarget,
  resolveDeployTarget,
} from "@/lib/billing/razorpay-staging-boundary";

export type RazorpayRuntimeConfig = {
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  publicKeyId: string | null;
  mode: "test" | "live" | "unknown";
  deployTarget: ReturnType<typeof resolveDeployTarget>;
  razorpayLiveAllowed: boolean;
};

function detectMode(keyId: string | null): RazorpayRuntimeConfig["mode"] {
  return detectRazorpayKeyMode(keyId);
}

/** Server-only Razorpay configuration — never expose secrets to the client. */
export async function getRazorpayRuntimeConfig(): Promise<RazorpayRuntimeConfig> {
  const keys = await getRazorpayKeys();
  assertStagingRazorpayNotLive(keys);

  const envPublic = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null;
  // getRazorpayKeys already applied staging boundary; do not re-introduce LIVE from NEXT_PUBLIC_*.
  let keyId = keys.keyId || "";
  if (!keyId && !isStagingDeployTarget()) {
    keyId = envPublic || "";
  } else if (!keyId && isStagingDeployTarget() && detectMode(envPublic) === "test") {
    keyId = envPublic || "";
  }

  const detected = detectMode(keyId || null);
  let mode: RazorpayRuntimeConfig["mode"] =
    detected === "live" || detected === "test"
      ? detected
      : keys.mode === "live" || keys.mode === "test"
        ? keys.mode
        : "unknown";

  if (isStagingDeployTarget()) {
    mode = "test";
    if (detectMode(keyId) === "live") {
      keyId = "";
    }
  }

  assertStagingRazorpayNotLive({ keyId, mode: mode === "live" ? "live" : "test" });

  return {
    keyId: keyId || null,
    hasKeySecret: Boolean(keys.keySecret),
    hasWebhookSecret: Boolean(keys.webhookSecret),
    publicKeyId: keyId || null,
    mode,
    deployTarget: resolveDeployTarget(),
    razorpayLiveAllowed: !isStagingDeployTarget(),
  };
}

export async function assertRazorpayCheckoutReady() {
  const config = await getRazorpayRuntimeConfig();
  if (!config.keyId || !config.hasKeySecret) {
    throw new Error("Razorpay keys missing. Add keys in Master Admin → Settings → Payment Settings.");
  }
  if (isStagingDeployTarget() && config.mode !== "test") {
    throw new Error("Razorpay LIVE mode is blocked on staging.");
  }
  if (isStagingDeployTarget() && detectMode(config.keyId) !== "test") {
    throw new Error("Razorpay LIVE credentials are blocked on staging.");
  }
  return config;
}

export async function assertRazorpayWebhookReady() {
  const config = await getRazorpayRuntimeConfig();
  if (!config.hasWebhookSecret) {
    throw new Error("Razorpay webhook secret missing.");
  }
  if (isStagingDeployTarget() && config.mode === "live") {
    throw new Error("Razorpay LIVE mode is blocked on staging.");
  }
  return config;
}
