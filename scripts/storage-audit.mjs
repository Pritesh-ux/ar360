import { promises as fs } from "fs";
import path from "path";

const root = process.cwd();
const storageRoot = path.join(root, "public", "Storage", "Customers");

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function normalizePublicStoragePath(value) {
  if (!value) return "";
  let p = String(value).trim().replaceAll("\\\\", "/");
  const idx = p.toLowerCase().indexOf("/storage/");
  if (idx >= 0) p = p.slice(idx);
  const idx2 = p.toLowerCase().indexOf("storage/");
  if (!p.startsWith("/") && idx2 >= 0) p = `/${p.slice(idx2)}`;
  if (p.startsWith("public/")) p = p.slice("public".length);
  return p;
}

async function collectProductJsonFiles() {
  const files = [];
  if (!(await exists(storageRoot))) return files;
  const customers = await fs.readdir(storageRoot, { withFileTypes: true });
  for (const customer of customers) {
    if (!customer.isDirectory()) continue;
    const productsDir = path.join(storageRoot, customer.name, "Products");
    if (!(await exists(productsDir))) continue;
    const products = await fs.readdir(productsDir, { withFileTypes: true });
    for (const product of products) {
      if (!product.isDirectory()) continue;
      const productJson = path.join(productsDir, product.name, "product.json");
      if (await exists(productJson)) files.push(productJson);
    }
  }
  return files;
}

const files = await collectProductJsonFiles();
const report = [];
for (const file of files) {
  const productDir = path.dirname(file);
  const raw = await fs.readFile(file, "utf8");
  let product;
  try { product = JSON.parse(raw); } catch (error) {
    report.push({ file, critical: ["Invalid JSON"], warnings: [] });
    continue;
  }

  const critical = [];
  const warnings = [];
  const productUid = product.productUid || product.id || path.basename(productDir);
  const customerUid = product.customerUid || path.basename(path.dirname(path.dirname(productDir)));
  const publicFolder = `/Storage/Customers/${customerUid}/Products/${productUid}`;

  if (!productUid) critical.push("Missing productUid/id");
  if (!customerUid) critical.push("Missing customerUid");
  if (!(await exists(path.join(productDir, "model.glb")))) critical.push("Missing model.glb");
  if (!(await exists(path.join(productDir, "poster.png")))) warnings.push("Missing poster.png");
  if (!(await exists(path.join(productDir, "thumbnail.png")))) warnings.push("Missing thumbnail.png");
  if (!(await exists(path.join(productDir, "qr.png")))) warnings.push("Missing qr.png");
  if (normalizePublicStoragePath(product.modelUrl) !== `${publicFolder}/model.glb`) warnings.push("modelUrl should be normalized");
  if (product.poster && normalizePublicStoragePath(product.poster) !== `${publicFolder}/poster.png`) warnings.push("poster path should be normalized");

  report.push({ file, customerUid, productUid, title: product.title, critical, warnings });
}

const criticalCount = report.reduce((sum, item) => sum + item.critical.length, 0);
const warningCount = report.reduce((sum, item) => sum + item.warnings.length, 0);
console.log(JSON.stringify({ scanned: files.length, criticalCount, warningCount, report }, null, 2));
process.exit(criticalCount > 0 ? 1 : 0);
