import os from "node:os";
import { stat } from "node:fs/promises";
import {
  claimNextCaptureJob,
  finishCaptureJob,
  heartbeatCaptureJob,
  heartbeatCaptureWorker,
  isCaptureJobCancellationRequested,
} from "../repository";
import { recordCaptureCompute } from "../operations";
import { resolveStorageKey } from "../workspace";
import { CommandCancelledError } from "./command-runner";
import { runReconstructionPipeline } from "./reconstruction-pipeline";

export type WorkerOptions = {
  workerId?: string;
  leaseSeconds?: number;
  heartbeatMs?: number;
  globalTimeoutMs?: number;
};

export type WorkerRunResult = {
  jobId: string;
  status: "completed" | "failed" | "cancelled" | "lease_lost" | "shutdown";
} | null;

export function defaultWorkerId() {
  return `oc-${os.hostname().replace(/[^a-zA-Z0-9_-]/g, "_")}-${process.pid}`;
}

export async function runOneCaptureJob(
  options: WorkerOptions = {},
  shutdownSignal?: AbortSignal,
): Promise<WorkerRunResult> {
  const workerId = options.workerId || defaultWorkerId();
  const leaseSeconds = options.leaseSeconds || Number(process.env.OC_LEASE_SECONDS || 90);
  const heartbeatMs = options.heartbeatMs || Number(process.env.OC_HEARTBEAT_MS || 20_000);
  const globalTimeoutMs =
    options.globalTimeoutMs || Number(process.env.OC_GLOBAL_TIMEOUT_MS || 8 * 60 * 60 * 1000);
  if (heartbeatMs >= leaseSeconds * 1000) {
    throw new Error("OC_HEARTBEAT_MS must be shorter than the lease duration.");
  }

  await heartbeatCaptureWorker(workerId, null);
  const job = await claimNextCaptureJob(workerId, leaseSeconds);
  if (!job) return null;
  await heartbeatCaptureWorker(workerId, job.id);
  const computeStartedAt = Date.now();
  let outputBytes = 0;

  const controller = new AbortController();
  let cancellationRequested = false;
  let leaseLost = false;
  let shuttingDown = false;
  let globalTimedOut = false;
  let currentStage = "claimed";
  let currentProgress = 30;
  let pendingLog = "";
  let lastStageFlushed = "";
  let lastLeaseRefresh = Date.now();

  const onShutdown = () => {
    shuttingDown = true;
    controller.abort();
  };
  shutdownSignal?.addEventListener("abort", onShutdown, { once: true });

  const heartbeat = async () => {
    if (controller.signal.aborted) return;
    try {
      if (await isCaptureJobCancellationRequested(job.id, job.lease_token)) {
        cancellationRequested = true;
        controller.abort();
        return;
      }
      const alive = await heartbeatCaptureJob(job.id, job.lease_token, leaseSeconds, {
        stage: currentStage,
        progress: currentProgress,
        log: pendingLog || undefined,
      });
      pendingLog = "";
      lastStageFlushed = currentStage;
      if (!alive) {
        leaseLost = true;
        controller.abort();
      } else {
        lastLeaseRefresh = Date.now();
        await heartbeatCaptureWorker(workerId, job.id);
      }
    } catch {
      // Tolerate one transient failure, but stop before another worker can recover
      // the expired lease and run the same job concurrently.
      if (Date.now() - lastLeaseRefresh > leaseSeconds * 1000 * 0.8) {
        leaseLost = true;
        controller.abort();
      }
    }
  };
  const interval = setInterval(() => void heartbeat(), heartbeatMs);
  interval.unref();
  const timeout = setTimeout(() => {
    globalTimedOut = true;
    controller.abort();
  }, globalTimeoutMs);
  timeout.unref();

  try {
    const artifact = await runReconstructionPipeline(
      job.customer_uid,
      job.id,
      job.lease_token,
      {
        signal: controller.signal,
        onProgress: async (stage, progress, message) => {
          currentStage = stage;
          currentProgress = Math.max(currentProgress, Math.min(99, Math.round(progress)));
          if (message) pendingLog = `${pendingLog}\n${message}`.slice(-4000);
          if (stage !== lastStageFlushed) {
            lastStageFlushed = stage;
            await heartbeat();
          }
        },
      },
    );
    outputBytes = await stat(resolveStorageKey(job.customer_uid, artifact.modelKey))
      .then((info) => info.size)
      .catch(() => 0);
    if (await isCaptureJobCancellationRequested(job.id, job.lease_token)) {
      cancellationRequested = true;
      await finishCaptureJob(job.id, job.lease_token, { status: "cancelled" });
      return { jobId: job.id, status: "cancelled" };
    }
    const completed = await finishCaptureJob(job.id, job.lease_token, {
      status: "completed",
      modelKey: artifact.modelKey,
      modelUrl: artifact.modelUrl,
    });
    if (!completed && await isCaptureJobCancellationRequested(job.id, job.lease_token)) {
      await finishCaptureJob(job.id, job.lease_token, { status: "cancelled" });
      return { jobId: job.id, status: "cancelled" };
    }
    return { jobId: job.id, status: completed ? "completed" : "lease_lost" };
  } catch (error) {
    if (shuttingDown) return { jobId: job.id, status: "shutdown" };
    if (leaseLost) return { jobId: job.id, status: "lease_lost" };
    if (cancellationRequested || (error instanceof CommandCancelledError && !globalTimedOut)) {
      await finishCaptureJob(job.id, job.lease_token, { status: "cancelled" });
      return { jobId: job.id, status: "cancelled" };
    }
    const message = globalTimedOut
      ? `Reconstruction exceeded global timeout (${globalTimeoutMs}ms)`
      : error instanceof Error
        ? error.message
        : "Reconstruction failed";
    await finishCaptureJob(job.id, job.lease_token, { status: "failed", error: message });
    return { jobId: job.id, status: "failed" };
  } finally {
    await recordCaptureCompute(
      job.id,
      job.customer_uid,
      (Date.now() - computeStartedAt) / 1000,
      outputBytes,
    ).catch(() => undefined);
    await heartbeatCaptureWorker(workerId, null).catch(() => undefined);
    clearInterval(interval);
    clearTimeout(timeout);
    shutdownSignal?.removeEventListener("abort", onShutdown);
  }
}

export async function runCaptureWorkerLoop(
  options: WorkerOptions & { pollMs?: number } = {},
  signal?: AbortSignal,
) {
  const pollMs = options.pollMs || Number(process.env.OC_WORKER_INTERVAL_MS || 15_000);
  while (!signal?.aborted) {
    const result = await runOneCaptureJob(options, signal);
    if (signal?.aborted) break;
    if (!result) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, pollMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
  }
}
