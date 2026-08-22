/**
 * Apply diamond + yellow-gold material settings to Jewelry product.
 * Run: node scripts/apply-jewelry-diamond-gold.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const PRODUCT_ID = "PRD_KCAJ2P2X";
const PRODUCT_JSON = path.resolve(
  "storage/Customers/CUS-169432/Products/PRD_KCAJ2P2X/product.json",
);

const DIAMOND = {
  baseColor: "#f7fbff",
  metalness: 0,
  roughness: 0,
  emissiveColor: "#000000",
  baseColorTexture: "",
  metallicRoughnessTexture: "",
  normalTexture: "",
  emissiveTexture: "",
  occlusionTexture: "",
  occlusionStrength: 1,
  opacity: 1,
  alphaMode: "OPAQUE",
  transmission: 0.95,
  ior: 2.42,
  thickness: 0.45,
  attenuationDistance: 1.2,
  attenuationColor: "#eef6ff",
  specularIntensity: 1,
  specularColor: "#ffffff",
  envMapIntensity: 1.55,
  reflectionIntensity: 1.35,
  reflectionBlur: 0,
  reflectionTint: "#ffffff",
  fresnelStrength: 1.1,
  clearcoat: 0.12,
  clearcoatRoughness: 0,
  normalScale: 1,
  bumpTexture: "",
  bumpScale: 1,
  doubleSided: true,
  depthWrite: true,
  depthTest: true,
  castShadow: true,
  receiveShadow: true,
  renderOrder: 0,
};

const YELLOW_GOLD = {
  baseColor: "#e8b84a",
  metalness: 1,
  roughness: 0.12,
  emissiveColor: "#000000",
  baseColorTexture: "",
  metallicRoughnessTexture: "",
  normalTexture: "",
  emissiveTexture: "",
  occlusionTexture: "",
  occlusionStrength: 1,
  opacity: 1,
  alphaMode: "OPAQUE",
  transmission: 0,
  ior: 1.5,
  thickness: 0,
  attenuationDistance: 0,
  attenuationColor: "#ffffff",
  specularIntensity: 1,
  specularColor: "#fff2d6",
  envMapIntensity: 1.65,
  reflectionIntensity: 1.4,
  reflectionBlur: 0,
  reflectionTint: "#ffe9b8",
  fresnelStrength: 1,
  clearcoat: 0.55,
  clearcoatRoughness: 0.06,
  normalScale: 1,
  bumpTexture: "",
  bumpScale: 1,
  doubleSided: false,
  depthWrite: true,
  depthTest: true,
  castShadow: true,
  receiveShadow: true,
  renderOrder: 0,
};

const MATERIAL_SETTINGS = {
  0: { ...DIAMOND },
  1: { ...DIAMOND },
  2: { ...YELLOW_GOLD },
  3: { ...YELLOW_GOLD },
};

async function main() {
  const product = JSON.parse(fs.readFileSync(PRODUCT_JSON, "utf8"));
  const nextVersion = Math.max(Number(product.version || 1), 1) + 10;
  product.updatedAt = new Date().toISOString();
  product.version = nextVersion;
  product.environmentImage = "neutral";
  product.useSkybox = true;
  product.exposure = 1.2;
  product.backgroundColor = "#F0F2F5";
  product.backgroundType = "hdri";
  product.materialSettings = MATERIAL_SETTINGS;
  product.nativeMaterialSettings = MATERIAL_SETTINGS;

  if (Array.isArray(product.variants) && product.variants[0]) {
    product.variants[0] = {
      ...product.variants[0],
      materialSettings: MATERIAL_SETTINGS,
      environmentImage: "neutral",
      exposure: 1.2,
      backgroundColor: "#F0F2F5",
      useSkybox: true,
    };
  }

  const modelUrl = String(product.modelUrl || "").split("?")[0];
  product.modelUrl = `${modelUrl}?v=${Date.now()}`;
  fs.writeFileSync(PRODUCT_JSON, JSON.stringify(product, null, 2));

  const conn = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "arstudio",
  });

  const [rows] = await conn.query(
    "SELECT variants, settings, version FROM products WHERE id=? LIMIT 1",
    [PRODUCT_ID],
  );
  const row = rows[0] || {};
  let variants = [];
  try {
    variants = row.variants ? JSON.parse(row.variants) : [];
  } catch {
    variants = [];
  }
  if (!variants.length) variants = [{ id: "default", name: "Default" }];
  variants[0] = {
    ...variants[0],
    materialSettings: MATERIAL_SETTINGS,
    environmentImage: "neutral",
    exposure: 1.2,
    backgroundColor: "#F0F2F5",
    useSkybox: true,
  };

  let settings = {};
  try {
    settings = row.settings ? JSON.parse(row.settings) : {};
  } catch {
    settings = {};
  }
  settings = {
    ...settings,
    environmentImage: "neutral",
    useSkybox: true,
    exposure: 1.2,
    backgroundColor: "#F0F2F5",
    backgroundType: "hdri",
    materialSettings: MATERIAL_SETTINGS,
  };

  const dbVersion = Math.max(Number(row.version || 1), nextVersion) + 1;
  await conn.query(
    `UPDATE products SET material_settings=?, variants=?, settings=?, version=?, model_url=?, updated_at=NOW() WHERE id=?`,
    [
      JSON.stringify(MATERIAL_SETTINGS),
      JSON.stringify(variants),
      JSON.stringify(settings),
      dbVersion,
      product.modelUrl,
      PRODUCT_ID,
    ],
  );
  product.version = dbVersion;
  fs.writeFileSync(PRODUCT_JSON, JSON.stringify(product, null, 2));
  await conn.end();

  console.log("Applied diamond + yellow gold.");
  console.log("version", dbVersion);
  console.log("Open fresh (do not save old Unsaved tab):");
  console.log(`http://localhost:3000/dashboard/products/${PRODUCT_ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
