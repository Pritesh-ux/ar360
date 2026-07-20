import { promises as fs } from "fs";
import path from "path";

const write = process.argv.includes("--write");
const root = process.cwd();
const storageRoot = path.join(root, "public", "Storage", "Customers");

async function exists(filePath) { try { await fs.access(filePath); return true; } catch { return false; } }
function publicFolderFor(customerUid, productUid) { return `/Storage/Customers/${customerUid}/Products/${productUid}`; }

async function collectProductJsonFiles() {
  const files = [];
  if (!(await exists(storageRoot))) return files;
  for (const customer of await fs.readdir(storageRoot, { withFileTypes: true })) {
    if (!customer.isDirectory()) continue;
    const productsDir = path.join(storageRoot, customer.name, "Products");
    if (!(await exists(productsDir))) continue;
    for (const product of await fs.readdir(productsDir, { withFileTypes: true })) {
      if (!product.isDirectory()) continue;
      const file = path.join(productsDir, product.name, "product.json");
      if (await exists(file)) files.push(file);
    }
  }
  return files;
}

const files = await collectProductJsonFiles();
let repaired = 0;
for (const file of files) {
  const productDir = path.dirname(file);
  const raw = await fs.readFile(file, "utf8");
  const product = JSON.parse(raw);
  const productUid = product.productUid || product.id || path.basename(productDir);
  const customerUid = product.customerUid || path.basename(path.dirname(path.dirname(productDir)));
  const publicFolder = publicFolderFor(customerUid, productUid);
  const next = {
    ...product,
    id: product.id || productUid,
    productUid,
    customerUid,
    publicFolder,
    modelUrl: `${publicFolder}/model.glb`,
    poster: `${publicFolder}/poster.png`,
    thumbnailUrl: `${publicFolder}/thumbnail.png`,
    qrUrl: `${publicFolder}/qr.png`,
    destination: product.destination || `http://localhost:3000/viewer/${productUid}`,
    status: product.status || "Draft",
    views: Number(product.views || 0),
    variants: Array.isArray(product.variants) && product.variants.length
      ? product.variants.map((variant, index) => ({
          ...variant,
          id: variant.id || (index === 0 ? "default" : `variant-${index}`),
          name: variant.name || (index === 0 ? "Default" : `Variant ${index + 1}`),
          poster: variant.poster || `${publicFolder}/poster.png`,
        }))
      : [{
          id: "default",
          name: "Default",
          materialSettings: product.materialSettings || {},
          environmentImage: product.environmentImage || "neutral",
          exposure: product.exposure ?? 1,
          backgroundColor: product.backgroundColor || "#ffffff",
          transparent: product.transparent ?? false,
          shadowIntensity: product.shadowIntensity ?? 1,
          shadowSoftness: product.shadowSoftness ?? 1,
          autoRotate: product.autoRotate ?? true,
          cameraControls: product.cameraControls ?? true,
          interactionPrompt: product.interactionPrompt ?? true,
          autoPlay: product.autoPlay ?? true,
          fov: product.fov ?? 45,
          poster: `${publicFolder}/poster.png`,
        }],
    activeVariantId: product.activeVariantId || "default",
    materialSettings: product.materialSettings || {},
    logoDecals: product.logoDecals || [],
    hotspots: product.hotspots || [],
    updatedAt: new Date().toISOString(),
  };

  const after = `${JSON.stringify(next, null, 2)}\n`;
  if (after !== raw) {
    repaired += 1;
    console.log(`${write ? "REPAIRED" : "WOULD_REPAIR"}: ${file}`);
    if (write) await fs.writeFile(file, after, "utf8");
  }
}
console.log(JSON.stringify({ scanned: files.length, repaired, write }, null, 2));
