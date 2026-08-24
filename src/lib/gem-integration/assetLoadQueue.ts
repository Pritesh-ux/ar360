/**
 * Bounded concurrent heavy-asset loader.
 * MOBILE: max 1 · DESKTOP: max 2 · active product always prioritized.
 */

type Job<T> = {
  id: string;
  priority: number;
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  aborted: boolean;
};

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export class AssetLoadQueue {
  private maxConcurrent = isMobileUa() ? 1 : 2;
  private active = 0;
  private queue: Job<unknown>[] = [];
  private inflight = new Map<string, AbortController>();

  setMaxConcurrent(n: number) {
    this.maxConcurrent = Math.max(1, Math.min(4, n));
  }

  getStats() {
    return {
      pending: this.queue.length,
      active: this.active,
    };
  }

  /** Cancel pending jobs for a product (not the active in-flight unless force). */
  cancelForProduct(productId: string) {
    for (const job of this.queue) {
      if (job.id.startsWith(`${productId}:`)) job.aborted = true;
    }
    this.queue = this.queue.filter((j) => !j.aborted);
    const ctrl = this.inflight.get(productId);
    ctrl?.abort();
    this.inflight.delete(productId);
  }

  enqueue<T>(
    productId: string,
    taskKey: string,
    priority: number,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const id = `${productId}:${taskKey}`;
    return new Promise<T>((resolve, reject) => {
      const job: Job<T> = {
        id,
        priority,
        run: () => run(this.inflight.get(productId)?.signal ?? new AbortController().signal),
        resolve,
        reject,
        aborted: false,
      };
      this.queue.push(job as Job<unknown>);
      this.queue.sort((a, b) => b.priority - a.priority);
      this.pump();
    });
  }

  private pump() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job || job.aborted) continue;
      const productId = job.id.split(":")[0] || job.id;
      this.active++;
      const ctrl = new AbortController();
      this.inflight.set(productId, ctrl);
      void job
        .run()
        .then((v) => job.resolve(v))
        .catch((e) => job.reject(e))
        .finally(() => {
          this.active--;
          this.inflight.delete(productId);
          this.pump();
        });
    }
  }
}

export const globalAssetLoadQueue = new AssetLoadQueue();
