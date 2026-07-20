import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { runCaptureWorkerLoop, defaultWorkerId } = await import(
    "../src/lib/object-capture/worker/worker"
  );
  const shutdown = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[]) {
    process.on(signal, () => {
      console.log(`Received ${signal}; terminating the active process tree and releasing via lease expiry.`);
      shutdown.abort();
    });
  }
  const workerId = process.env.OC_WORKER_ID?.trim() || defaultWorkerId();
  console.log(`Object Capture native worker started: ${workerId}`);
  console.log(`Platform: ${process.platform}; direct MySQL claim/lease mode`);
  await runCaptureWorkerLoop({ workerId }, shutdown.signal);
}

main().catch((error) => {
  console.error("Object Capture worker stopped unexpectedly:", error);
  process.exitCode = 1;
});
