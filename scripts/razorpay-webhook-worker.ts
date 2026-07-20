import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { runRazorpayWebhookWorker, defaultRazorpayWebhookWorkerId } = await import(
    "../src/server/billing/razorpay-webhook.processor"
  );
  const shutdown = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[]) {
    process.on(signal, () => shutdown.abort());
  }
  console.log(`Razorpay webhook worker started: ${defaultRazorpayWebhookWorkerId()}`);
  await runRazorpayWebhookWorker(shutdown.signal);
}

main().catch((error) => {
  console.error("Razorpay webhook worker stopped unexpectedly:", error);
  process.exitCode = 1;
});
