import nextEnv from "@next/env";
import { ensureBillingPlanSchema, getBillingPlans } from "../src/lib/billing/admin-plans.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  console.log("Setting up billing schemas...");
  await ensureBillingPlanSchema();
  const plans = await getBillingPlans();
  console.log(`Billing plan schema initialized. Plans loaded: ${plans.length}`);
}

main().catch(console.error);
