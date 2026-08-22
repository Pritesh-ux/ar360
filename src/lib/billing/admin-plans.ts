import { query } from "@/lib/db";
import {
  BILLING_PLANS,
  computeYearlyFromPercent,
  type BillingPlan,
  type YearlyPricingMode,
} from "@/lib/billing/plans";
import { mapLegacyPlanId } from "@/lib/billing/plan-enforcement";
import { sendPlanChangedEmail } from "@/lib/email/customer-lifecycle.service";

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

let ensureBillingPlanSchemaPromise: Promise<void> | null = null;

export type AdminBillingPlan = Omit<BillingPlan, "id"> & {
  /** Actual `billing_plans.id` row key — do not rewrite legacy aliases on save. */
  id: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

type BillingPlanRow = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  storage_gb: string | number;
  bandwidth_gb: string | number;
  products: number;
  price_monthly_inr: number | null;
  price_yearly_inr: number | null;
  yearly_pricing_mode?: "manual" | "percent_off" | null;
  yearly_discount_percent?: string | number | null;
  trial_hours: number | null;
  popular: 0 | 1 | boolean;
  badge: string | null;
  icon: BillingPlan["icon"];
  features_json: string | null;
  custom_branding: 0 | 1 | boolean;
  advanced_analytics: 0 | 1 | boolean;
  embed_viewer: 0 | 1 | boolean;
  priority_processing: 0 | 1 | boolean;
  priority_support: 0 | 1 | boolean;
  allow_ar: 0 | 1 | boolean;
  allow_qr: 0 | 1 | boolean;
  allow_share: 0 | 1 | boolean;
  allow_viewer: 0 | 1 | boolean;
  allow_upload: 0 | 1 | boolean;
  allow_object_capture?: 0 | 1 | boolean | null;
  allow_custom_domain?: 0 | 1 | boolean | null;
  oc_captures_per_month?: number | null;
  oc_compute_seconds_per_month?: number | null;
  oc_concurrent_jobs?: number | null;
  oc_max_retries?: number | null;
  is_active: 0 | 1 | boolean;
  sort_order: number;
  unlimited_storage: 0 | 1 | boolean;
  unlimited_bandwidth: 0 | 1 | boolean;
  bandwidth_resets_monthly?: 0 | 1 | boolean;
  qr_limit: number | null;
  share_link_limit: number | null;
  sales_channel: "self_service" | "manual";
  created_at?: Date | string;
  updated_at?: Date | string;
};

export type CustomerPlanStatus = {
  customerUid: string;
  planId: string;
  planName: string;
  status: "trialing" | "active" | "paused" | "past_due" | "cancelled" | "expired";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function safeFeatures(value: string | null | unknown, fallback: string[]) {
  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value) : Array.isArray(value) ? value : fallback;
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object" && "label" in item) {
          const row = item as { label?: unknown; highlighted?: unknown };
          const label = String(row.label || "").trim();
          if (!label) return "";
          return row.highlighted ? `* ${label}` : label;
        }
        return String(item).trim();
      })
      .filter(Boolean);
  } catch {
    return fallback;
  }
}

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicPlanDefaults(planId: string) {
  const mappedId = mapLegacyPlanId(planId);
  return BILLING_PLANS.find((plan) => plan.id === mappedId) || BILLING_PLANS[0];
}

function rowToPlan(row: BillingPlanRow): AdminBillingPlan {
  // Keep the real DB id so Master Admin activate/edit updates the same row.
  // Legacy aliases (basic→starter) are only for customer entitlement resolution.
  const id = String(row.id || "").trim();
  const fallback = publicPlanDefaults(id);
  const priceMonthlyInr = row.price_monthly_inr === null ? null : Number(row.price_monthly_inr);
  const yearlyPricingMode = (row.yearly_pricing_mode === "percent_off" ? "percent_off" : "manual") as YearlyPricingMode;
  const yearlyDiscountPercent =
    row.yearly_discount_percent == null || row.yearly_discount_percent === ""
      ? null
      : Number(row.yearly_discount_percent);
  let priceYearlyInr = row.price_yearly_inr === null ? null : Number(row.price_yearly_inr);
  if (priceMonthlyInr != null && yearlyPricingMode === "percent_off") {
    priceYearlyInr = computeYearlyFromPercent(priceMonthlyInr, yearlyDiscountPercent ?? 0);
  }
  return {
    id,
    name: row.name,
    tagline: row.tagline || fallback.tagline,
    description: row.description || fallback.description,
    storageGb: Number(row.storage_gb || 0),
    bandwidthGb: Number(row.bandwidth_gb || 0),
    products: Number(row.products || 0),
    priceMonthlyInr,
    priceYearlyInr,
    yearlyPricingMode,
    yearlyDiscountPercent: yearlyPricingMode === "percent_off" ? yearlyDiscountPercent : null,
    trialHours: row.trial_hours === null ? undefined : Number(row.trial_hours),
    popular: Boolean(row.popular),
    badge: row.badge || undefined,
    icon: row.icon || fallback.icon,
    features: safeFeatures(row.features_json, fallback.features),
    limits: {
      customBranding: Boolean(row.custom_branding),
      advancedAnalytics: Boolean(row.advanced_analytics),
      embedViewer: Boolean(row.embed_viewer),
      priorityProcessing: Boolean(row.priority_processing),
      prioritySupport: Boolean(row.priority_support),
      allowAr: row.allow_ar == null ? true : Boolean(row.allow_ar),
      allowQr: row.allow_qr == null ? true : Boolean(row.allow_qr),
      allowShare: row.allow_share == null ? true : Boolean(row.allow_share),
      allowViewer: row.allow_viewer == null ? true : Boolean(row.allow_viewer),
      allowUpload: row.allow_upload == null ? true : Boolean(row.allow_upload),
      allowObjectCapture: row.allow_object_capture == null ? true : Boolean(row.allow_object_capture),
      allowCustomDomain: Boolean(row.allow_custom_domain),
    },
    unlimitedStorage: Boolean(row.unlimited_storage),
    unlimitedBandwidth: Boolean(row.unlimited_bandwidth),
    bandwidthResetsMonthly: Boolean(row.bandwidth_resets_monthly),
    qrLimit: row.qr_limit == null ? null : Number(row.qr_limit),
    shareLinkLimit: row.share_link_limit == null ? null : Number(row.share_link_limit),
    ocCapturesPerMonth: row.oc_captures_per_month == null ? null : Number(row.oc_captures_per_month),
    ocComputeSecondsPerMonth:
      row.oc_compute_seconds_per_month == null ? null : Number(row.oc_compute_seconds_per_month),
    ocConcurrentJobs: row.oc_concurrent_jobs == null ? null : Number(row.oc_concurrent_jobs),
    ocMaxRetries: row.oc_max_retries == null ? null : Number(row.oc_max_retries),
    salesChannel: row.sales_channel || (mapLegacyPlanId(id) === "enterprise" ? "manual" : "self_service"),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: dateToIso(row.created_at) || undefined,
    updatedAt: dateToIso(row.updated_at) || undefined,
  };
}

function cleanPlan(plan: Partial<AdminBillingPlan>, index: number): AdminBillingPlan {
  const fallback = publicPlanDefaults(String(plan.id || "free"));
  // Preserve the submitted plan id exactly (after sanitize). Do NOT remap basic→starter here —
  // that made activate/edit write a different row while the UI still showed the legacy row as inactive.
  const id = String(plan.id || fallback.id || `plan_${Date.now()}_${index}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");

  const priceMonthlyInr = plan.priceMonthlyInr === null ? null : Number(plan.priceMonthlyInr ?? fallback.priceMonthlyInr ?? 0);
  const yearlyPricingMode: YearlyPricingMode =
    plan.yearlyPricingMode === "percent_off" ? "percent_off" : "manual";
  let yearlyDiscountPercent =
    plan.yearlyDiscountPercent == null ? null : Number(plan.yearlyDiscountPercent);
  if (yearlyDiscountPercent != null && (!Number.isFinite(yearlyDiscountPercent) || yearlyDiscountPercent < 0)) {
    yearlyDiscountPercent = null;
  }
  if (yearlyDiscountPercent != null) {
    yearlyDiscountPercent = Math.min(100, yearlyDiscountPercent);
  }

  let priceYearlyInr: number | null =
    plan.priceYearlyInr === null ? null : Number(plan.priceYearlyInr ?? fallback.priceYearlyInr ?? 0);

  if (priceMonthlyInr === null) {
    priceYearlyInr = null;
  } else if (yearlyPricingMode === "percent_off") {
    const pct = yearlyDiscountPercent ?? 0;
    priceYearlyInr = computeYearlyFromPercent(priceMonthlyInr, pct);
  }

  return {
    id,
    name: String(plan.name || fallback.name || id).trim(),
    tagline: String(plan.tagline || fallback.tagline || "").trim(),
    description: String(plan.description || fallback.description || "").trim(),
    storageGb: Number(plan.storageGb ?? fallback.storageGb ?? 0),
    bandwidthGb: Number(plan.bandwidthGb ?? fallback.bandwidthGb ?? 0),
    products: Number(plan.products ?? fallback.products ?? 0),
    priceMonthlyInr,
    priceYearlyInr,
    yearlyPricingMode,
    yearlyDiscountPercent: yearlyPricingMode === "percent_off" ? yearlyDiscountPercent : null,
    trialHours: plan.trialHours === undefined || plan.trialHours === null ? undefined : Number(plan.trialHours),
    popular: Boolean(plan.popular),
    badge: plan.badge ? String(plan.badge).trim() : undefined,
    icon: plan.icon || fallback.icon || "paper",
    features: Array.isArray(plan.features)
      ? plan.features
          .map((item) => {
            if (item == null) return "";
            if (typeof item === "string") return item.trim();
            if (typeof item === "object" && "label" in item) {
              const row = item as { label?: unknown; highlighted?: unknown };
              const label = String(row.label || "").trim();
              return row.highlighted && label ? `* ${label}` : label;
            }
            return String(item).trim();
          })
          .filter(Boolean)
      : fallback.features,
    limits: {
      customBranding: Boolean(plan.limits?.customBranding),
      advancedAnalytics: Boolean(plan.limits?.advancedAnalytics),
      embedViewer: Boolean(plan.limits?.embedViewer),
      priorityProcessing: Boolean(plan.limits?.priorityProcessing),
      prioritySupport: Boolean(plan.limits?.prioritySupport),
      allowAr: plan.limits?.allowAr !== false,
      allowQr: plan.limits?.allowQr !== false,
      allowShare: plan.limits?.allowShare !== false,
      allowViewer: plan.limits?.allowViewer !== false,
      allowUpload: plan.limits?.allowUpload !== false,
      allowObjectCapture: plan.limits?.allowObjectCapture !== false,
      allowCustomDomain: Boolean(plan.limits?.allowCustomDomain),
    },
    unlimitedStorage: Boolean(plan.unlimitedStorage ?? fallback.unlimitedStorage),
    unlimitedBandwidth: Boolean(plan.unlimitedBandwidth ?? fallback.unlimitedBandwidth),
    bandwidthResetsMonthly: Boolean(plan.bandwidthResetsMonthly),
    qrLimit: plan.qrLimit ?? fallback.qrLimit ?? null,
    shareLinkLimit: plan.shareLinkLimit ?? fallback.shareLinkLimit ?? null,
    ocCapturesPerMonth: plan.ocCapturesPerMonth ?? fallback.ocCapturesPerMonth ?? null,
    ocComputeSecondsPerMonth: plan.ocComputeSecondsPerMonth ?? fallback.ocComputeSecondsPerMonth ?? null,
    ocConcurrentJobs: plan.ocConcurrentJobs ?? fallback.ocConcurrentJobs ?? null,
    ocMaxRetries: plan.ocMaxRetries ?? fallback.ocMaxRetries ?? null,
    salesChannel:
      mapLegacyPlanId(id) === "enterprise"
        ? "manual"
        : plan.salesChannel || fallback.salesChannel || "self_service",
    isActive: plan.isActive !== false,
    sortOrder: Number(plan.sortOrder ?? index),
  };
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  if (shouldSkipRuntimeDdl()) return;
  const [{ total = 0 } = { total: 0 }] = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  if (Number(total) === 0) await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

export async function ensureBillingPlanSchema() {
  if (ensureBillingPlanSchemaPromise) return ensureBillingPlanSchemaPromise;
  ensureBillingPlanSchemaPromise = ensureBillingPlanSchemaOnce().catch((error) => {
    ensureBillingPlanSchemaPromise = null;
    throw error;
  });
  return ensureBillingPlanSchemaPromise;
}

async function ensureBillingPlanSchemaOnce() {
  if (shouldSkipRuntimeDdl()) return;

  await query(`
    CREATE TABLE IF NOT EXISTS billing_plans (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      tagline VARCHAR(180) NULL,
      description TEXT NULL,
      storage_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
      bandwidth_gb DECIMAL(10,2) NOT NULL DEFAULT 0,
      products INT NOT NULL DEFAULT 0,
      price_monthly_inr INT NULL,
      price_yearly_inr INT NULL,
      trial_hours INT NULL,
      popular TINYINT(1) NOT NULL DEFAULT 0,
      badge VARCHAR(80) NULL,
      icon VARCHAR(40) NOT NULL DEFAULT 'paper',
      features_json JSON NULL,
      custom_branding TINYINT(1) NOT NULL DEFAULT 0,
      advanced_analytics TINYINT(1) NOT NULL DEFAULT 0,
      embed_viewer TINYINT(1) NOT NULL DEFAULT 0,
      priority_processing TINYINT(1) NOT NULL DEFAULT 0,
      priority_support TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS customer_subscriptions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(80) NOT NULL,
      plan_id VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'trialing',
      trial_started_at DATETIME NULL,
      trial_ends_at DATETIME NULL,
      current_period_start DATETIME NULL,
      current_period_end DATETIME NULL,
      cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_customer_subscription_customer (customer_uid),
      INDEX idx_customer_subscriptions_plan (plan_id),
      INDEX idx_customer_subscriptions_status (status)
    )
  `);

  await addColumnIfMissing("billing_plans", "unlimited_storage", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_plans", "unlimited_bandwidth", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_plans", "bandwidth_resets_monthly", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_plans", "plan_level", "INT NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_plans", "qr_limit", "INT NULL");
  await addColumnIfMissing("billing_plans", "share_link_limit", "INT NULL");
  await addColumnIfMissing("billing_plans", "sales_channel", "ENUM('self_service','manual') NOT NULL DEFAULT 'self_service'");
  await addColumnIfMissing("billing_plans", "allow_ar", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_qr", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_share", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_viewer", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_upload", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_object_capture", "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfMissing("billing_plans", "allow_custom_domain", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("billing_plans", "oc_captures_per_month", "INT NULL");
  await addColumnIfMissing("billing_plans", "oc_compute_seconds_per_month", "INT NULL");
  await addColumnIfMissing("billing_plans", "oc_concurrent_jobs", "INT NULL");
  await addColumnIfMissing("billing_plans", "oc_max_retries", "INT NULL");
  await addColumnIfMissing(
    "billing_plans",
    "yearly_pricing_mode",
    "ENUM('manual','percent_off') NOT NULL DEFAULT 'manual'",
  );
  await addColumnIfMissing("billing_plans", "yearly_discount_percent", "DECIMAL(5,2) NULL");

  try {
    await query("UPDATE billing_plans SET qr_limit = 3, share_link_limit = 5 WHERE id IN ('trial', 'free') AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET qr_limit = 10, share_link_limit = NULL WHERE id IN ('basic', 'starter') AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET qr_limit = 50, share_link_limit = NULL WHERE id = 'intermediate' AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET qr_limit = 100, share_link_limit = NULL WHERE id IN ('professional', 'pro') AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET qr_limit = 200, share_link_limit = NULL WHERE id = 'business' AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET qr_limit = NULL, share_link_limit = NULL WHERE id IN ('enterprise', 'agency') AND qr_limit IS NULL");
    await query("UPDATE billing_plans SET plan_level = 0 WHERE id IN ('trial', 'free')");
    await query("UPDATE billing_plans SET plan_level = 1 WHERE id IN ('basic', 'starter')");
    await query("UPDATE billing_plans SET plan_level = 2 WHERE id = 'intermediate'");
    await query("UPDATE billing_plans SET plan_level = 3 WHERE id IN ('professional', 'pro')");
    await query("UPDATE billing_plans SET plan_level = 4 WHERE id = 'business'");
    await query("UPDATE billing_plans SET plan_level = 5, sales_channel = 'manual' WHERE id IN ('enterprise', 'agency')");
  } catch {
    // optional backfill
  }

  await addColumnIfMissing("customer_subscriptions", "billing_period", "VARCHAR(30) NULL");
  await addColumnIfMissing("customer_subscriptions", "provider", "VARCHAR(40) NULL");
  await addColumnIfMissing("customer_subscriptions", "provider_subscription_id", "VARCHAR(191) NULL");
  await addColumnIfMissing("customer_subscriptions", "provider_customer_id", "VARCHAR(191) NULL");
  await addColumnIfMissing("customer_subscriptions", "grace_ends_at", "DATETIME NULL");
  await addColumnIfMissing("customer_subscriptions", "cancelled_at", "DATETIME NULL");
  await addColumnIfMissing("customer_subscriptions", "trial_used", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("customer_subscriptions", "product_limit", "INT NULL");
  await addColumnIfMissing("customer_subscriptions", "storage_limit_mb", "INT NULL");
  await addColumnIfMissing("customer_subscriptions", "bandwidth_limit_mb", "INT NULL");
  await addColumnIfMissing("customer_subscriptions", "unlimited_storage", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("customer_subscriptions", "unlimited_bandwidth", "TINYINT(1) NOT NULL DEFAULT 0");

  // Legacy IDs are read aliases. Runtime schema checks must never rewrite billing history.
}

async function seedDefaultBillingPlans() {
  for (const [index, plan] of BILLING_PLANS.entries()) {
    await upsertBillingPlan({ ...plan, isActive: true, sortOrder: index });
  }
}

/** Insert any missing standard catalog rows (e.g. new Intermediate). */
async function ensureMissingStandardBillingPlans() {
  const rows = await query<{ id: string }>("SELECT id FROM billing_plans").catch(() => [] as { id: string }[]);
  const existing = new Set(rows.map((row) => row.id));
  for (const [index, plan] of BILLING_PLANS.entries()) {
    if (existing.has(plan.id)) continue;
    await upsertBillingPlan({ ...plan, isActive: true, sortOrder: index });
  }
}

export async function getBillingPlans({ activeOnly = false }: { activeOnly?: boolean } = {}) {
  await ensureBillingPlanSchema();

  const rowsCount = await query<{ total: number }>("SELECT COUNT(*) AS total FROM billing_plans");
  if (Number(rowsCount[0]?.total || 0) === 0) {
    await seedDefaultBillingPlans();
  } else {
    await ensureMissingStandardBillingPlans();
  }

  const rows = await query<BillingPlanRow>(
    `SELECT id, name, tagline, description, storage_gb, bandwidth_gb, products,
      price_monthly_inr, price_yearly_inr, yearly_pricing_mode, yearly_discount_percent,
      trial_hours, popular, badge, icon,
      features_json, custom_branding, advanced_analytics, embed_viewer,
      priority_processing, priority_support, allow_ar, allow_qr, allow_share, allow_viewer, allow_upload,
      allow_object_capture, allow_custom_domain, oc_captures_per_month, oc_compute_seconds_per_month, oc_concurrent_jobs, oc_max_retries,
      is_active, sort_order, unlimited_storage, unlimited_bandwidth, bandwidth_resets_monthly,
      qr_limit, share_link_limit, sales_channel, created_at, updated_at
     FROM billing_plans
     ${activeOnly ? "WHERE is_active = 1" : ""}
     ORDER BY sort_order ASC, created_at ASC`,
  );

  const plans = rows.map(rowToPlan);
  // Exact-id dedupe only (admin must see legacy `basic` separately from `starter`).
  const unique = plans.filter(
    (plan, index) => plans.findIndex((candidate) => candidate.id === plan.id) === index,
  );

  if (!activeOnly) return unique;

  // Public catalog: collapse legacy aliases so both basic+starter do not appear twice.
  const byCanonical = new Map<string, AdminBillingPlan>();
  for (const plan of unique) {
    const key = mapLegacyPlanId(plan.id);
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, plan);
      continue;
    }
    const preferPlan =
      (plan.id === key && existing.id !== key) ||
      (plan.isActive && !existing.isActive) ||
      (plan.id === key && existing.id === key && plan.sortOrder < existing.sortOrder);
    if (preferPlan) byCanonical.set(key, plan);
  }
  return [...byCanonical.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function upsertBillingPlan(rawPlan: Partial<AdminBillingPlan>, index = 0) {
  await ensureBillingPlanSchema();
  const plan = cleanPlan(rawPlan, index);

  await query(
    `INSERT INTO billing_plans (
      id, name, tagline, description, storage_gb, bandwidth_gb, products,
      price_monthly_inr, price_yearly_inr, yearly_pricing_mode, yearly_discount_percent,
      trial_hours, popular, badge, icon,
      features_json, custom_branding, advanced_analytics, embed_viewer,
      priority_processing, priority_support, allow_ar, allow_qr, allow_share, allow_viewer, allow_upload,
      allow_object_capture, allow_custom_domain, oc_captures_per_month, oc_compute_seconds_per_month, oc_concurrent_jobs, oc_max_retries,
      is_active, sort_order, unlimited_storage, unlimited_bandwidth, bandwidth_resets_monthly,
      qr_limit, share_link_limit, sales_channel
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name), tagline = VALUES(tagline), description = VALUES(description),
      storage_gb = VALUES(storage_gb), bandwidth_gb = VALUES(bandwidth_gb), products = VALUES(products),
      price_monthly_inr = VALUES(price_monthly_inr), price_yearly_inr = VALUES(price_yearly_inr),
      yearly_pricing_mode = VALUES(yearly_pricing_mode), yearly_discount_percent = VALUES(yearly_discount_percent),
      trial_hours = VALUES(trial_hours), popular = VALUES(popular), badge = VALUES(badge), icon = VALUES(icon),
      features_json = VALUES(features_json), custom_branding = VALUES(custom_branding),
      advanced_analytics = VALUES(advanced_analytics), embed_viewer = VALUES(embed_viewer),
      priority_processing = VALUES(priority_processing), priority_support = VALUES(priority_support),
      allow_ar = VALUES(allow_ar), allow_qr = VALUES(allow_qr), allow_share = VALUES(allow_share),
      allow_viewer = VALUES(allow_viewer), allow_upload = VALUES(allow_upload),
      allow_object_capture = VALUES(allow_object_capture),
      allow_custom_domain = VALUES(allow_custom_domain),
      oc_captures_per_month = VALUES(oc_captures_per_month),
      oc_compute_seconds_per_month = VALUES(oc_compute_seconds_per_month),
      oc_concurrent_jobs = VALUES(oc_concurrent_jobs), oc_max_retries = VALUES(oc_max_retries),
      is_active = VALUES(is_active), sort_order = VALUES(sort_order),
      unlimited_storage = VALUES(unlimited_storage), unlimited_bandwidth = VALUES(unlimited_bandwidth),
      bandwidth_resets_monthly = VALUES(bandwidth_resets_monthly),
      qr_limit = VALUES(qr_limit), share_link_limit = VALUES(share_link_limit),
      sales_channel = VALUES(sales_channel), updated_at = NOW()`,
    [
      plan.id,
      plan.name,
      plan.tagline,
      plan.description,
      plan.storageGb,
      plan.bandwidthGb,
      plan.products,
      plan.priceMonthlyInr,
      plan.priceYearlyInr,
      plan.yearlyPricingMode || "manual",
      plan.yearlyDiscountPercent ?? null,
      plan.trialHours ?? null,
      plan.popular,
      plan.badge || null,
      plan.icon,
      JSON.stringify(plan.features || []),
      plan.limits.customBranding,
      plan.limits.advancedAnalytics,
      plan.limits.embedViewer,
      plan.limits.priorityProcessing,
      plan.limits.prioritySupport,
      plan.limits.allowAr !== false ? 1 : 0,
      plan.limits.allowQr !== false ? 1 : 0,
      plan.limits.allowShare !== false ? 1 : 0,
      plan.limits.allowViewer !== false ? 1 : 0,
      plan.limits.allowUpload !== false ? 1 : 0,
      plan.limits.allowObjectCapture !== false ? 1 : 0,
      plan.limits.allowCustomDomain ? 1 : 0,
      plan.ocCapturesPerMonth ?? null,
      plan.ocComputeSecondsPerMonth ?? null,
      plan.ocConcurrentJobs ?? null,
      plan.ocMaxRetries ?? null,
      plan.isActive,
      plan.sortOrder,
      plan.unlimitedStorage ? 1 : 0,
      plan.unlimitedBandwidth ? 1 : 0,
      plan.bandwidthResetsMonthly ? 1 : 0,
      plan.qrLimit ?? null,
      plan.shareLinkLimit ?? null,
      plan.salesChannel || (plan.id === "enterprise" ? "manual" : "self_service"),
    ],
  );

  return plan;
}

export async function countActiveSubscriptionsForPlan(planId: string): Promise<number> {
  await ensureBillingPlanSchema();
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total
       FROM customer_subscriptions
      WHERE plan_id = ?
        AND status IN ('trialing', 'active', 'past_due')`,
    [planId],
  ).catch(() => [{ total: 0 }]);
  return Number(rows[0]?.total || 0);
}

export async function deleteBillingPlan(planId: string): Promise<void> {
  await ensureBillingPlanSchema();
  await query("DELETE FROM billing_plans WHERE id = ?", [planId]);
}

export async function replaceBillingPlans(plans: Partial<AdminBillingPlan>[]) {
  await ensureBillingPlanSchema();

  const cleaned = plans.map((plan, index) => cleanPlan(plan, index));
  for (const [index, plan] of cleaned.entries()) {
    await upsertBillingPlan(plan, index);
  }

  const ids = cleaned.map((plan) => plan.id);
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    await query(
      `UPDATE billing_plans SET is_active = 0
       WHERE id IN ('trial','starter','intermediate','pro','business','enterprise')
         AND id NOT IN (${placeholders})`,
      ids,
    );
  }

  return getBillingPlans();
}

export async function getCustomerPlan(customerUid: string): Promise<CustomerPlanStatus | null> {
  await ensureBillingPlanSchema();

  const rows = await query<{
    customer_uid: string;
    plan_id: string;
    plan_name: string;
    status: CustomerPlanStatus["status"];
    trial_started_at: Date | string | null;
    trial_ends_at: Date | string | null;
    current_period_start: Date | string | null;
    current_period_end: Date | string | null;
    cancel_at_period_end: 0 | 1 | boolean;
  }>(
    `SELECT s.customer_uid, s.plan_id,
        COALESCE(p.name, ecp.name, s.plan_id) AS plan_name,
      s.status, s.trial_started_at, s.trial_ends_at, s.current_period_start,
      s.current_period_end, s.cancel_at_period_end
     FROM customer_subscriptions s
     LEFT JOIN billing_plans p ON p.id = s.plan_id
     LEFT JOIN enterprise_custom_plans ecp ON ecp.custom_plan_uid = s.plan_id
     WHERE s.customer_uid = ?
     LIMIT 1`,
    [customerUid],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    customerUid: row.customer_uid,
    planId: row.plan_id?.startsWith("ecp_") ? row.plan_id : mapLegacyPlanId(row.plan_id),
    planName: row.plan_name,
    status: row.status,
    trialStartedAt: dateToIso(row.trial_started_at),
    trialEndsAt: dateToIso(row.trial_ends_at),
    currentPeriodStart: dateToIso(row.current_period_start),
    currentPeriodEnd: dateToIso(row.current_period_end),
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

export async function setCustomerPlan(input: {
  customerUid: string;
  planId: string;
  status?: CustomerPlanStatus["status"];
  trialHours?: number | null;
  periodDays?: number | null;
  trialStartedAt?: string | Date | null;
  trialEndsAt?: string | Date | null;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  /** Master Admin id — used when converting catalog Enterprise → contract. */
  adminId?: number | null;
}) {
  await ensureBillingPlanSchema();

  // Catalog "enterprise" must become a real custom plan + contract (not a naked plan_id).
  const mappedPlanId = mapLegacyPlanId(String(input.planId || "").trim());
  if (mappedPlanId === "enterprise" && !String(input.planId).toLowerCase().startsWith("ecp_")) {
    const { convertCatalogEnterpriseToContract } = await import(
      "@/lib/enterprise-sales/admin-enterprise-assign"
    );
    const billingCycle =
      input.periodDays != null && Number(input.periodDays) >= 360 ? "yearly" : "monthly";
    await convertCatalogEnterpriseToContract({
      customerUid: input.customerUid,
      adminId: input.adminId ?? null,
      billingCycle,
      currentPeriodStart: input.currentPeriodStart
        ? new Date(input.currentPeriodStart)
        : null,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null,
      status: input.status || "active",
    });
    return getCustomerPlan(input.customerUid);
  }

  // Enterprise custom plans live outside billing_plans — allow status/date overrides only.
  if (input.planId.startsWith("ecp_")) {
    const ecpRows = await query<{
      custom_plan_uid: string;
      name: string;
      billing_cycle: string;
      product_limit: number | null;
      storage_limit_bytes: number | null;
      bandwidth_limit_bytes: number | null;
    }>(
      `SELECT custom_plan_uid, name, billing_cycle, product_limit,
              storage_limit_bytes, bandwidth_limit_bytes
         FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1`,
      [input.planId],
    );
    if (!ecpRows[0]) throw new Error("Enterprise custom plan not found.");
    const status = input.status || "active";
    const now = new Date();
    const currentPeriodStart = input.currentPeriodStart !== undefined
      ? (input.currentPeriodStart ? new Date(input.currentPeriodStart) : null)
      : (status === "active" || status === "paused" ? now : null);
    const currentPeriodEnd = input.currentPeriodEnd !== undefined
      ? (input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null)
      : (status === "active" || status === "paused"
        ? new Date(now.getTime() + (ecpRows[0].billing_cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000)
        : null);

    const { applySubscriptionChange } = await import("@/server/billing/subscription.repository");
    await applySubscriptionChange({
      customerUid: input.customerUid,
      planId: input.planId,
      status,
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      provider: "manual_enterprise",
      productLimit: ecpRows[0].product_limit ?? null,
      storageLimitMb: ecpRows[0].storage_limit_bytes ? Math.round(Number(ecpRows[0].storage_limit_bytes) / (1024 * 1024)) : null,
      bandwidthLimitMb: ecpRows[0].bandwidth_limit_bytes ? Math.round(Number(ecpRows[0].bandwidth_limit_bytes) / (1024 * 1024)) : null,
      unlimitedStorage: ecpRows[0].storage_limit_bytes ? 0 : 1,
      unlimitedBandwidth: ecpRows[0].bandwidth_limit_bytes ? 0 : 1,
    });
    return getCustomerPlan(input.customerUid);
  }

  const plan = (await getBillingPlans()).find((item) => item.id === input.planId);
  if (!plan) throw new Error("Plan not found.");

  const status = input.status || ((input.planId === "free" || input.planId === "trial") ? "trialing" : "active");
  const now = new Date();
  const trialHours = input.trialHours ?? plan.trialHours ?? null;
  const periodDays = input.periodDays ?? 30;

  const trialStartedAt = input.trialStartedAt !== undefined
    ? (input.trialStartedAt ? new Date(input.trialStartedAt) : null)
    : (status === "trialing" ? now : null);

  const trialEndsAt = input.trialEndsAt !== undefined
    ? (input.trialEndsAt ? new Date(input.trialEndsAt) : null)
    : (status === "trialing" && trialHours ? new Date(now.getTime() + trialHours * 60 * 60 * 1000) : null);

  const currentPeriodStart = input.currentPeriodStart !== undefined
    ? (input.currentPeriodStart ? new Date(input.currentPeriodStart) : null)
    : (status === "active" ? now : null);

  const currentPeriodEnd = input.currentPeriodEnd !== undefined
    ? (input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null)
    : (status === "active" ? new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000) : null);

  const { applySubscriptionChange } = await import("@/server/billing/subscription.repository");

  await applySubscriptionChange({
    customerUid: input.customerUid,
    planId: input.planId,
    status,
    trialStartedAt,
    trialEndsAt,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    productLimit: plan.products,
    storageLimitMb: Math.round(plan.storageGb * 1024),
    bandwidthLimitMb: Math.round(plan.bandwidthGb * 1024),
    unlimitedStorage: plan.unlimitedStorage ? 1 : 0,
    unlimitedBandwidth: plan.unlimitedBandwidth ? 1 : 0,
  });

  const customerPlan = await getCustomerPlan(input.customerUid);
  if (customerPlan) {
    await sendPlanChangedEmail({
      customerUid: input.customerUid,
      planId: customerPlan.planId,
      status: customerPlan.status,
      periodEnd: customerPlan.currentPeriodEnd || customerPlan.trialEndsAt,
      eventKey: `${customerPlan.planId}:${customerPlan.status}:${Date.now()}`,
    }).catch(() => undefined);
  }
  return customerPlan;
}
