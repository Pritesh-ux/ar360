import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const { runObjectCaptureCleanup } = await import("../src/lib/object-capture/cleanup");
const intervalMs = Math.max(60_000, Number(process.env.OC_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000));
const workerId = process.env.OC_CLEANUP_WORKER_ID?.trim() || `cleanup-${process.pid}`;
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as NodeJS.Signals[]) {
  process.on(signal, () => {
    console.log(`Received ${signal}; stopping Object Capture cleanup loop.`);
    stopping = true;
  });
}

console.log(`Object Capture cleanup started: ${workerId}; interval=${intervalMs}ms`);
do {
  try {
    console.log(JSON.stringify(await runObjectCaptureCleanup(workerId)));
  } catch {
    // Keep credentials and driver connection strings out of service logs.
    console.error("Object Capture cleanup failed; verify database migration and workspace configuration.");
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
} while (!stopping);
