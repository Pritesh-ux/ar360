#!/usr/bin/env node
/*
  ARStudio360 Sprint 2.5 Viewer Smoke Test

  Usage:
    node scripts/viewer-smoke-test.mjs PRD_PM896RD9
    node scripts/viewer-smoke-test.mjs PRD_PM896RD9 http://localhost:3000

  What it checks:
    - /api/public-products/[id]
    - /viewer/[id]
    - /viewer/[id]?openAR=1

  This script does not modify your database or files.
*/

const productId = process.argv[2];
const baseUrl = (process.argv[3] || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

if (!productId) {
  console.error("\nMissing product id.\nExample: node scripts/viewer-smoke-test.mjs PRD_PM896RD9\n");
  process.exit(1);
}

async function check(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: "manual", ...options });
    const ms = Date.now() - started;
    const contentType = response.headers.get("content-type") || "";
    let body = "";

    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      body = json ? JSON.stringify(json).slice(0, 700) : "<invalid json>";
    } else {
      body = await response.text().then((text) => text.slice(0, 300)).catch(() => "");
    }

    const ok = response.status >= 200 && response.status < 400;
    return { url, ok, status: response.status, ms, contentType, body };
  } catch (error) {
    return { url, ok: false, status: 0, ms: Date.now() - started, contentType: "", body: error?.message || String(error) };
  }
}

function print(result) {
  const mark = result.ok ? "✅" : "❌";
  console.log(`${mark} ${result.status} ${result.ms}ms ${result.url}`);
  if (!result.ok) console.log(`   ${result.body}`);
}

const results = [];
results.push(await check(`/api/public-products/${encodeURIComponent(productId)}`));
results.push(await check(`/viewer/${encodeURIComponent(productId)}`));
results.push(await check(`/viewer/${encodeURIComponent(productId)}?openAR=1`));

console.log(`\nARStudio360 Viewer Smoke Test`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Product: ${productId}\n`);
results.forEach(print);

const publicProduct = results[0];
if (publicProduct.ok && publicProduct.body.includes("modelUrl")) {
  console.log("\n✅ Public product API returned modelUrl data.");
} else if (publicProduct.ok) {
  console.log("\n⚠ Public product API responded, but modelUrl was not detected in response preview.");
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.log("\n❌ Smoke test failed. Fix these routes before continuing Sprint 3.");
  process.exit(1);
}

console.log("\n✅ Sprint 2 viewer routes are reachable. Now manually verify model visibility, rotate, zoom, AR and mobile popup.");
