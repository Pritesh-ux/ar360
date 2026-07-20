import { loadEnvConfig } from "@next/env";
import { getBillingPlans } from "../src/lib/billing/admin-plans";
import { query } from "../src/lib/db";
import { syncConfiguredRazorpayPlanPrices } from "../src/server/billing/razorpay-plan.service";

loadEnvConfig(process.cwd());

async function main() {
  await query(
    `UPDATE billing_plans
        SET name='STARTER', is_active=1, sort_order=2, sales_channel='self_service'
      WHERE id='starter'`,
  );
  await query(
    `UPDATE billing_plans
        SET name='PRO', is_active=1, sort_order=3, sales_channel='self_service', popular=1, badge='Most Popular'
      WHERE id='pro'`,
  );
  await query(
    `UPDATE billing_plans
        SET name='BUSINESS',
            is_active=1,
            sort_order=4,
            sales_channel='self_service',
            price_monthly_inr=COALESCE(price_monthly_inr, 9999),
            price_yearly_inr=COALESCE(price_yearly_inr, 99990)
      WHERE id='business'`,
  );
  await query(`UPDATE billing_plans SET name='TRIAL', is_active=1, sort_order=1 WHERE id='trial'`);
  await query(
    `UPDATE billing_plans
        SET name='ENTERPRISE',
            is_active=1,
            sort_order=5,
            sales_channel='manual',
            price_monthly_inr=NULL,
            price_yearly_inr=NULL
      WHERE id='enterprise'`,
  );
  await query(`UPDATE billing_plans SET is_active=0 WHERE id IN ('basic','professional')`);

  const plans = await getBillingPlans();
  const targets = plans.filter((plan) => ["starter", "pro", "business"].includes(plan.id));
  const published = [];

  for (const plan of targets) {
    const rows = await syncConfiguredRazorpayPlanPrices(plan);
    published.push({
      id: plan.id,
      name: plan.name,
      monthly: plan.priceMonthlyInr,
      yearly: plan.priceYearlyInr,
      versions: rows.map((row) => ({
        interval: row.billing_interval,
        providerPlanId: row.provider_plan_id,
        totalPaise: row.total_paise,
        version: row.version,
      })),
    });
  }

  console.log(JSON.stringify({ published }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
