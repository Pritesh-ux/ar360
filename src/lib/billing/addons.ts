import { query } from "@/lib/db";

export type AddonModule = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  one_time_price: number | null;
  trial_days: number;
  enabled: boolean;
  business_available: boolean;
  enterprise_available: boolean;
  custom_available: boolean;
  sort_order: number;
  currency: string;
  discount_percent: number;
  status: string;
  visibility: string;
  created_at?: string;
  updated_at?: string;
};

export type UserAddon = {
  id: number;
  user_id: number;
  addon_slug: string;
  status: string;
  billing_type: string;
  activated_at: string;
  expires_at: string | null;
  created_at?: string;
};

function isAddonIncludedByPlan(planId: string, slug: string) {
  const key = String(planId || "").trim().toLowerCase();
  if ((key === "business" || key === "enterprise") && slug === "client-management") {
    return true;
  }
  return false;
}

/** Get the primary owner user_id for a given customer_uid */
export async function getCustomerOwnerUserId(customerUid: string): Promise<number | null> {
  const rows = await query<{ user_id: number | null }>(
    "SELECT user_id FROM customers WHERE customer_uid = ? LIMIT 1",
    [customerUid]
  );
  return rows[0]?.user_id || null;
}

/** Add-on modules ride on the base subscription — a lapsed plan disables them too. */
async function hasActiveSubscription(customerUid: string): Promise<boolean> {
  const { checkSubscription } = await import("@/lib/subscription/check-subscription");
  const subscription = await checkSubscription(customerUid).catch(() => null);
  return Boolean(subscription?.active);
}

async function hasActiveAddon(customerUid: string, slug: string): Promise<boolean> {
  if (!(await hasActiveSubscription(customerUid))) return false;

  const ownerUserId = await getCustomerOwnerUserId(customerUid);
  if (!ownerUserId) return false;

  const rows = await query<{ id: number }>(
    `SELECT id FROM user_addons
      WHERE user_id = ?
        AND addon_slug = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [ownerUserId, slug],
  );
  return rows.length > 0;
}

/** Check if a customer has an active client-management addon */
export async function hasClientAddon(customerUid: string): Promise<boolean> {
  return hasActiveAddon(customerUid, "client-management");
}

/**
 * Client Management access: Business/Organisation plan, active enterprise contract,
 * or purchased client-management addon (for lower tiers).
 */
export async function hasClientManagementAccess(customerUid: string): Promise<boolean> {
  if (!(await hasActiveSubscription(customerUid))) return false;

  if (await hasClientAddon(customerUid)) return true;

  try {
    const { mapLegacyPlanId } = await import("@/lib/billing/plan-enforcement");
    const { resolveCustomerPlanLimits } = await import("@/lib/billing/resolve-plan-limits");
    const limits = await resolveCustomerPlanLimits(customerUid);
    const planId = mapLegacyPlanId(String(limits.planId || ""));
    if (planId === "business" || planId === "enterprise") return true;
    if (String(limits.planId || "").toLowerCase().startsWith("ecp_")) return true;
    if (limits.isEnterpriseCustom) return true;
  } catch {
    // fall through
  }

  try {
    const { hasActiveEnterpriseContract } = await import(
      "@/lib/enterprise-sales/customer-dashboard.service"
    );
    if (await hasActiveEnterpriseContract(customerUid)) return true;
  } catch {
    // fall through
  }

  return false;
}

/** Check if a customer has an active team-management addon */
export async function hasTeamAddon(customerUid: string): Promise<boolean> {
  return hasActiveAddon(customerUid, "team-management");
}

/**
 * Team Management access: active team-management addon, or Business/Organisation plan /
 * active enterprise custom contract (same gates as Client Management).
 */
export async function hasTeamManagementAccess(customerUid: string): Promise<boolean> {
  if (!(await hasActiveSubscription(customerUid))) return false;

  if (await hasTeamAddon(customerUid)) return true;

  try {
    const { mapLegacyPlanId } = await import("@/lib/billing/plan-enforcement");
    const { resolveCustomerPlanLimits } = await import("@/lib/billing/resolve-plan-limits");
    const limits = await resolveCustomerPlanLimits(customerUid);
    const planId = mapLegacyPlanId(String(limits.planId || ""));
    if (planId === "business" || planId === "enterprise") return true;
    // Custom enterprise plan UIDs (ecp_…) are not collapsed by mapLegacyPlanId.
    if (String(limits.planId || "").toLowerCase().startsWith("ecp_")) return true;
    if (limits.isEnterpriseCustom) return true;
  } catch {
    // fall through
  }

  try {
    const { hasActiveEnterpriseContract } = await import(
      "@/lib/enterprise-sales/customer-dashboard.service"
    );
    if (await hasActiveEnterpriseContract(customerUid)) return true;
  } catch {
    // fall through
  }

  return false;
}

/** Enforce plan gating eligibility */
export function isPlanEligibleForAddon(
  planId: string,
  addon: {
    business_available: boolean | number;
    enterprise_available: boolean | number;
    custom_available: boolean | number;
  },
) {
  const key = String(planId || "").trim().toLowerCase();
  const biz = Boolean(addon.business_available);
  const ent = Boolean(addon.enterprise_available);
  const custom = Boolean(addon.custom_available);
  if (key === "business") return biz;
  if (key === "enterprise" || key === "agency") return ent;
  if (key.startsWith("ecp_")) return custom;
  return false;
}

/** Get catalog add-ons visible for a customer (Starter/Trial see none). */
export async function getAddonsForCustomer(customerUid: string, planId?: string | null) {
  const ownerUserId = await getCustomerOwnerUserId(customerUid);

  const [addons, userAddons] = await Promise.all([
    query<AddonModule>(
      "SELECT * FROM addon_modules WHERE enabled = TRUE AND status = 'active' ORDER BY sort_order ASC",
    ),
    ownerUserId
      ? query<UserAddon>(
          `SELECT * FROM user_addons
            WHERE user_id = ?
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > NOW())`,
          [ownerUserId],
        )
      : Promise.resolve([] as UserAddon[]),
  ]);

  const activeSlugs = new Set(userAddons.map((ua) => ua.addon_slug));
  const planKey = String(planId || "").trim().toLowerCase();

  return addons
    .filter((addon) => {
      if (isAddonIncludedByPlan(planKey, addon.slug)) return true;
      if (!planKey || planKey === "starter" || planKey === "trial" || planKey === "free" || planKey === "pro") {
        // Already purchased still surfaces so Manage works after upgrade/downgrade edge cases
        return activeSlugs.has(addon.slug);
      }
      return isPlanEligibleForAddon(planKey, addon) || activeSlugs.has(addon.slug);
    })
    .map((addon) => ({
      ...addon,
      purchased: activeSlugs.has(addon.slug),
      includedByPlan: isAddonIncludedByPlan(planKey, addon.slug),
      activeAddonDetails: userAddons.find((ua) => ua.addon_slug === addon.slug) || null,
    }));
}

export async function listAllAddonModules() {
  return query<AddonModule>("SELECT * FROM addon_modules ORDER BY sort_order ASC, id ASC");
}

export async function updateAddonModule(
  slug: string,
  patch: Partial<{
    name: string;
    description: string | null;
    monthly_price: number;
    yearly_price: number;
    one_time_price: number | null;
    trial_days: number;
    enabled: boolean;
    business_available: boolean;
    enterprise_available: boolean;
    custom_available: boolean;
    sort_order: number;
    currency: string;
    discount_percent: number;
    status: string;
    visibility: string;
  }>,
) {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  const map: Record<string, string | number | null | boolean | undefined> = patch;
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    if (typeof value === "boolean") values.push(value ? 1 : 0);
    else values.push(value);
  }
  if (!fields.length) return;
  values.push(slug);
  await query(`UPDATE addon_modules SET ${fields.join(", ")}, updated_at = NOW() WHERE slug = ?`, values);
}

export async function listAddonLicenses(limit = 100) {
  return query<{
    id: number;
    user_id: number;
    addon_slug: string;
    status: string;
    billing_type: string;
    activated_at: string;
    expires_at: string | null;
    customer_uid: string | null;
    customer_name: string | null;
    email: string | null;
  }>(
    `SELECT ua.id, ua.user_id, ua.addon_slug, ua.status, ua.billing_type, ua.activated_at, ua.expires_at,
            c.customer_uid,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.contact_name) AS customer_name,
            c.email
       FROM user_addons ua
       LEFT JOIN customers c ON c.user_id = ua.user_id
      ORDER BY ua.activated_at DESC
      LIMIT ?`,
    [limit],
  );
}

export const KNOWN_ADDON_SLUGS = ["client-management", "team-management"] as const;
export type KnownAddonSlug = (typeof KNOWN_ADDON_SLUGS)[number];

export function isKnownAddonSlug(slug: string): slug is KnownAddonSlug {
  return (KNOWN_ADDON_SLUGS as readonly string[]).includes(slug);
}

function isLicenseActive(license: UserAddon | null | undefined) {
  if (!license || license.status !== "active") return false;
  if (!license.expires_at) return true;
  return new Date(license.expires_at).getTime() > Date.now();
}

export type CustomerAddonStatus = {
  slug: string;
  name: string;
  description: string | null;
  monthly_price: number;
  yearly_price: number;
  active: boolean;
  license: UserAddon | null;
};

/** Catalog + this customer's license rows (for Master Admin detail). */
export async function getCustomerAddonLicenses(customerUid: string): Promise<CustomerAddonStatus[]> {
  const ownerUserId = await getCustomerOwnerUserId(customerUid);
  const [modules, userAddons] = await Promise.all([
    listAllAddonModules(),
    ownerUserId
      ? query<UserAddon>("SELECT * FROM user_addons WHERE user_id = ? ORDER BY activated_at DESC", [
          ownerUserId,
        ])
      : Promise.resolve([] as UserAddon[]),
  ]);

  return modules.map((module) => {
    const license = userAddons.find((row) => row.addon_slug === module.slug) || null;
    return {
      slug: module.slug,
      name: module.name,
      description: module.description,
      monthly_price: module.monthly_price,
      yearly_price: module.yearly_price,
      active: isLicenseActive(license),
      license,
    };
  });
}

function toMysqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Admin grant / re-activate. `expiresAt: null` = never expires. */
export async function grantUserAddon(opts: {
  customerUid: string;
  slug: string;
  billingType?: string;
  expiresAt?: Date | string | null;
}) {
  const slug = String(opts.slug || "").trim();
  if (!isKnownAddonSlug(slug)) {
    throw new Error("Unknown add-on slug.");
  }

  const ownerUserId = await getCustomerOwnerUserId(opts.customerUid);
  if (!ownerUserId) {
    throw new Error("Customer owner account not found.");
  }

  const billingType = String(opts.billingType || "manual").trim() || "manual";
  let expiresAtStr: string | null = null;

  if (opts.expiresAt === null) {
    expiresAtStr = null;
  } else if (opts.expiresAt instanceof Date) {
    expiresAtStr = toMysqlDatetime(opts.expiresAt);
  } else if (typeof opts.expiresAt === "string" && opts.expiresAt.trim()) {
    const parsed = new Date(opts.expiresAt);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid expiresAt.");
    expiresAtStr = toMysqlDatetime(parsed);
  } else if (billingType === "yearly") {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiresAtStr = toMysqlDatetime(d);
  } else if (billingType === "monthly") {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    expiresAtStr = toMysqlDatetime(d);
  } else {
    expiresAtStr = null;
  }

  await query(
    `INSERT INTO user_addons (user_id, addon_slug, status, billing_type, activated_at, expires_at)
     VALUES (?, ?, 'active', ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       status = 'active',
       billing_type = VALUES(billing_type),
       activated_at = NOW(),
       expires_at = VALUES(expires_at)`,
    [ownerUserId, slug, billingType, expiresAtStr],
  );

  return getCustomerAddonLicenses(opts.customerUid);
}

export async function revokeUserAddon(opts: { customerUid: string; slug: string }) {
  const slug = String(opts.slug || "").trim();
  if (!isKnownAddonSlug(slug)) {
    throw new Error("Unknown add-on slug.");
  }

  const ownerUserId = await getCustomerOwnerUserId(opts.customerUid);
  if (!ownerUserId) {
    throw new Error("Customer owner account not found.");
  }

  await query(
    `UPDATE user_addons
        SET status = 'revoked', updated_at = NOW()
      WHERE user_id = ? AND addon_slug = ?`,
    [ownerUserId, slug],
  );

  return getCustomerAddonLicenses(opts.customerUid);
}
