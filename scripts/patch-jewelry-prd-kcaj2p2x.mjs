/**
 * Patch Jewelry.glb + product settings toward reference yellow-gold + diamond look.
 * Run: node scripts/patch-jewelry-prd-kcaj2p2x.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const PRODUCT_DIR = path.resolve(
  "storage/Customers/CUS-169432/Products/PRD_KCAJ2P2X",
);
const GLB_PATH = path.join(PRODUCT_DIR, "model.glb");
const PRODUCT_JSON_PATH = path.join(PRODUCT_DIR, "product.json");
const BACKUP_PATH = path.join(PRODUCT_DIR, `model.backup-${Date.now()}.glb`);

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
  transmission: 0.98,
  ior: 2.42,
  thickness: 0.35,
  attenuationDistance: 0.85,
  attenuationColor: "#eaf3ff",
  specularIntensity: 1,
  specularColor: "#ffffff",
  envMapIntensity: 1.35,
  reflectionIntensity: 1.25,
  reflectionBlur: 0,
  reflectionTint: "#ffffff",
  fresnelStrength: 1.15,
  clearcoat: 0.2,
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
  roughness: 0.14,
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
  envMapIntensity: 1.4,
  reflectionIntensity: 1.2,
  reflectionBlur: 0,
  reflectionTint: "#ffe9b8",
  fresnelStrength: 1,
  clearcoat: 0.45,
  clearcoatRoughness: 0.08,
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
  0: { ...DIAMOND }, // Gem
  1: { ...DIAMOND }, // Stone
  2: { ...YELLOW_GOLD }, // Gold
  3: { ...YELLOW_GOLD }, // Obj_Gold
};

function hexToRgb01(hex) {
  const raw = String(hex || "#ffffff").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLen;
  const json = JSON.parse(buf.slice(jsonStart, jsonEnd).toString("utf8"));
  const binChunkStart = jsonEnd;
  let bin = Buffer.alloc(0);
  if (binChunkStart + 8 <= buf.length) {
    const binLen = buf.readUInt32LE(binChunkStart);
    bin = buf.slice(binChunkStart + 8, binChunkStart + 8 + binLen);
  }
  return { json, bin };
}

function writeGlb(filePath, json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);

  let binBuf = bin || Buffer.alloc(0);
  const binPad = (4 - (binBuf.length % 4)) % 4;
  if (binPad) binBuf = Buffer.concat([binBuf, Buffer.alloc(binPad, 0)]);

  const total = 12 + 8 + jsonBuf.length + (binBuf.length ? 8 + binBuf.length : 0);
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0); // glTF
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  jsonBuf.copy(out, 20);
  if (binBuf.length) {
    const off = 20 + jsonBuf.length;
    out.writeUInt32LE(binBuf.length, off);
    out.writeUInt32LE(0x004e4942, off + 4); // BIN
    binBuf.copy(out, off + 8);
  }
  fs.writeFileSync(filePath, out);
}

function ensureExt(json, name) {
  json.extensionsUsed = Array.from(new Set([...(json.extensionsUsed || []), name]));
}

function patchDiamondMaterial(mat, setting) {
  const [r, g, b] = hexToRgb01(setting.baseColor);
  mat.pbrMetallicRoughness = {
    baseColorFactor: [r, g, b, 1],
    metallicFactor: 0,
    roughnessFactor: 0,
  };
  mat.alphaMode = "OPAQUE";
  mat.doubleSided = true;
  delete mat.alphaCutoff;
  mat.extensions = mat.extensions || {};
  mat.extensions.KHR_materials_transmission = { transmissionFactor: setting.transmission };
  mat.extensions.KHR_materials_ior = { ior: setting.ior };
  mat.extensions.KHR_materials_volume = {
    thicknessFactor: setting.thickness,
    attenuationDistance: setting.attenuationDistance,
    attenuationColor: hexToRgb01(setting.attenuationColor),
  };
  mat.extensions.KHR_materials_specular = {
    specularFactor: setting.specularIntensity,
    specularColorFactor: hexToRgb01(setting.specularColor),
  };
  mat.extensions.KHR_materials_clearcoat = {
    clearcoatFactor: setting.clearcoat,
    clearcoatRoughnessFactor: setting.clearcoatRoughness,
  };
  mat.extensions.KHR_materials_iridescence = {
    iridescenceFactor: 0.35,
    iridescenceIor: 1.3,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 400,
  };
}

function patchGoldMaterial(mat, setting) {
  const [r, g, b] = hexToRgb01(setting.baseColor);
  mat.pbrMetallicRoughness = {
    baseColorFactor: [r, g, b, 1],
    metallicFactor: 1,
    roughnessFactor: setting.roughness,
  };
  mat.alphaMode = "OPAQUE";
  mat.doubleSided = false;
  delete mat.alphaCutoff;
  mat.extensions = mat.extensions || {};
  delete mat.extensions.KHR_materials_transmission;
  delete mat.extensions.KHR_materials_volume;
  delete mat.extensions.KHR_materials_ior;
  delete mat.extensions.KHR_materials_iridescence;
  mat.extensions.KHR_materials_clearcoat = {
    clearcoatFactor: setting.clearcoat,
    clearcoatRoughnessFactor: setting.clearcoatRoughness,
  };
  mat.extensions.KHR_materials_specular = {
    specularFactor: setting.specularIntensity,
    specularColorFactor: hexToRgb01(setting.specularColor),
  };
}

async function main() {
  if (!fs.existsSync(GLB_PATH)) {
    throw new Error(`Missing GLB: ${GLB_PATH}`);
  }

  fs.copyFileSync(GLB_PATH, BACKUP_PATH);
  console.log("Backup:", BACKUP_PATH);

  const { json, bin } = readGlb(GLB_PATH);
  const mats = json.materials || [];
  if (mats.length < 4) throw new Error(`Expected 4 materials, got ${mats.length}`);

  // Index mapping from mesh names:
  // 0 Gem, 1 Stone => diamond; 2 Gold, 3 Obj_Gold => yellow gold
  patchDiamondMaterial(mats[0], DIAMOND);
  mats[0].name = "Diamond_Gem";
  patchDiamondMaterial(mats[1], DIAMOND);
  mats[1].name = "Diamond_Stone";
  patchGoldMaterial(mats[2], YELLOW_GOLD);
  mats[2].name = "Yellow_Gold";
  patchGoldMaterial(mats[3], YELLOW_GOLD);
  mats[3].name = "Yellow_Gold_Obj";

  for (const ext of [
    "KHR_materials_transmission",
    "KHR_materials_ior",
    "KHR_materials_volume",
    "KHR_materials_clearcoat",
    "KHR_materials_specular",
    "KHR_materials_iridescence",
  ]) {
    ensureExt(json, ext);
  }

  writeGlb(GLB_PATH, json, bin);
  console.log("Patched GLB materials.");

  const product = JSON.parse(fs.readFileSync(PRODUCT_JSON_PATH, "utf8"));
  product.updatedAt = new Date().toISOString();
  product.environmentImage = "neutral";
  product.useSkybox = true;
  product.exposure = 1.15;
  product.backgroundColor = "#F7F7F7";
  product.materialSettings = MATERIAL_SETTINGS;
  if (Array.isArray(product.variants) && product.variants[0]) {
    product.variants[0].materialSettings = MATERIAL_SETTINGS;
    product.variants[0].environmentImage = "neutral";
    product.variants[0].exposure = 1.15;
    product.variants[0].backgroundColor = "#F7F7F7";
  }
  fs.writeFileSync(PRODUCT_JSON_PATH, JSON.stringify(product, null, 2));
  console.log("Updated product.json");

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "arstudio",
  });

  const [rows] = await conn.query(
    "SELECT variants, settings, version FROM products WHERE id = ? LIMIT 1",
    ["PRD_KCAJ2P2X"],
  );
  const row = rows[0];
  let variants = [];
  try {
    variants = row?.variants ? JSON.parse(row.variants) : [];
  } catch {
    variants = [];
  }
  if (!Array.isArray(variants) || !variants.length) {
    variants = [
      {
        id: "default",
        name: "Default",
        materialSettings: MATERIAL_SETTINGS,
        environmentImage: "neutral",
        exposure: 1.15,
        backgroundColor: "#F7F7F7",
      },
    ];
  } else {
    variants[0] = {
      ...variants[0],
      materialSettings: MATERIAL_SETTINGS,
      environmentImage: "neutral",
      exposure: 1.15,
      backgroundColor: "#F7F7F7",
    };
  }

  let settings = {};
  try {
    settings = row?.settings ? JSON.parse(row.settings) : {};
  } catch {
    settings = {};
  }
  settings = {
    ...settings,
    environmentImage: "neutral",
    useSkybox: true,
    exposure: 1.15,
    backgroundColor: "#F7F7F7",
  };

  await conn.query(
    `UPDATE products
     SET material_settings = ?, variants = ?, settings = ?, version = COALESCE(version,1) + 1, updated_at = NOW()
     WHERE id = ?`,
    [
      JSON.stringify(MATERIAL_SETTINGS),
      JSON.stringify(variants),
      JSON.stringify(settings),
      "PRD_KCAJ2P2X",
    ],
  );
  await conn.end();
  console.log("Updated DB material_settings + variants for PRD_KCAJ2P2X");
  console.log("Open: /dashboard/products/PRD_KCAJ2P2X (hard refresh)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
