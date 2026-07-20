import crypto from "crypto";
import type { PlatformSettings } from "@/lib/master-admin-settings";

export type CheckoutRolloutSettings = Pick<
  PlatformSettings,
  "nativeSubscriptionCheckoutEnabled" | "nativeSubscriptionRolloutPercent" | "legacyOneTimeRenewalsEnabled"
> & Partial<Pick<PlatformSettings, "razorpayRolloutAllowlist" | "razorpayKillSwitch">>;

export function rolloutBucket(customerUid: string) {
  const digest = crypto.createHash("sha256").update(`razorpay-subscription:${customerUid}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export function isNativeSubscriptionEligible(customerUid: string, settings: CheckoutRolloutSettings) {
  if (settings.razorpayKillSwitch) return false;
  const allowlist = new Set(String(settings.razorpayRolloutAllowlist || "").split(",").map((item) => item.trim()).filter(Boolean));
  if (allowlist.has(customerUid)) return true;
  const percent = Math.max(0, Math.min(100, Math.floor(settings.nativeSubscriptionRolloutPercent)));
  return settings.nativeSubscriptionCheckoutEnabled && rolloutBucket(customerUid) < percent;
}

export function isEligibleLegacyRenewal(input: {
  enabled: boolean;
  requestedPlanId: string;
  currentPlanId?: string | null;
  salesChannel?: string | null;
}) {
  return Boolean(
    input.enabled &&
    input.salesChannel === "legacy" &&
    input.currentPlanId &&
    input.currentPlanId === input.requestedPlanId,
  );
}
