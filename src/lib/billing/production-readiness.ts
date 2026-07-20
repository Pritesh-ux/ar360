import { query } from "@/lib/db";
import { getPlatformSettings } from "@/lib/master-admin-settings";

export type BillingReadinessCheck = {
  ok: boolean;
  detail: string;
};

export type BillingReadiness = {
  required: boolean;
  ok: boolean;
  checks: Record<string, BillingReadinessCheck>;
};

type LiveMappingRow = {
  plan_id: string;
  billing_interval: "monthly" | "yearly";
};

export function evaluateLiveBillingReadiness(input: {
  mode: "test" | "live";
  nativeCheckoutEnabled: boolean;
  rolloutPercent: number;
  allowlist: string;
  killSwitch: boolean;
  keyId: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  hasEncryptionKey: boolean;
  requiredMappings: string[];
  liveMappings: string[];
}): BillingReadiness {
  const rolloutEnabled =
    input.mode === "live"
    && !input.killSwitch
    && input.nativeCheckoutEnabled
    && (input.rolloutPercent > 0 || input.allowlist.trim().length > 0);
  if (!rolloutEnabled) {
    return {
      required: false,
      ok: true,
      checks: { liveRollout: { ok: true, detail: "disabled" } },
    };
  }

  const liveMappingSet = new Set(input.liveMappings);
  const missingMappings = input.requiredMappings.filter((mapping) => !liveMappingSet.has(mapping));
  const checks = {
    liveKey: {
      ok: input.keyId.startsWith("rzp_live_") && input.hasKeySecret,
      detail: input.keyId.startsWith("rzp_live_") && input.hasKeySecret ? "configured" : "missing-or-not-live",
    },
    webhookSecret: {
      ok: input.hasWebhookSecret,
      detail: input.hasWebhookSecret ? "configured" : "missing",
    },
    encryptionKey: {
      ok: input.hasEncryptionKey,
      detail: input.hasEncryptionKey ? "configured" : "missing",
    },
    livePlanMappings: {
      ok: missingMappings.length === 0,
      detail: missingMappings.length === 0 ? "complete" : `missing: ${missingMappings.join(", ")}`,
    },
  };
  return { required: true, ok: Object.values(checks).every((check) => check.ok), checks };
}

export async function getLiveBillingReadiness(): Promise<BillingReadiness> {
  let settings;
  try {
    settings = await getPlatformSettings();
  } catch (error) {
    return {
      required: true,
      ok: false,
      checks: {
        settings: {
          ok: false,
          detail: error instanceof Error ? error.message : "billing settings unavailable",
        },
      },
    };
  }

  const required = await query<{ id: string; monthly: number | null; yearly: number | null }>(
    `SELECT id, price_monthly_inr AS monthly, price_yearly_inr AS yearly
       FROM billing_plans
      WHERE id IN ('starter','pro','business') AND is_active = 1 AND sales_channel = 'self_service'`,
  );
  const requiredMappings = required.flatMap((plan) => [
    ...(Number(plan.monthly) > 0 ? [`${plan.id}:monthly`] : []),
    ...(Number(plan.yearly) > 0 ? [`${plan.id}:yearly`] : []),
  ]);
  const mappings = await query<LiveMappingRow>(
    `SELECT plan_id, billing_interval
       FROM billing_plan_price_versions
      WHERE provider = 'razorpay' AND provider_mode = 'live'
        AND provider_plan_id IS NOT NULL AND retired_at IS NULL AND publish_status = 'published'`,
  );

  return evaluateLiveBillingReadiness({
    mode: settings.razorpayMode,
    nativeCheckoutEnabled: settings.nativeSubscriptionCheckoutEnabled,
    rolloutPercent: settings.nativeSubscriptionRolloutPercent,
    allowlist: settings.razorpayRolloutAllowlist,
    killSwitch: settings.razorpayKillSwitch,
    keyId: settings.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "",
    hasKeySecret: Boolean(settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET),
    hasWebhookSecret: Boolean(settings.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET),
    hasEncryptionKey: Boolean(process.env.BILLING_SETTINGS_ENCRYPTION_KEY),
    requiredMappings,
    liveMappings: mappings.map((mapping) => `${mapping.plan_id}:${mapping.billing_interval}`),
  });
}
