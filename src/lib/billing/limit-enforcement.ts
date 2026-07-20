import { BillingErrorCode } from "@/lib/billing/billing-errors";
import { getCustomerUsage } from "@/lib/billing/customer-usage";
import {
  resolveCustomerPlanLimits,
  resolvePlanLimits,
} from "@/lib/billing/resolve-plan-limits";
import {
  checkEnterpriseArExperienceEntitlement,
  checkEnterpriseModelEntitlement,
  type PlanLimits,
} from "@/lib/billing/plan-enforcement";
import { query } from "@/lib/db";
import {
  PRODUCT_USAGE_COUNT_SQL,
  PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS,
  QR_USAGE_COUNT_SQL,
  SHARE_LINK_USAGE_COUNT_SQL,
  STORAGE_USAGE_SUM_SQL,
  STORAGE_USAGE_SUM_SQL_LEGACY,
} from "@/lib/billing/product-usage";
import { normalizePlanLimit } from "@/lib/billing/limit-normalization";

export type LimitCheckResult =
  | { ok: true }
  | { ok: false; code: BillingErrorCode; message: string };

async function countProducts(customerUid: string) {
  try {
    const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    const rows = await query<{ total: number }>(PRODUCT_USAGE_COUNT_SQL_NO_ASSET_STATUS, [customerUid]);
    return Number(rows[0]?.total || 0);
  }
}

async function sumStorage(customerUid: string) {
  try {
    const rows = await query<{ total: string | number }>(STORAGE_USAGE_SUM_SQL, [customerUid]);
    return Number(rows[0]?.total || 0);
  } catch {
    const rows = await query<{ total: string | number }>(STORAGE_USAGE_SUM_SQL_LEGACY, [customerUid]);
    return Number(rows[0]?.total || 0);
  }
}

async function countModels(customerUid: string) {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM products
      WHERE customer_uid = ? AND deleted_at IS NULL
        AND (COALESCE(model_url, '') <> '' OR LOWER(COALESCE(file_name, '')) LIKE '%.glb')`,
    [customerUid],
  ).catch(() => [{ total: 0 }]);
  return Number(rows[0]?.total || 0);
}

async function countArExperiences(customerUid: string) {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM products
      WHERE customer_uid = ? AND deleted_at IS NULL
        AND LOWER(COALESCE(status, '')) IN ('published', 'active')`,
    [customerUid],
  ).catch(() => [{ total: 0 }]);
  return Number(rows[0]?.total || 0);
}

export async function checkProductLimit(customerUid: string, planId?: string): Promise<LimitCheckResult> {
  const slug = planId || "trial";
  const limits = await resolvePlanLimits(slug);
  const limit = normalizePlanLimit(limits.products);
  if (limit == null) return { ok: true };

  const used = await countProducts(customerUid);
  if (used >= limit) {
    return {
      ok: false,
      code: BillingErrorCode.PRODUCT_LIMIT_REACHED,
      message: `You have reached your ${limit}-product limit. Upgrade your plan to create more products.`,
    };
  }
  return { ok: true };
}

export async function checkStorageLimit(
  customerUid: string,
  incomingBytes: number,
  replaceBytes = 0,
  planId?: string,
): Promise<LimitCheckResult> {
  const slug = planId || "trial";
  const limits = await resolvePlanLimits(slug);
  if (limits.unlimitedStorage || limits.storageMb == null) return { ok: true };

  const limitBytes = Math.round(Number(limits.storageMb) * 1024 * 1024);
  const current = await sumStorage(customerUid);
  const projected = current - Math.max(0, replaceBytes) + Math.max(0, incomingBytes);

  if (projected > limitBytes) {
    return {
      ok: false,
      code: BillingErrorCode.STORAGE_LIMIT_REACHED,
      message:
        "You do not have enough storage remaining for this file. Delete unused assets or upgrade your plan.",
    };
  }
  return { ok: true };
}

/** Enterprise custom-plan model quota. Standard plans always pass this helper. */
export async function checkEnterpriseModelLimit(
  customerUid: string,
  plan?: PlanLimits,
): Promise<LimitCheckResult> {
  const limits = plan || await resolveCustomerPlanLimits(customerUid);
  const result = checkEnterpriseModelEntitlement(limits, await countModels(customerUid));
  if (result.allowed) return { ok: true };
  return {
    ok: false,
    code: BillingErrorCode.MODEL_LIMIT_REACHED,
    message: result.reason || "You have reached your 3D model limit.",
  };
}

/**
 * Enterprise custom-plan AR quota. Existing published products may be republished
 * without consuming another experience.
 */
export async function checkEnterpriseArExperienceLimit(
  customerUid: string,
  productUid: string,
  plan?: PlanLimits,
): Promise<LimitCheckResult> {
  const limits = plan || await resolveCustomerPlanLimits(customerUid);
  if (!limits.isEnterpriseCustom || limits.arExperienceLimit == null) return { ok: true };

  const current = await query<{ status: string | null }>(
    "SELECT status FROM products WHERE id = ? AND customer_uid = ? AND deleted_at IS NULL LIMIT 1",
    [productUid, customerUid],
  ).catch(() => []);
  if (["published", "active"].includes(String(current[0]?.status || "").toLowerCase())) {
    return { ok: true };
  }

  const result = checkEnterpriseArExperienceEntitlement(
    limits,
    await countArExperiences(customerUid),
  );
  if (result.allowed) return { ok: true };
  return {
    ok: false,
    code: BillingErrorCode.AR_EXPERIENCE_LIMIT_REACHED,
    message: result.reason || "You have reached your AR experience limit.",
  };
}

export async function checkQrLimit(customerUid: string, planId?: string): Promise<LimitCheckResult> {
  const slug = planId || "trial";
  const limits = await resolvePlanLimits(slug);
  const limit = normalizePlanLimit(limits.qrCodes ?? null);
  if (limit == null) return { ok: true };

  const rows = await query<{ total: number }>(QR_USAGE_COUNT_SQL, [customerUid]).catch(() => [{ total: 0 }]);
  const used = Number(rows[0]?.total || 0);
  if (used >= limit) {
    return {
      ok: false,
      code: BillingErrorCode.QR_LIMIT_REACHED,
      message: `You have reached your ${limit} QR code limit. Upgrade your plan to create more QR codes.`,
    };
  }
  return { ok: true };
}

export async function checkShareLinkLimit(customerUid: string, planId?: string): Promise<LimitCheckResult> {
  const slug = planId || "trial";
  const limits = await resolvePlanLimits(slug);
  const limit = normalizePlanLimit(limits.shareLinks ?? null);
  if (limit == null) return { ok: true };

  const rows = await query<{ total: number }>(SHARE_LINK_USAGE_COUNT_SQL, [customerUid]).catch(() => [{ total: 0 }]);
  const used = Number(rows[0]?.total || 0);
  if (used >= limit) {
    return {
      ok: false,
      code: BillingErrorCode.SHARE_LINK_LIMIT_REACHED,
      message: `You have reached your ${limit} share link limit. Upgrade your plan to create more links.`,
    };
  }
  return { ok: true };
}

/** Full usage snapshot for APIs — wraps canonical service. */
export async function getUsageForApi(customerUid: string) {
  return getCustomerUsage(customerUid);
}
