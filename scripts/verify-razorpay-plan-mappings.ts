import { loadEnvConfig } from "@next/env";
import { query } from "../src/lib/db";

loadEnvConfig(process.cwd());

async function main() {
  const plans = await query<{
    id: string;
    name: string;
    is_active: number;
    sort_order: number;
    price_monthly_inr: number | null;
    price_yearly_inr: number | null;
    sales_channel: string | null;
  }>(
    `SELECT id, name, is_active, sort_order, price_monthly_inr, price_yearly_inr, sales_channel
       FROM billing_plans
      WHERE id IN ('trial','starter','pro','business','enterprise','basic','professional')
      ORDER BY sort_order, id`,
  );
  const prices = await query<{
    plan_id: string;
    billing_interval: string;
    provider_plan_id: string;
    total_paise: number;
    version: number;
    publish_status: string;
  }>(
    `SELECT plan_id, billing_interval, provider_plan_id, total_paise, version, publish_status
       FROM billing_plan_price_versions
      WHERE retired_at IS NULL
      ORDER BY plan_id, billing_interval`,
  );
  console.log(JSON.stringify({ plans, prices }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
