import type { CustomerUser } from "@/lib/auth";
import { getSessionCustomerUid } from "@/lib/customerIsolation";
import { checkSubscription, type SubscriptionCheckResult } from "@/lib/subscription/check-subscription";
import { mapLegacyPlanId, formatTrialDurationLabel, normalizeTrialHours, planAllowsProductContact } from "@/lib/billing/plan-enforcement";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { getBillingPlans } from "@/lib/billing/admin-plans";
import { getPlanDisplayName } from "@/lib/billing/plans";
import { ensureDefaultWorkspace } from "@/lib/enterprise/workspace.service";
import { query } from "@/lib/db";

export type UserPanelSessionSummary = {
  user: {
    id: number;
    name: string;
    email: string;
    customerUid: string;
    status: "Active" | "Suspended" | "Deleted";
  };
  workspace: {
    workspaceUid: string;
    name: string;
  } | null;
  subscription: SubscriptionCheckResult;
  plan: {
    id: string;
    name: string;
    priceMonthlyInr: number | null;
    priceYearlyInr: number | null;
  };
  usage: {
    productsUsed: number;
    productLimit: number | null;
    storageUsedMb: number;
    storageLimitMb: number | null;
    bandwidthUsedMb: number;
    bandwidthLimitMb: number | null;
    unlimitedStorage: boolean;
    unlimitedBandwidth: boolean;
  };
  unreadNotifications: number;
  onboarding: {
    complete: boolean;
    status: string;
    currentStep: number;
  };
  hasActiveEnterpriseContract: boolean;
  addons: {
    clientManagement: boolean;
    teamManagement: boolean;
  };
  /** Live plan capability gates from Master Admin (re-read every session load). */
  features: {
    allowViewer: boolean;
    allowUpload: boolean;
    allowAr: boolean;
    allowQr: boolean;
    allowShare: boolean;
    allowEmbed: boolean;
    allowAnalytics: boolean;
    allowCustomBranding: boolean;
    allowCustomDomain: boolean;
    allowObjectCapture: boolean;
    allowProductContact: boolean;
    prioritySupport: boolean;
  };
  platformFlags: {
    objectCaptureEnabled: boolean;
  };
  /** True when Master Admin suspended the account — Support-only panel. */
  accountSuspended: boolean;
  /** First dashboard visit after onboarding — free trial limits from Master Admin. */
  trialWelcome: {
    show: boolean;
    planName: string;
    trialLabel: string;
    trialDays: number;
    daysRemaining: number | null;
    expiresAt: string | null;
    productsLimit: number | null;
    storageLimitMb: number | null;
    bandwidthLimitMb: number | null;
    unlimitedStorage: boolean;
    unlimitedBandwidth: boolean;
  } | null;
};

async function safeCount(sql: string, values: (string | number)[]) {
  try {
    const rows = await query<{ total: number }>(sql, values);
    return Number(rows[0]?.total || 0);
  } catch {
    return 0;
  }
}

async function safeStorageMb(customerUid: string) {
  try {
    const rows = await query<{ total: string | number | null }>(
      "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM product_assets WHERE customer_uid = ?",
      [customerUid],
    );
    return Number(rows[0]?.total || 0) / 1024 / 1024;
  } catch {
    try {
      const rows = await query<{ storage_used_mb: string | number | null }>(
        "SELECT storage_used_mb FROM customers WHERE customer_uid = ? LIMIT 1",
        [customerUid],
      );
      return Number(rows[0]?.storage_used_mb || 0);
    } catch {
      return 0;
    }
  }
}

async function safeBandwidthMb(customerUid: string) {
  try {
    const { getCustomerBandwidthUsedMb } = await import("@/lib/billing/bandwidth");
    return await getCustomerBandwidthUsedMb(customerUid);
  } catch {
    return 0;
  }
}

async function unreadNotificationCount(customerUid: string) {
  try {
    return await safeCount(
      "SELECT COUNT(*) AS total FROM customer_notifications WHERE customer_uid = ? AND is_read = FALSE",
      [customerUid],
    );
  } catch {
    return 0;
  }
}

/** Server-side user panel context — auth, workspace, plan, usage (MySQL authoritative). */
export async function getUserPanelSessionSummary(user: CustomerUser): Promise<UserPanelSessionSummary | null> {
  const customerUid = getSessionCustomerUid(user);
  if (!customerUid) return null;

  const subscription = await checkSubscription(customerUid);
  const planId = mapLegacyPlanId(subscription.plan?.id || "trial");
  const [planLimits, billingPlans, productsUsed, storageUsedMb, bandwidthUsedMb, unreadNotifications, onboardingRow, hasActiveEnterpriseContract, clientAddonActive, teamAddonActive, platformSettings] =
    await Promise.all([
      resolveCustomerPlanLimits(customerUid),
      getBillingPlans({ activeOnly: false }).catch(() => []),
      safeCount(
        "SELECT COUNT(*) AS total FROM products WHERE customer_uid = ? AND deleted_at IS NULL",
        [customerUid],
      ).catch(() =>
        safeCount("SELECT COUNT(*) AS total FROM products WHERE customer_uid = ?", [customerUid]),
      ),
      safeStorageMb(customerUid),
      safeBandwidthMb(customerUid),
      unreadNotificationCount(customerUid),
      import("@/lib/onboarding/onboarding.service").then((mod) => mod.getCustomerOnboarding(customerUid)).catch(() => null),
      import("@/lib/enterprise-sales/customer-dashboard.service")
        .then((mod) => mod.hasActiveEnterpriseContract(customerUid))
        .catch(() => false),
      import("@/lib/billing/addons").then((mod) => mod.hasClientManagementAccess(customerUid)).catch(() => false),
      import("@/lib/billing/addons").then((mod) => mod.hasTeamManagementAccess(customerUid)).catch(() => false),
      import("@/lib/master-admin-settings").then((mod) => mod.getPlatformSettings()).catch(() => null),
    ]);

  const effectivePlanId = String(planLimits.planId);
  // For ecp_ custom plans, never pick the catalog Enterprise row as the name
  // source — that would overwrite "Ak Enterprise" with generic "ENTERPRISE".
  const isCustomEnterprise = effectivePlanId.toLowerCase().startsWith("ecp_");
  const adminPlan = isCustomEnterprise
    ? null
    : billingPlans.find((plan) => plan.id === effectivePlanId) ||
      billingPlans.find((plan) => mapLegacyPlanId(plan.id) === mapLegacyPlanId(effectivePlanId)) ||
      billingPlans.find((plan) => mapLegacyPlanId(plan.id) === planId);

  let workspace: UserPanelSessionSummary["workspace"] = null;
  try {
    const row = await ensureDefaultWorkspace({
      userId: user.id,
      customerUid,
      name: `${user.name}'s Workspace`,
      plan: effectivePlanId,
    });
    workspace = { workspaceUid: row.workspace_uid, name: row.name };
  } catch {
    workspace = null;
  }

  const accountSuspended =
    user.status === "Suspended" || user.customerStatus === "Suspended";
  const statusLabel =
    (user.customerStatus as UserPanelSessionSummary["user"]["status"]) ||
    user.status ||
    "Active";

  const onboardingComplete = onboardingRow
    ? onboardingRow.status === "completed" || onboardingRow.status === "skipped"
    : true;
  const planName = getPlanDisplayName(effectivePlanId, planLimits.name || adminPlan?.name);
  const isTrialPlan = effectivePlanId === "trial" || effectivePlanId === "free";
  const trialHours = normalizeTrialHours(
    planLimits.trialHours ?? adminPlan?.trialHours ?? 72,
  );
  const trialDays = Math.max(1, Math.round(trialHours / 24));
  const trialWelcome =
    !accountSuspended &&
    onboardingComplete &&
    isTrialPlan &&
    !onboardingRow?.welcomePopupDismissedAt
      ? {
          show: true as const,
          planName,
          trialLabel: formatTrialDurationLabel(trialHours),
          trialDays,
          daysRemaining: subscription.daysRemaining ?? null,
          expiresAt: subscription.expiresAt || null,
          productsLimit: planLimits.products ?? null,
          storageLimitMb: planLimits.storageMb ?? null,
          bandwidthLimitMb: planLimits.bandwidthGb ? planLimits.bandwidthGb * 1024 : null,
          unlimitedStorage: Boolean(planLimits.unlimitedStorage),
          unlimitedBandwidth: Boolean(planLimits.unlimitedBandwidth),
        }
      : null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      customerUid,
      status: statusLabel,
    },
    workspace,
    subscription,
    plan: {
      id: effectivePlanId,
      name: planName,
      priceMonthlyInr: adminPlan?.priceMonthlyInr ?? null,
      priceYearlyInr: adminPlan?.priceYearlyInr ?? null,
    },
    usage: {
      productsUsed,
      productLimit: planLimits.products,
      storageUsedMb: Math.round(storageUsedMb * 10) / 10,
      storageLimitMb: planLimits.storageMb,
      bandwidthUsedMb: Math.round(bandwidthUsedMb * 10) / 10,
      bandwidthLimitMb: planLimits.bandwidthGb ? planLimits.bandwidthGb * 1024 : null,
      unlimitedStorage: Boolean(planLimits.unlimitedStorage),
      unlimitedBandwidth: Boolean(planLimits.unlimitedBandwidth),
    },
    unreadNotifications,
    onboarding: {
      // Missing row = legacy account (treat complete). New signups always insert a row.
      complete: onboardingComplete,
      status: onboardingRow?.status || "completed",
      currentStep: onboardingRow?.currentStep || 4,
    },
    hasActiveEnterpriseContract,
    addons: {
      clientManagement: clientAddonActive,
      teamManagement: teamAddonActive,
    },
    features: {
      allowViewer: planLimits.allowViewer !== false,
      allowUpload: planLimits.allowUpload !== false,
      allowAr: planLimits.allowAr !== false,
      allowQr: planLimits.allowQr !== false,
      allowShare: planLimits.allowShare !== false,
      allowEmbed: Boolean(planLimits.allowEmbed),
      allowAnalytics: Boolean(planLimits.advancedAnalytics),
      allowCustomBranding: Boolean(planLimits.allowCustomBranding),
      allowCustomDomain: Boolean(planLimits.allowCustomDomain),
      allowObjectCapture: planLimits.allowObjectCapture !== false,
      allowProductContact: planAllowsProductContact(planLimits),
      prioritySupport: Boolean(planLimits.prioritySupport),
    },
    platformFlags: {
      objectCaptureEnabled: platformSettings?.objectCaptureEnabled !== false,
    },
    accountSuspended,
    trialWelcome,
  };
}
