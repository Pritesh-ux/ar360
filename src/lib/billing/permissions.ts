/**
 * Single backend permission gate. Every protected action must go through assertCan.
 * Frontend checks are UX-only; this is authoritative.
 */
import { getSubscriptionContext, type SubscriptionContext } from "@/lib/billing/subscription-engine";
import {
  checkUploadEntitlement,
  checkViewerEntitlement,
  checkArEntitlement,
  checkQrEntitlement,
  checkShareEntitlement,
  checkEmbedEntitlement,
  checkEnterpriseModelEntitlement,
  checkEnterpriseArExperienceEntitlement,
  type EntitlementResult,
  type UsageSnapshot,
} from "@/lib/billing/plan-enforcement";
import {
  checkProductLimit,
  checkStorageLimit,
  checkQrLimit,
  checkShareLinkLimit,
  type LimitCheckResult,
} from "@/lib/billing/limit-enforcement";
import { getCustomerBandwidthUsedGb } from "@/lib/billing/bandwidth";

export type PermissionAction =
  | "access_dashboard"
  | "upload"
  | "create_product"
  | "viewer"
  | "ar"
  | "qr"
  | "share"
  | "embed"
  | "custom_branding"
  | "custom_domain"
  | "analytics"
  | "object_capture";

export type AssertCanResult =
  | { allowed: true; context: SubscriptionContext }
  | {
      allowed: false;
      context: SubscriptionContext;
      code: string;
      message: string;
      upgradeRequired: boolean;
      trialExpired?: boolean;
      limitType?: string;
    };

function usageFromContext(ctx: SubscriptionContext, bandwidthUsedGb: number): UsageSnapshot {
  return {
    productsUsed: ctx.usage.productsUsed,
    storageUsedMb: ctx.usage.storageUsedMb,
    bandwidthUsedGb,
    modelsUsed: ctx.usage.modelsUsed,
    arExperiencesUsed: ctx.usage.arExperiencesUsed,
    qrCodesUsed: ctx.usage.qrCodesUsed,
    shareLinksUsed: ctx.usage.shareLinksUsed,
    trialStartedAt: null,
    trialEndsAt: ctx.expiresAt,
    subscriptionStatus: ctx.subscription.reason,
  };
}

function deny(
  context: SubscriptionContext,
  entitlement: EntitlementResult,
): AssertCanResult {
  return {
    allowed: false,
    context,
    code: entitlement.code || entitlement.limitType || "PERMISSION_DENIED",
    message: entitlement.reason || "This action is not allowed on your current plan.",
    upgradeRequired: Boolean(entitlement.upgradeRequired),
    trialExpired: entitlement.trialExpired,
    limitType: entitlement.limitType,
  };
}

function denyLimit(context: SubscriptionContext, limit: LimitCheckResult & { ok: false }): AssertCanResult {
  return {
    allowed: false,
    context,
    code: limit.code,
    message: limit.message,
    upgradeRequired: true,
    limitType: String(limit.code).toLowerCase(),
  };
}

function denyInactive(context: SubscriptionContext, message?: string): AssertCanResult {
  return {
    allowed: false,
    context,
    code: "SUBSCRIPTION_INACTIVE",
    message: message || "Your plan is not active. Please upgrade or renew to continue.",
    upgradeRequired: true,
    limitType: "status",
  };
}

/**
 * Authoritative permission check for a customer action.
 * Loads subscription context once; callers can reuse `context` from the result.
 */
export async function assertCan(
  customerUid: string,
  action: PermissionAction,
  options?: {
    /** Incoming upload size in bytes (storage projection). */
    incomingBytes?: number;
    replaceBytes?: number;
    /** Skip product-count check for edit flows. */
    isEdit?: boolean;
    /** Preloaded context to avoid double-fetch. */
    context?: SubscriptionContext;
  },
): Promise<AssertCanResult> {
  const context = options?.context || (await getSubscriptionContext(customerUid));
  const plan = context.limits;
  const planId = context.planId;

  if (action === "access_dashboard") {
    if (!context.subscription.active) {
      return denyInactive(context);
    }
    return { allowed: true, context };
  }

  // Feature gates that require an active subscription
  if (!context.subscription.active) {
    return denyInactive(context);
  }

  const bandwidthUsedGb = await getCustomerBandwidthUsedGb(customerUid).catch(() => 0);
  const usage = usageFromContext(context, bandwidthUsedGb);
  // Prefer QR/share meters from usage engine (not productsUsed)
  usage.productsUsed = context.usage.productsUsed;

  if (action === "custom_branding") {
    if (!plan.allowCustomBranding) {
      return deny(context, {
        allowed: false,
        reason: "Custom branding is not included in your current plan.",
        upgradeRequired: true,
        limitType: "status",
      });
    }
    return { allowed: true, context };
  }

  if (action === "custom_domain") {
    if (!plan.allowCustomDomain) {
      return deny(context, {
        allowed: false,
        reason: "Custom domains are not included in your current plan. Upgrade to Business or Enterprise.",
        upgradeRequired: true,
        limitType: "status",
      });
    }
    return { allowed: true, context };
  }

  if (action === "analytics") {
    if (!plan.advancedAnalytics) {
      return deny(context, {
        allowed: false,
        reason: "Advanced analytics is not included in your current plan.",
        upgradeRequired: true,
        limitType: "status",
      });
    }
    return { allowed: true, context };
  }

  if (action === "object_capture") {
    if (plan.allowObjectCapture === false) {
      return deny(context, {
        allowed: false,
        reason: "Object Capture is not included in your current plan.",
        upgradeRequired: true,
        limitType: "status",
      });
    }
    return { allowed: true, context };
  }

  if (action === "viewer") {
    const result = checkViewerEntitlement(plan, usage);
    return result.allowed ? { allowed: true, context } : deny(context, result);
  }

  if (action === "ar") {
    const result = checkArEntitlement(plan, usage);
    return result.allowed ? { allowed: true, context } : deny(context, result);
  }

  if (action === "embed") {
    const result = checkEmbedEntitlement(plan, usage);
    return result.allowed ? { allowed: true, context } : deny(context, result);
  }

  if (action === "qr") {
    if (plan.allowQr === false) {
      return deny(context, {
        allowed: false,
        reason: "QR codes are not included in your current plan.",
        upgradeRequired: true,
        limitType: "qr",
      });
    }
    const viewer = checkViewerEntitlement(plan, usage);
    if (!viewer.allowed) return deny(context, viewer);
    const qrLimit = await checkQrLimit(customerUid, planId);
    if (qrLimit.ok === false) return denyLimit(context, qrLimit);
    const result = checkQrEntitlement(plan, usage);
    return result.allowed ? { allowed: true, context } : deny(context, result);
  }

  if (action === "share") {
    if (plan.allowShare === false) {
      return deny(context, {
        allowed: false,
        reason: "Share links are not included in your current plan.",
        upgradeRequired: true,
        limitType: "share",
      });
    }
    const viewer = checkViewerEntitlement(plan, usage);
    if (!viewer.allowed) return deny(context, viewer);
    const shareLimit = await checkShareLinkLimit(customerUid, planId);
    if (shareLimit.ok === false) return denyLimit(context, shareLimit);
    const result = checkShareEntitlement(plan, usage);
    return result.allowed ? { allowed: true, context } : deny(context, result);
  }

  if (action === "create_product" || action === "upload") {
    const isEdit = Boolean(options?.isEdit) && action === "upload";
    if (!isEdit) {
      const productLimit = await checkProductLimit(customerUid, planId);
      if (productLimit.ok === false) return denyLimit(context, productLimit);
    }
    if (options?.incomingBytes && options.incomingBytes > 0) {
      const storageLimit = await checkStorageLimit(
        customerUid,
        options.incomingBytes,
        options.replaceBytes || 0,
        planId,
      );
      if (storageLimit.ok === false) return denyLimit(context, storageLimit);
    }
    const upload = checkUploadEntitlement(plan, usage, isEdit, (options?.incomingBytes || 0) / 1024 / 1024);
    if (!upload.allowed) return deny(context, upload);
    if (plan.isEnterpriseCustom && action === "create_product") {
      const models = checkEnterpriseModelEntitlement(plan, context.usage.modelsUsed);
      if (!models.allowed) return deny(context, models);
    }
    return { allowed: true, context };
  }

  return deny(context, {
    allowed: false,
    reason: `Unknown permission action: ${action}`,
    upgradeRequired: false,
    limitType: "status",
  });
}

/** Convenience: throw-friendly check for API routes. */
export async function requireCan(
  customerUid: string,
  action: PermissionAction,
  options?: Parameters<typeof assertCan>[2],
): Promise<SubscriptionContext> {
  const result = await assertCan(customerUid, action, options);
  if (result.allowed === false) {
    const error = new Error(result.message) as Error & {
      code: string;
      status: number;
      upgradeRequired: boolean;
    };
    error.code = result.code;
    error.status = 403;
    error.upgradeRequired = result.upgradeRequired;
    throw error;
  }
  return result.context;
}

export { checkEnterpriseArExperienceEntitlement };
