#!/usr/bin/env node
/**
 * One-off / ops: build model.ar.glb next to an existing model.glb and patch product.json.
 *
 * Usage:
 *   node scripts/generate-ar-lite.mjs <absolute-product-folder>
 *   node scripts/generate-ar-lite.mjs /var/www/ar360/deploy/storage/Customers/CUS-…/Products/PRD_…
 */
import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: node scripts/generate-ar-lite.mjs <product-folder>");
    process.exit(1);
  }

  const modelPath = path.join(folder, "model.glb");
  const arPath = path.join(folder, "model.ar.glb");
  const jsonPath = path.join(folder, "product.json");

  const input = await fs.readFile(modelPath);
  console.log(`input=${(input.length / 1048576).toFixed(2)}MB`);

  // Prefer compiled deploy dist if present; else tsx path via dynamic import of built JS is hard.
  // Run from repo with tsx:
  const { buildArLiteGlb, describeGlbOptimizeStats } = await import(
    "../src/lib/products/glb-optimize.ts"
  ).catch(async () => {
    // Fallback: evaluate via tsx register if available
    require("tsx/cjs/api").register();
    return import("../src/lib/products/glb-optimize.ts");
  });

  const lite = await buildArLiteGlb(input);
  console.log(describeGlbOptimizeStats(lite.stats));

  if (!lite.stats.optimized) {
    console.error("AR lite not produced:", lite.stats.skippedReason);
    process.exit(2);
  }

  await fs.writeFile(arPath, lite.buffer);
  console.log(`wrote ${arPath} (${(lite.buffer.length / 1048576).toFixed(2)}MB)`);

  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const json = JSON.parse(raw);
    json.modelBytes = input.length;
    const modelUrl = String(json.modelUrl || "");
    if (modelUrl.includes("/api/assets/") && /model\.glb/i.test(modelUrl)) {
      json.arModelUrl = modelUrl.replace(/model\.glb/i, "model.ar.glb");
    } else if (json.publicFolder) {
      json.arModelUrl = `${String(json.publicFolder).replace(/\/$/, "")}/model.ar.glb`;
    } else {
      json.arModelUrl = "model.ar.glb";
    }
    json.updatedAt = new Date().toISOString();
    await fs.writeFile(jsonPath, JSON.stringify(json, null, 2));
    console.log("patched product.json");
  } catch (err) {
    console.warn("product.json not patched:", err?.message || err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
