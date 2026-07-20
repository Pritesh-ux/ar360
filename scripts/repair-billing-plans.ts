import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { query } from "../src/lib/db";
import { ensureBillingPlanSchema, getBillingPlans } from "../src/lib/billing/admin-plans";

/**
 * Repair messy plan catalog:
 * - Fix business / enterprise 0 limits
 * - Rename starter display name
 * - Keep legacy basic/professional inactive
 */
async function main() {
  await ensureBillingPlanSchema();

  await query(
    `UPDATE billing_plans
     SET name = 'STARTER',
         tagline = COALESCE(NULLIF(tagline, ''), 'Upgrade your info-commerce'),
         storage_gb = CASE WHEN storage_gb <= 0 THEN 0.5 ELSE storage_gb END,
         bandwidth_gb = CASE WHEN bandwidth_gb <= 0 THEN 5 ELSE bandwidth_gb END,
         products = CASE WHEN products <= 0 THEN 10 ELSE products END,
         is_active = 1,
         sort_order = 1,
         updated_at = NOW()
     WHERE id = 'starter'`,
  );

  await query(
    `UPDATE billing_plans
     SET name = 'PRO',
         storage_gb = CASE WHEN storage_gb <= 0 THEN 5 ELSE storage_gb END,
         bandwidth_gb = CASE WHEN bandwidth_gb <= 0 THEN 50 ELSE bandwidth_gb END,
         products = CASE WHEN products <= 0 THEN 50 ELSE products END,
         is_active = 1,
         popular = 1,
         badge = 'Most Popular',
         sort_order = 2,
         updated_at = NOW()
     WHERE id = 'pro'`,
  );

  await query(
    `UPDATE billing_plans
     SET name = 'BUSINESS',
         tagline = COALESCE(NULLIF(tagline, ''), 'Scale high-volume AR workflows'),
         storage_gb = CASE WHEN storage_gb <= 0 THEN 25 ELSE storage_gb END,
         bandwidth_gb = CASE WHEN bandwidth_gb <= 0 THEN 250 ELSE bandwidth_gb END,
         products = CASE WHEN products <= 0 THEN 250 ELSE products END,
         price_monthly_inr = COALESCE(price_monthly_inr, 9999),
         price_yearly_inr = COALESCE(price_yearly_inr, 99990),
         is_active = 1,
         sort_order = 3,
         updated_at = NOW()
     WHERE id = 'business'`,
  );

  await query(
    `UPDATE billing_plans
     SET name = 'ENTERPRISE',
         storage_gb = CASE WHEN storage_gb <= 0 THEN 25 ELSE storage_gb END,
         bandwidth_gb = CASE WHEN bandwidth_gb <= 0 THEN 250 ELSE bandwidth_gb END,
         products = CASE WHEN products <= 0 THEN 250 ELSE products END,
         price_monthly_inr = NULL,
         price_yearly_inr = NULL,
         sales_channel = 'manual',
         is_active = 1,
         sort_order = 4,
         updated_at = NOW()
     WHERE id = 'enterprise'`,
  );

  await query(
    `UPDATE billing_plans
     SET is_active = 0, updated_at = NOW()
     WHERE id IN ('basic', 'professional', 'free')`,
  );

  await query(
    `UPDATE billing_plans
     SET name = 'TRIAL', is_active = 1, sort_order = 0, updated_at = NOW()
     WHERE id = 'trial'`,
  );

  const plans = await getBillingPlans();
  console.log(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.isActive,
      products: p.products,
      storageGb: p.storageGb,
      bandwidthGb: p.bandwidthGb,
      monthly: p.priceMonthlyInr,
    })),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
