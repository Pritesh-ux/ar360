import { getBillingPlans, type AdminBillingPlan } from "@/lib/billing/admin-plans";
import {
  DEFAULT_PLAN_LIMITS,
  mapLegacyPlanId,
  type PlanLimits,
} from "@/lib/billing/plan-enforcement";
import { query } from "@/lib/db";
import { ensureEnterpriseCustomPlanFeatureGates } from "@/lib/enterprise-sales/repository";

type EnterpriseCustomPlanRow = {
  custom_plan_uid: string;
  name: string;
  storage_limit_bytes: string | number | null;
  bandwidth_limit_bytes: string | number | null;
  product_limit: number | null;
  model_limit: number | null;
  ar_experience_limit: number | null;
  team_member_limit: number | null;
  custom_branding: number | boolean;
  allow_viewer?: number | boolean | null;
  allow_upload?: number | boolean | null;
  allow_ar?: number | boolean | null;
  allow_qr?: number | boolean | null;
  allow_share?: number | boolean | null;
  allow_embed?: number | boolean | null;
  allow_object_capture?: number | boolean | null;
  allow_custom_domain?: number | boolean | null;
  advanced_analytics?: number | boolean | null;
  qr_limit?: number | null;
  share_link_limit?: number | null;
  oc_captures_per_month?: number | null;
  oc_compute_seconds_per_month?: number | null;
  oc_concurrent_jobs?: number | null;
  oc_max_retries?: number | null;
  priority_support: number | boolean;
  dedicated_infrastructure: number | boolean;
  sla_support: number | boolean;
  support_level: string | null;
};

function adminPlanToLimits(plan: AdminBillingPlan): PlanLimits {
  return {
    planId: plan.id,
    name: plan.name,
    products: plan.products,
    storageMb: Math.round(Number(plan.storageGb || 0) * 1024),
    bandwidthGb: Number(plan.bandwidthGb || 0),
    qrCodes: plan.qrLimit ?? null,
    shareLinks: plan.shareLinkLimit ?? null,
    trialHours: plan.trialHours,
    allowViewer: plan.limits?.allowViewer !== false,
    allowUpload: plan.limits?.allowUpload !== false,
    allowAr: plan.limits?.allowAr !== false,
    allowQr: plan.limits?.allowQr !== false,
    allowShare: plan.limits?.allowShare !== false,
    allowCustomBranding: Boolean(plan.limits?.customBranding),
    allowEmbed: Boolean(plan.limits?.embedViewer),
    advancedAnalytics: Boolean(plan.limits?.advancedAnalytics),
    priorityProcessing: Boolean(plan.limits?.priorityProcessing),
    prioritySupport: Boolean(plan.limits?.prioritySupport),
    unlimitedStorage: Boolean(plan.unlimitedStorage),
    unlimitedBandwidth: Boolean(plan.unlimitedBandwidth),
    allowObjectCapture: plan.limits?.allowObjectCapture !== false,
    ocCapturesPerMonth: plan.ocCapturesPerMonth ?? null,
    ocComputeSecondsPerMonth: plan.ocComputeSecondsPerMonth ?? null,
    ocConcurrentJobs: plan.ocConcurrentJobs ?? null,
    ocMaxRetries: plan.ocMaxRetries ?? null,
    allowCustomDomain: Boolean(plan.limits?.allowCustomDomain),
  };
}

function enterprisePlanToLimits(plan: EnterpriseCustomPlanRow): PlanLimits {
  const storageBytes = plan.storage_limit_bytes == null ? null : Number(plan.storage_limit_bytes);
  const bandwidthBytes = plan.bandwidth_limit_bytes == null ? null : Number(plan.bandwidth_limit_bytes);
  return {
    planId: plan.custom_plan_uid,
    name: plan.name,
    products: plan.product_limit == null ? null : Number(plan.product_limit),
    storageMb: storageBytes == null ? null : storageBytes / 1024 / 1024,
    bandwidthGb: bandwidthBytes == null ? null : bandwidthBytes / 1024 / 1024 / 1024,
    qrCodes: plan.allow_qr === 0 || plan.allow_qr === false ? 0 : plan.qr_limit == null ? null : Number(plan.qr_limit),
    shareLinks:
      plan.allow_share === 0 || plan.allow_share === false
        ? 0
        : plan.share_link_limit == null
          ? null
          : Number(plan.share_link_limit),
    allowViewer: plan.allow_viewer == null ? true : Boolean(plan.allow_viewer),
    allowUpload: plan.allow_upload == null ? true : Boolean(plan.allow_upload),
    allowAr: plan.allow_ar == null ? true : Boolean(plan.allow_ar),
    allowQr: plan.allow_qr == null ? true : Boolean(plan.allow_qr),
    allowShare: plan.allow_share == null ? true : Boolean(plan.allow_share),
    allowCustomBranding: Boolean(plan.custom_branding),
    allowEmbed: plan.allow_embed == null ? true : Boolean(plan.allow_embed),
    advancedAnalytics: Boolean(plan.advanced_analytics),
    unlimitedStorage: storageBytes == null,
    unlimitedBandwidth: bandwidthBytes == null,
    isEnterpriseCustom: true,
    modelLimit: plan.model_limit == null ? null : Number(plan.model_limit),
    arExperienceLimit: plan.ar_experience_limit == null ? null : Number(plan.ar_experience_limit),
    teamMemberLimit: plan.team_member_limit == null ? null : Number(plan.team_member_limit),
    prioritySupport: Boolean(plan.priority_support),
    dedicatedInfrastructure: Boolean(plan.dedicated_infrastructure),
    slaSupport: Boolean(plan.sla_support),
    supportLevel: plan.support_level,
    allowObjectCapture: plan.allow_object_capture == null ? true : Boolean(plan.allow_object_capture),
    ocCapturesPerMonth: plan.oc_captures_per_month == null ? null : Number(plan.oc_captures_per_month),
    ocComputeSecondsPerMonth:
      plan.oc_compute_seconds_per_month == null ? null : Number(plan.oc_compute_seconds_per_month),
    ocConcurrentJobs: plan.oc_concurrent_jobs == null ? null : Number(plan.oc_concurrent_jobs),
    ocMaxRetries: plan.oc_max_retries == null ? null : Number(plan.oc_max_retries),
    allowCustomDomain: Boolean(plan.allow_custom_domain),
  };
}

/** Canonical plan limits — DB-backed with static fallback. */
export async function resolvePlanLimits(planId: string): Promise<PlanLimits> {
  const exactPlanId = String(planId || "trial").trim();
  const mappedId = mapLegacyPlanId(exactPlanId);
  const billingPlans = await getBillingPlans({ activeOnly: false }).catch(() => []);
  const adminPlan = billingPlans.find((plan) => plan.id === mappedId);
  if (adminPlan) return adminPlanToLimits(adminPlan);
  if (DEFAULT_PLAN_LIMITS[mappedId]) return DEFAULT_PLAN_LIMITS[mappedId];

  await ensureEnterpriseCustomPlanFeatureGates().catch(() => {});

  const customPlans = await query<EnterpriseCustomPlanRow>(
    `SELECT custom_plan_uid, name, storage_limit_bytes, bandwidth_limit_bytes, product_limit,
            model_limit, ar_experience_limit, team_member_limit, custom_branding,
            allow_viewer, allow_upload, allow_ar, allow_qr, allow_share, allow_embed,
            allow_object_capture, allow_custom_domain, advanced_analytics, qr_limit, share_link_limit,
            oc_captures_per_month, oc_compute_seconds_per_month, oc_concurrent_jobs, oc_max_retries,
            priority_support, dedicated_infrastructure, sla_support, support_level
       FROM enterprise_custom_plans
      WHERE BINARY custom_plan_uid = BINARY ? AND is_active = 1
      LIMIT 1`,
    [exactPlanId],
  ).catch(() => []);
  if (customPlans[0]) return enterprisePlanToLimits(customPlans[0]);

  return DEFAULT_PLAN_LIMITS.trial;
}

/** Resolves the subscription's raw plan UID so Enterprise IDs are never collapsed to Trial. */
export async function resolveCustomerPlanLimits(customerUid: string): Promise<PlanLimits> {
  const rows = await query<{ plan_id: string | null }>(
    "SELECT plan_id FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  ).catch(() => []);
  return resolvePlanLimits(rows[0]?.plan_id || "trial");
}
