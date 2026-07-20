import type { PlanId } from "@/lib/billing/plans";

export type PlanLimits = {
  planId: PlanId | string;
  name: string;
  products: number | null;
  storageMb: number | null;
  bandwidthGb?: number | null;
  qrCodes?: number | null;
  shareLinks?: number | null;
  trialHours?: number | null;
  allowViewer: boolean;
  allowUpload: boolean;
  allowAr: boolean;
  allowQr?: boolean;
  allowShare?: boolean;
  allowCustomBranding: boolean;
  allowEmbed?: boolean;
  advancedAnalytics?: boolean;
  priorityProcessing?: boolean;
  unlimitedStorage?: boolean;
  unlimitedBandwidth?: boolean;
  /** Enterprise custom-plan fields. Undefined for standard plans. */
  isEnterpriseCustom?: boolean;
  modelLimit?: number | null;
  arExperienceLimit?: number | null;
  teamMemberLimit?: number | null;
  prioritySupport?: boolean;
  dedicatedInfrastructure?: boolean;
  slaSupport?: boolean;
  supportLevel?: string | null;
  /** Object Capture (DB-backed). */
  allowObjectCapture?: boolean;
  ocCapturesPerMonth?: number | null;
  ocComputeSecondsPerMonth?: number | null;
  ocConcurrentJobs?: number | null;
  ocMaxRetries?: number | null;
  /** Custom hostname for public viewer/share/embed. */
  allowCustomDomain?: boolean;
};

export type UsageSnapshot = {
  productsUsed: number;
  storageUsedMb: number;
  bandwidthUsedGb?: number;
  modelsUsed?: number;
  arExperiencesUsed?: number;
  /** Canonical QR meter — prefer over productsUsed for QR limits. */
  qrCodesUsed?: number;
  shareLinksUsed?: number;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  subscriptionStatus?: string | null;
};

export type EntitlementResult = {
  allowed: boolean;
  reason?: string;
  code?: string;
  upgradeRequired?: boolean;
  trialExpired?: boolean;
  limitType?: "trial" | "products" | "storage" | "bandwidth" | "models" | "ar_experiences" | "qr" | "share" | "status";
};

export function mapLegacyPlanId(planId: string): string {
  const clean = planId.toLowerCase().trim();
  if (clean === "free") return "trial";
  if (clean === "basic") return "starter";
  if (clean === "professional") return "pro";
  return clean;
}

export const DEFAULT_PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: {
    planId: "trial",
    name: "Free Trial",
    products: 1,
    storageMb: 100,
    bandwidthGb: 1,
    trialHours: 24,
    allowViewer: true,
    allowUpload: true,
    allowAr: true,
    allowCustomBranding: false,
    allowCustomDomain: false,
    unlimitedStorage: false,
    unlimitedBandwidth: false,
  },
  starter: {
    planId: "starter",
    name: "Starter",
    products: 5,
    storageMb: 512,
    bandwidthGb: 5,
    allowViewer: true,
    allowUpload: true,
    allowAr: true,
    allowCustomBranding: false,
    allowCustomDomain: false,
    unlimitedStorage: false,
    unlimitedBandwidth: false,
  },
  pro: {
    planId: "pro",
    name: "Pro",
    products: 50,
    storageMb: 5120,
    bandwidthGb: 50,
    allowViewer: true,
    allowUpload: true,
    allowAr: true,
    allowCustomBranding: true,
    allowCustomDomain: false,
    unlimitedStorage: false,
    unlimitedBandwidth: false,
  },
  business: {
    planId: "business",
    name: "Business",
    products: 250,
    storageMb: 25600,
    bandwidthGb: 250,
    allowViewer: true,
    allowUpload: true,
    allowAr: true,
    allowCustomBranding: true,
    allowCustomDomain: true,
    unlimitedStorage: false,
    unlimitedBandwidth: false,
  },
  enterprise: {
    planId: "enterprise",
    name: "Enterprise",
    products: 250,
    storageMb: 25600,
    bandwidthGb: 250,
    allowViewer: true,
    allowUpload: true,
    allowAr: true,
    allowCustomBranding: true,
    allowCustomDomain: true,
    unlimitedStorage: false,
    unlimitedBandwidth: false,
  },
};

export function isTrialExpired(usage: UsageSnapshot) {
  if (!usage.trialEndsAt) return false;
  return Date.now() > new Date(usage.trialEndsAt).getTime();
}

export function checkUploadEntitlement(
  plan: PlanLimits,
  usage: UsageSnapshot,
  isEdit = false,
  uploadSizeMb = 0
): EntitlementResult {
  if (!plan.allowUpload) {
    return { allowed: false, reason: "Upload is not available on your current plan.", upgradeRequired: true, limitType: "status" };
  }

  if (plan.planId === "free" || plan.planId === "trial") {
    if (isTrialExpired(usage)) {
      return { allowed: false, reason: "Your 24 hours trial has expired. Upgrade to continue uploading or editing products.", upgradeRequired: true, trialExpired: true, limitType: "trial" };
    }
    if (usage.productsUsed > 1) {
      return { allowed: false, reason: "Trial limit exceeded. You have more than 1 product. Upgrade to edit or manage products.", upgradeRequired: true, limitType: "products" };
    }
    if (!isEdit && usage.productsUsed >= 1) {
      return { allowed: false, code: "PRODUCT_LIMIT_REACHED", reason: "Trial limit reached. Your trial plan allows 1 product only. Upgrade to continue uploading.", upgradeRequired: true, limitType: "products" };
    }
  }

  if (!isEdit && plan.products !== null && usage.productsUsed >= plan.products) {
    return {
      allowed: false,
      code: "PRODUCT_LIMIT_REACHED",
      reason: `You have reached your ${plan.products}-product limit. Upgrade your plan to create more products.`,
      upgradeRequired: true,
      limitType: "products",
    };
  }

  if (plan.unlimitedStorage) {
    return { allowed: true };
  }

  const finalUsedMb = usage.storageUsedMb + uploadSizeMb;
  if (plan.storageMb !== null && finalUsedMb > plan.storageMb) {
    return {
      allowed: false,
      code: "STORAGE_LIMIT_REACHED",
      reason: "You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",
      upgradeRequired: true,
      limitType: "storage",
    };
  }

  return { allowed: true };
}

export function checkBandwidthEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (plan.unlimitedBandwidth) {
    return { allowed: true };
  }

  const limitGb = Number(plan.bandwidthGb || 0);
  const usedGb = Number(usage.bandwidthUsedGb ?? 0);

  if (limitGb > 0 && usedGb >= limitGb) {
    return {
      allowed: false,
      reason: "Monthly bandwidth limit reached. Upgrade your plan to restore viewer access.",
      upgradeRequired: true,
      limitType: "bandwidth",
    };
  }

  return { allowed: true };
}

export function checkViewerEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (!plan.allowViewer) {
    return { allowed: false, reason: "Viewer is disabled for your current plan.", upgradeRequired: true, limitType: "status" };
  }

  if (plan.planId === "free" || plan.planId === "trial") {
    if (isTrialExpired(usage)) {
      return { allowed: false, reason: "This trial viewer has expired. Upgrade to reactivate the public viewer.", upgradeRequired: true, trialExpired: true, limitType: "trial" };
    }
    if (usage.productsUsed > 1) {
      return { allowed: false, reason: "Trial limit exceeded. You have more than 1 product. Upgrade to reactivate the viewer.", upgradeRequired: true, limitType: "products" };
    }
  }

  const bandwidth = checkBandwidthEntitlement(plan, usage);
  if (!bandwidth.allowed) return bandwidth;

  return { allowed: true };
}

export function checkArEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (plan.allowAr === false) {
    return { allowed: false, reason: "AR is not included in your current plan. Upgrade to unlock AR.", upgradeRequired: true, limitType: "status" };
  }
  return checkViewerEntitlement(plan, usage);
}

export function checkQrEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (plan.allowQr === false) {
    return { allowed: false, reason: "QR codes are not included in your current plan.", upgradeRequired: true, limitType: "qr" };
  }
  const viewer = checkViewerEntitlement(plan, usage);
  if (!viewer.allowed) return viewer;
  const qrUsed = Number(usage.qrCodesUsed ?? usage.productsUsed ?? 0);
  if (plan.qrCodes != null && qrUsed >= Number(plan.qrCodes)) {
    return {
      allowed: false,
      reason: `QR code limit reached (${plan.qrCodes}). Upgrade your plan for more QR codes.`,
      upgradeRequired: true,
      limitType: "qr",
    };
  }
  return { allowed: true };
}

export function checkShareEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (plan.allowShare === false) {
    return { allowed: false, reason: "Share links are not included in your current plan.", upgradeRequired: true, limitType: "share" };
  }
  const viewer = checkViewerEntitlement(plan, usage);
  if (!viewer.allowed) return viewer;
  if (plan.shareLinks != null && Number(usage.shareLinksUsed ?? 0) >= Number(plan.shareLinks)) {
    return {
      allowed: false,
      reason: `Share link limit reached (${plan.shareLinks}). Upgrade your plan for more share links.`,
      upgradeRequired: true,
      limitType: "share",
    };
  }
  return { allowed: true };
}

export function checkEmbedEntitlement(plan: PlanLimits, usage: UsageSnapshot): EntitlementResult {
  if (plan.allowEmbed === false) {
    return {
      allowed: false,
      reason: "Embed viewer is not available on your current plan. Upgrade to Professional or higher.",
      upgradeRequired: true,
      limitType: "status",
    };
  }

  return checkViewerEntitlement(plan, usage);
}

/** Custom-plan-only 3D model creation check. Standard plans are deliberately unchanged. */
export function checkEnterpriseModelEntitlement(
  plan: PlanLimits,
  modelsUsed: number,
): EntitlementResult {
  if (!plan.isEnterpriseCustom || plan.modelLimit == null) return { allowed: true };
  if (modelsUsed < plan.modelLimit) return { allowed: true };
  return {
    allowed: false,
    code: "MODEL_LIMIT_REACHED",
    reason: `You have reached your ${plan.modelLimit}-model limit. Contact support to increase your Enterprise allowance.`,
    upgradeRequired: true,
    limitType: "models",
  };
}

/** Custom-plan-only AR experience creation check. Republishing is handled by callers. */
export function checkEnterpriseArExperienceEntitlement(
  plan: PlanLimits,
  arExperiencesUsed: number,
): EntitlementResult {
  if (!plan.isEnterpriseCustom || plan.arExperienceLimit == null) return { allowed: true };
  if (arExperiencesUsed < plan.arExperienceLimit) return { allowed: true };
  return {
    allowed: false,
    code: "AR_EXPERIENCE_LIMIT_REACHED",
    reason: `You have reached your ${plan.arExperienceLimit}-AR-experience limit. Contact support to increase your Enterprise allowance.`,
    upgradeRequired: true,
    limitType: "ar_experiences",
  };
}

export function getUsagePercent(used: number, limit: number | null) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
