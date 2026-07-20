import fs from "node:fs/promises";
import path from "node:path";
import { loadProjectEnv, requireReachableServer } from "./lib/env-utils.mjs";
import { createSmokeSession } from "./lib/smoke-session.mjs";

loadProjectEnv();

const baseUrl = process.argv[2] || process.env.APP_URL || "http://localhost:3000";

console.log(`Product flow smoke: ${baseUrl}`);
await requireReachableServer(baseUrl);

const { fetchWithCookies, smokeLogin } = createSmokeSession(baseUrl);
let failed = false;

function mark(ok, label) {
  console.log(`${ok ? "OK" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

try {
  await smokeLogin();
  mark(true, "smoke-login");
} catch (error) {
  mark(false, `smoke-login ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

let customerUid = "";
try {
  const bootstrap = await fetchWithCookies(`${baseUrl}/api/customer/bootstrap`);
  const data = await bootstrap.json();
  customerUid = data?.customer?.customerUid || "";
  mark(bootstrap.ok && customerUid, `bootstrap ${bootstrap.status} customerUid=${customerUid || "missing"}`);
} catch (error) {
  mark(false, `bootstrap ${error instanceof Error ? error.message : error}`);
}

if (!customerUid) {
  process.exit(1);
}

const glbPath = path.join(process.cwd(), "public", "models", "chair.glb");
const glbBuffer = await fs.readFile(glbPath);
const modelFile = new File([glbBuffer], "smoke-test.glb", { type: "model/gltf-binary" });

const form = new FormData();
form.append("title", "Smoke Test Product");
form.append("category", "Furniture");
form.append("customerUid", customerUid);
form.append("model", modelFile);

let productUid = "";
try {
  const uploadRes = await fetchWithCookies(`${baseUrl}/api/products/local-upload`, {
    method: "POST",
    body: form,
  });
  const uploadData = await uploadRes.json().catch(() => ({}));
  productUid = uploadData?.product?.productUid || uploadData?.product?.id || "";
  mark(uploadRes.ok && productUid, `local-upload ${uploadRes.status} productUid=${productUid || "missing"}`);
  if (!uploadRes.ok) console.log("  ", uploadData.error || uploadData);
} catch (error) {
  mark(false, `local-upload ${error instanceof Error ? error.message : error}`);
}

if (!productUid) {
  process.exit(1);
}

try {
  const saveRes = await fetchWithCookies(`${baseUrl}/api/products/save-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerUid,
      productUid,
      status: "Published",
      productPatch: {
        title: "Smoke Test Product",
        status: "Published",
      },
    }),
  });
  const saveData = await saveRes.json().catch(() => ({}));
  mark(saveRes.ok, `save-assets publish ${saveRes.status}`);
  if (!saveRes.ok) console.log("  ", saveData.error || saveData);
} catch (error) {
  mark(false, `save-assets ${error instanceof Error ? error.message : error}`);
}

try {
  const ownedRes = await fetchWithCookies(`${baseUrl}/api/products/${productUid}`);
  mark(ownedRes.ok, `products/${productUid} ${ownedRes.status}`);
} catch (error) {
  mark(false, `products/${productUid} ${error instanceof Error ? error.message : error}`);
}

try {
  const publicRes = await fetch(`${baseUrl}/api/public-products/${productUid}`);
  const publicData = await publicRes.json().catch(() => ({}));
  const hasModel = Boolean(publicData?.product?.modelUrl || publicData?.modelUrl || publicData?.model_url);
  mark(publicRes.ok && hasModel, `public-products/${productUid} ${publicRes.status}`);
  if (!publicRes.ok) console.log("  ", publicData.error || publicData);
} catch (error) {
  mark(false, `public-products/${productUid} ${error instanceof Error ? error.message : error}`);
}

if (failed) process.exit(1);
console.log("\nProduct flow smoke passed.\n");
