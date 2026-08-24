/**
 * LRU cache for heavy product GPU/GLB resources.
 * ACTIVE product is never evicted. WARM keeps at most 1 recent product.
 */

export type CacheEntry<T> = {
  key: string;
  productId: string;
  value: T;
  lastUsed: number;
  bytesEstimate: number;
};

export type BoundedCacheOptions = {
  /** Max warm heavy entries (excluding pinned active). */
  maxWarmEntries: number;
  /** Soft byte budget for warm entries. */
  maxWarmBytes: number;
};

const DEFAULT_OPTS: BoundedCacheOptions = {
  maxWarmEntries: 1,
  maxWarmBytes: 64 * 1024 * 1024,
};

export class BoundedResourceCache<T extends { dispose?: () => void }> {
  private entries = new Map<string, CacheEntry<T>>();
  private pinnedKey: string | null = null;
  private opts: BoundedCacheOptions;

  constructor(opts: Partial<BoundedCacheOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  pinActive(key: string) {
    this.pinnedKey = key;
    const e = this.entries.get(key);
    if (e) e.lastUsed = Date.now();
  }

  clearPin() {
    this.pinnedKey = null;
  }

  get(key: string): T | null {
    const e = this.entries.get(key);
    if (!e) return null;
    e.lastUsed = Date.now();
    return e.value;
  }

  set(key: string, productId: string, value: T, bytesEstimate = 0) {
    this.entries.set(key, {
      key,
      productId,
      value,
      lastUsed: Date.now(),
      bytesEstimate,
    });
    this.evictIfNeeded();
  }

  delete(key: string) {
    const e = this.entries.get(key);
    if (e?.value?.dispose) {
      try {
        e.value.dispose();
      } catch {
        /* ignore */
      }
    }
    this.entries.delete(key);
    if (this.pinnedKey === key) this.pinnedKey = null;
  }

  disposeAllExcept(key: string | null) {
    for (const k of [...this.entries.keys()]) {
      if (k !== key) this.delete(k);
    }
  }

  stats() {
    return {
      size: this.entries.size,
      pinned: this.pinnedKey,
      bytes: [...this.entries.values()].reduce((s, e) => s + e.bytesEstimate, 0),
    };
  }

  private evictIfNeeded() {
    const warm = [...this.entries.values()].filter(
      (e) => e.key !== this.pinnedKey,
    );
    warm.sort((a, b) => a.lastUsed - b.lastUsed);
    let warmBytes = warm.reduce((s, e) => s + e.bytesEstimate, 0);
    while (
      warm.length > this.opts.maxWarmEntries ||
      warmBytes > this.opts.maxWarmBytes
    ) {
      const victim = warm.shift();
      if (!victim) break;
      this.delete(victim.key);
      warmBytes -= victim.bytesEstimate;
    }
  }
}
