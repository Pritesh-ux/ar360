import crypto from "crypto";
import { query } from "@/lib/db";
import { getBillingPlans } from "@/lib/billing/admin-plans";
import { mapLegacyPlanId, DEFAULT_PLAN_LIMITS } from "@/lib/billing/plan-enforcement";
import { insertEnterpriseCustomPlan } from "@/lib/enterprise-sales/repository";

function publicUid(prefix: string) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function gbToBytes(gb: number | null | undefined): number | null {
  if (gb == null || !Number.isFinite(Number(gb))) return null;
  return Math.round(Number(gb) * 1024 * 1024 * 1024);
}

/**
 * Master Admin billing override used to set plan_id = "enterprise" (catalog)
 * without creating enterprise_contracts — customers saw ENTERPRISE badge but no
 * Enterprise menu. Converting catalog Enterprise into a real custom plan +
 * active contract keeps nav / Manage plan / limits consistent.
 */
export async function convertCatalogEnterpriseToContract(input: {
  customerUid: string;
  adminId?: number | null;
  billingCycle?: "monthly" | "yearly";
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  status?: string;
}): Promise<{ customPlanUid: string; contractUid: string; alreadyHadContract: boolean }> {
  const customerUid = String(input.customerUid || "").trim();
  if (!customerUid) throw new Error("customerUid is required");

  // IMPORTANT: check a real contract row — not hasActiveEnterpriseContract(),
  // which also returns true for legacy catalog plan_id=enterprise orphans.
  const existingRows = await query<{ custom_plan_uid: string; contract_uid: string }>(
    `SELECT cp.custom_plan_uid, ec.contract_uid
       FROM customers c
       JOIN enterprise_contracts ec ON ec.customer_id = c.id AND ec.status = 'active'
       JOIN enterprise_custom_plans cp ON cp.id = ec.custom_plan_id AND cp.is_active = 1
      WHERE c.customer_uid = ?
        AND ec.starts_on <= CURDATE() AND ec.expires_on >= CURDATE()
      ORDER BY ec.expires_on DESC, ec.id DESC
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);

  if (existingRows[0]?.custom_plan_uid) {
    await applyEnterpriseSubscription({
      customerUid,
      customPlanUid: existingRows[0].custom_plan_uid,
      billingCycle: input.billingCycle || "monthly",
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      status: input.status,
    });
    return {
      customPlanUid: existingRows[0].custom_plan_uid,
      contractUid: existingRows[0].contract_uid,
      alreadyHadContract: true,
    };
  }

  const customers = await query<{
    id: number;
    customer_uid: string;
    user_id: number | null;
  }>("SELECT id, customer_uid, user_id FROM customers WHERE customer_uid = ? LIMIT 1", [customerUid]);
  const customer = customers[0];
  if (!customer) throw new Error("Customer not found.");

  const users = customer.user_id
    ? await query<{ name: string; email: string }>(
        "SELECT name, email FROM users WHERE id = ? LIMIT 1",
        [customer.user_id],
      )
    : [];
  const contactName = users[0]?.name?.trim() || "Enterprise customer";
  const businessEmail = users[0]?.email?.trim() || `${customerUid}@enterprise.local`;

  const catalog =
    (await getBillingPlans({ activeOnly: false }).catch(() => [])).find(
      (plan) => mapLegacyPlanId(plan.id) === "enterprise",
    ) || null;
  const defaults = DEFAULT_PLAN_LIMITS.enterprise;
  const billingCycle = input.billingCycle || "monthly";
  const priceInr =
    billingCycle === "yearly"
      ? catalog?.priceYearlyInr
      : catalog?.priceMonthlyInr;
  const pricePaise = Math.max(0, Math.round(Number(priceInr ?? 0) * 100));

  const storageGb = catalog?.unlimitedStorage
    ? null
    : catalog?.storageGb ?? (defaults.storageMb != null ? defaults.storageMb / 1024 : 25);
  const bandwidthGb = catalog?.unlimitedBandwidth
    ? null
    : catalog?.bandwidthGb ?? defaults.bandwidthGb ?? 250;

  const requestUid = publicUid("ER");
  await query(
    `INSERT INTO enterprise_requests (
       request_uid, company_name, contact_name, business_email, phone, country, industry,
       status, customer_id, source, assigned_admin_id
     ) VALUES (?, ?, ?, ?, '', 'India', 'Admin assigned', 'active', ?, 'master_admin_plan_assign', ?)`,
    [
      requestUid,
      contactName,
      contactName,
      businessEmail,
      customer.id,
      input.adminId ?? null,
    ],
  );
  const requestRows = await query<{ id: number }>(
    "SELECT id FROM enterprise_requests WHERE request_uid = ? LIMIT 1",
    [requestUid],
  );
  const requestId = Number(requestRows[0]?.id);
  if (!requestId) throw new Error("Failed to create Enterprise request for admin assign.");

  const customPlanUid = await insertEnterpriseCustomPlan({
    name: "Enterprise",
    billingCycle,
    pricePaise,
    storageLimitBytes: gbToBytes(storageGb),
    bandwidthLimitBytes: gbToBytes(bandwidthGb),
    productLimit: catalog?.products ?? defaults.products,
    modelLimit: null,
    arExperienceLimit: null,
    teamMemberLimit: null,
    customBranding: Boolean(catalog?.limits?.customBranding ?? defaults.allowCustomBranding),
    allowViewer: catalog?.limits?.allowViewer !== false,
    allowUpload: catalog?.limits?.allowUpload !== false,
    allowAr: catalog?.limits?.allowAr !== false,
    allowQr: catalog?.limits?.allowQr !== false,
    allowShare: catalog?.limits?.allowShare !== false,
    allowEmbed: Boolean(catalog?.limits?.embedViewer ?? defaults.allowEmbed),
    allowObjectCapture: catalog?.limits?.allowObjectCapture !== false,
    allowCustomDomain: Boolean(catalog?.limits?.allowCustomDomain ?? defaults.allowCustomDomain),
    advancedAnalytics: Boolean(catalog?.limits?.advancedAnalytics ?? defaults.advancedAnalytics),
    qrLimit: catalog?.qrLimit ?? null,
    shareLinkLimit: catalog?.shareLinkLimit ?? null,
    ocCapturesPerMonth: catalog?.ocCapturesPerMonth ?? null,
    ocComputeSecondsPerMonth: catalog?.ocComputeSecondsPerMonth ?? null,
    ocConcurrentJobs: catalog?.ocConcurrentJobs ?? null,
    ocMaxRetries: catalog?.ocMaxRetries ?? null,
    prioritySupport: Boolean(catalog?.limits?.prioritySupport ?? defaults.prioritySupport),
    dedicatedInfrastructure: false,
    slaSupport: false,
    supportLevel: null,
    notes: "Auto-created from Master Admin catalog Enterprise assignment.",
    isActive: true,
    isReusable: false,
    createdByAdminId: input.adminId ?? null,
  });

  const planRows = await query<{ id: number }>(
    "SELECT id FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1",
    [customPlanUid],
  );
  const customPlanId = Number(planRows[0]?.id);
  if (!customPlanId) throw new Error("Failed to create Enterprise custom plan.");

  const startsOn = input.currentPeriodStart
    ? new Date(input.currentPeriodStart)
    : new Date();
  const expiresOn = input.currentPeriodEnd
    ? new Date(input.currentPeriodEnd)
    : new Date(
        startsOn.getTime() +
          (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
      );
  const toDate = (d: Date) => d.toISOString().slice(0, 10);

  const subscription = await applyEnterpriseSubscription({
    customerUid,
    customPlanUid,
    billingCycle,
    currentPeriodStart: startsOn,
    currentPeriodEnd: expiresOn,
    status: input.status || "active",
  });

  const contractUid = publicUid("ec");
  await query(
    `INSERT INTO enterprise_contracts (
       contract_uid, request_id, customer_id, custom_plan_id, subscription_id,
       starts_on, expires_on, status, created_by_admin_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      contractUid,
      requestId,
      customer.id,
      customPlanId,
      subscription?.id ?? null,
      toDate(startsOn),
      toDate(expiresOn),
      input.adminId ?? null,
    ],
  );

  await query(
    `INSERT INTO enterprise_notes (note_uid, request_id, admin_id, event_type, body)
     VALUES (?, ?, ?, 'status_change', ?)`,
    [
      publicUid("en"),
      requestId,
      input.adminId ?? null,
      "Catalog Enterprise assignment converted to custom plan + active contract.",
    ],
  ).catch(() => undefined);

  return { customPlanUid, contractUid, alreadyHadContract: false };
}

async function applyEnterpriseSubscription(input: {
  customerUid: string;
  customPlanUid: string;
  billingCycle: "monthly" | "yearly";
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  status?: string;
}) {
  const { setCustomerPlan } = await import("@/lib/billing/admin-plans");
  await setCustomerPlan({
    customerUid: input.customerUid,
    planId: input.customPlanUid,
    status: (input.status as any) || "active",
    currentPeriodStart: input.currentPeriodStart ?? undefined,
    currentPeriodEnd: input.currentPeriodEnd ?? undefined,
  });
  // Ensure provider fingerprint matches Enterprise contracts (not razorpay/legacy).
  await query(
    `UPDATE customer_subscriptions
        SET provider = 'manual_enterprise', billing_period = ?, sales_channel = 'manual'
      WHERE customer_uid = ?`,
    [input.billingCycle, input.customerUid],
  ).catch(async () => {
    await query(
      `UPDATE customer_subscriptions
          SET provider = 'manual_enterprise', billing_period = ?
        WHERE customer_uid = ?`,
      [input.billingCycle, input.customerUid],
    ).catch(() => undefined);
  });
  await query("UPDATE customers SET plan_id = ? WHERE customer_uid = ?", [
    input.customPlanUid,
    input.customerUid,
  ]).catch(() => undefined);

  const rows = await query<{ id: number }>(
    "SELECT id FROM customer_subscriptions WHERE customer_uid = ? LIMIT 1",
    [input.customerUid],
  );
  return rows[0] || null;
}

/** True when catalog "enterprise" should be converted on admin assign. */
export function isCatalogEnterprisePlanId(planId: string | null | undefined) {
  const mapped = mapLegacyPlanId(String(planId || "").trim());
  return mapped === "enterprise" && !String(planId || "").toLowerCase().startsWith("ecp_");
}
