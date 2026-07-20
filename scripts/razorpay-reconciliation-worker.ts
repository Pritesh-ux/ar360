import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { runProviderReconciliationBatch, expireStaleCheckoutSessions } = await import(
    "../src/server/billing/provider-reconciliation.service"
  );
  const once = process.argv.includes("--once");
  do {
    await expireStaleCheckoutSessions();
    const result = await runProviderReconciliationBatch(
      Math.max(1, Number(process.env.RAZORPAY_RECONCILIATION_BATCH_SIZE || 50)),
    );
    console.log(JSON.stringify(result));
    if (!once) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(60_000, Number(process.env.RAZORPAY_RECONCILIATION_INTERVAL_MS || 900_000))),
      );
    }
  } while (!once);
}

main().catch((error) => {
  console.error("Razorpay reconciliation worker failed:", error);
  process.exitCode = 1;
});
