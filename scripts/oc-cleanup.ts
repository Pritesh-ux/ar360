import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const { runObjectCaptureCleanup } = await import("../src/lib/object-capture/cleanup");
const workerId = process.env.OC_CLEANUP_WORKER_ID?.trim() || `cleanup-${process.pid}`;

try {
  const result = await runObjectCaptureCleanup(workerId);
  console.log(JSON.stringify(result));
  if (result.errors > 0) process.exitCode = 1;
} catch (error) {
  console.error("Object Capture cleanup failed:", error);
  process.exitCode = 1;
}
