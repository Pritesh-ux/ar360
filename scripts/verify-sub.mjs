import nextEnv from "@next/env";
import { checkSubscription } from "../src/lib/subscription/check-subscription.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const result = await checkSubscription("CUS-755513");
  console.log("Subscription status:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
