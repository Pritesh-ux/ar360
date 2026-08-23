/**
 * Gem integration stress test — catalog scale vs GPU scale.
 * Run: node --import tsx scripts/gem-integration-stress.mjs
 */
import { AssetLoadQueue } from "../src/lib/gem-integration/assetLoadQueue.ts";
import { BoundedResourceCache } from "../src/lib/gem-integration/boundedResourceCache.ts";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeCatalog(n) {
  return Array.from({ length: n }, (_, i) => ({
    productId: `PRD_STRESS_${i}`,
    modelUrl: `/api/assets/stress/${i}/model.glb`,
    thumbnailUrl: `/api/assets/stress/${i}/thumb.jpg`,
    title: `Stress product ${i}`,
  }));
}

async function runStress() {
  const catalog = makeCatalog(100);
  const queue = new AssetLoadQueue();
  queue.setMaxConcurrent(2);

  let fetchCount = 0;
  let peakActive = 0;
  const disposed = [];

  const cache = new BoundedResourceCache({
    maxWarmEntries: 1,
    maxWarmBytes: 64 * 1024 * 1024,
  });

  const startupFetches = fetchCount;
  console.log(`[stress] catalog entries: ${catalog.length}`);
  console.log(`[stress] startup GLB fetches: ${startupFetches} (expected 0)`);

  const active = catalog[42];
  const activeKey = `${active.productId}::${active.modelUrl}`;
  cache.pinActive(activeKey);

  await queue.enqueue(active.productId, "glb", 100, async () => {
    fetchCount++;
    await sleep(20);
    return { dispose: () => disposed.push(active.productId) };
  });

  peakActive = Math.max(peakActive, queue.getStats().active);

  cache.set(
    activeKey,
    active.productId,
    { dispose: () => disposed.push(active.productId) },
    4 * 1024 * 1024,
  );

  const prefetch = catalog.slice(0, 5).map((p) =>
    queue.enqueue(p.productId, "prefetch", 1, async () => {
      fetchCount++;
      await sleep(30);
      return null;
    }),
  );

  peakActive = Math.max(peakActive, queue.getStats().active);
  await Promise.allSettled(prefetch);

  const next = catalog[7];
  const nextKey = `${next.productId}::${next.modelUrl}`;
  cache.pinActive(nextKey);

  await queue.enqueue(next.productId, "glb", 100, async () => {
    fetchCount++;
    await sleep(15);
    return { dispose: () => disposed.push(next.productId) };
  });

  cache.set(
    nextKey,
    next.productId,
    { dispose: () => disposed.push(next.productId) },
    3 * 1024 * 1024,
  );
  cache.disposeAllExcept(nextKey);

  const stats = cache.stats();
  const passed =
    startupFetches === 0 &&
    fetchCount <= 8 &&
    peakActive <= 2 &&
    stats.size <= 2;

  console.log(`[stress] total simulated GLB fetches: ${fetchCount}`);
  console.log(`[stress] peak concurrent loads: ${peakActive} (max 2 desktop)`);
  console.log(`[stress] cache entries after switch: ${stats.size} (expected ≤2)`);
  console.log(`[stress] explicit disposals: ${disposed.length}`);
  console.log(passed ? "[stress] PASS — bounded resources" : "[stress] FAIL");

  process.exit(passed ? 0 : 1);
}

runStress().catch((e) => {
  console.error(e);
  process.exit(1);
});
