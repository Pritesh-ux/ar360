#!/usr/bin/env node
/**
 * Downscales oversized textures inside already-stored product GLBs.
 *
 * Authoring tools embed source-resolution maps (9600px is common from KeyShot),
 * which decode to over a gigabyte of texture memory and crash mobile browsers.
 * Uploads are optimized in the API; this script fixes models stored before that.
 *
 * Usage:
 *   node scripts/optimize-product-glbs.mjs --dry-run
 *   node scripts/optimize-product-glbs.mjs --product PRD_4LEMUQ88
 *   node scripts/optimize-product-glbs.mjs --max-texture 2048 --quality 82
 */

import fs from "fs/promises";
import path from "path";
import process from "process";

const args = process.argv.slice(2);
function flag(name) {
  return args.includes(`--${name}`);
}
function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

const ROOT = path.resolve(option("root", process.cwd()));
const STORAGE_ROOT = path.join(ROOT, "storage", "Customers");
const BACKUP_ROOT = path.join(ROOT, "storage", "glb-originals");
const MAX_TEXTURE = Number(option("max-texture", 2048));
const QUALITY = Number(option("quality", 82));
const MIN_GAIN_RATIO = 0.05;
const MIN_GAIN_BYTES = 256 * 1024;
const DRY_RUN = flag("dry-run");
const SKIP_BACKUP = flag("no-backup");
const SKIP_DB = flag("skip-db");
const ONLY_PRODUCT = option("product", "");

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

function jpegDimensions(buf) {
  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function imageDimensions(data) {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return jpegDimensions(buf);
  return null;
}

async function walkModels(dir) {
  const found = [];
  let customers;
  try {
    customers = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const customer of customers) {
    if (!customer.isDirectory()) continue;
    const productsRoot = path.join(dir, customer.name, "Products");
    let products;
    try {
      products = await fs.readdir(productsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const product of products) {
      if (!product.isDirectory()) continue;
      if (ONLY_PRODUCT && product.name !== ONLY_PRODUCT) continue;
      const modelPath = path.join(productsRoot, product.name, "model.glb");
      try {
        const stat = await fs.stat(modelPath);
        found.push({
          customerUid: customer.name,
          productUid: product.name,
          modelPath,
          sizeBytes: stat.size,
        });
      } catch {
        // no model for this product
      }
    }
  }

  return found.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

async function optimizeModel(entry, deps) {
  const { NodeIO, ALL_EXTENSIONS, textureCompress, sharp } = deps;
  const original = await fs.readFile(entry.modelPath);

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(new Uint8Array(original));

  let largestBefore = 0;
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const size = imageDimensions(image);
    if (size) largestBefore = Math.max(largestBefore, size.width, size.height);
  }

  // Only oversized maps are worth touching; on geometry-heavy models a re-encode
  // loses quality without meaningfully shrinking the file.
  if (largestBefore <= MAX_TEXTURE) {
    return { skipped: `textures-within-limit (${largestBefore}px)`, largestBefore };
  }

  await document.transform(
    textureCompress({
      encoder: sharp,
      resize: [MAX_TEXTURE, MAX_TEXTURE],
      resizeFilter: "lanczos3",
      quality: QUALITY,
    }),
  );

  const output = Buffer.from(await io.writeBinary(document));

  let largestAfter = 0;
  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const size = imageDimensions(image);
    if (size) largestAfter = Math.max(largestAfter, size.width, size.height);
  }

  const saved = original.length - output.length;
  if (saved < MIN_GAIN_BYTES || saved / original.length < MIN_GAIN_RATIO) {
    return { skipped: "no-meaningful-gain", largestBefore, largestAfter };
  }

  // Re-read the written bytes to prove the model still parses before replacing.
  const verify = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const reparsed = await verify.readBinary(new Uint8Array(output));
  const meshesBefore = document.getRoot().listMeshes().length;
  const meshesAfter = reparsed.getRoot().listMeshes().length;
  if (meshesAfter !== meshesBefore) {
    return { skipped: `mesh-mismatch:${meshesBefore}->${meshesAfter}`, largestBefore, largestAfter };
  }

  if (DRY_RUN) {
    return { dryRun: true, originalBytes: original.length, optimizedBytes: output.length, largestBefore, largestAfter };
  }

  if (!SKIP_BACKUP) {
    const backupDir = path.join(BACKUP_ROOT, entry.customerUid, entry.productUid);
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `model-${Date.now()}.glb`);
    await fs.writeFile(backupPath, original);
  }

  const tempPath = `${entry.modelPath}.optimized`;
  await fs.writeFile(tempPath, output);
  await fs.rename(tempPath, entry.modelPath);

  return { originalBytes: original.length, optimizedBytes: output.length, largestBefore, largestAfter };
}

function parseEnvFile(contents) {
  const env = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']/, "").replace(/["']$/, "");
  }
  return env;
}

async function syncStorageUsage(customerUids) {
  if (SKIP_DB || DRY_RUN || !customerUids.size) return;

  let env = {};
  try {
    env = parseEnvFile(await fs.readFile(path.join(ROOT, ".env"), "utf8"));
  } catch {
    console.warn("  (no .env found — skipping database sync)");
    return;
  }

  let mysql;
  try {
    mysql = (await import("mysql2/promise")).default;
  } catch {
    console.warn("  (mysql2 unavailable — skipping database sync)");
    return;
  }

  const connection = await mysql.createConnection({
    host: env.MYSQL_HOST || "127.0.0.1",
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  });

  try {
    for (const customerUid of customerUids) {
      const productsRoot = path.join(STORAGE_ROOT, customerUid, "Products");
      let totalBytes = 0;
      const products = await fs.readdir(productsRoot, { withFileTypes: true }).catch(() => []);
      for (const product of products) {
        if (!product.isDirectory()) continue;
        const files = await fs.readdir(path.join(productsRoot, product.name), { withFileTypes: true }).catch(() => []);
        for (const file of files) {
          if (!file.isFile()) continue;
          const stat = await fs.stat(path.join(productsRoot, product.name, file.name)).catch(() => null);
          if (!stat) continue;
          totalBytes += stat.size;
          await connection
            .execute(
              `INSERT INTO product_assets (customer_uid, product_uid, file_path, size_bytes)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes)`,
              [customerUid, product.name, file.name, stat.size],
            )
            .catch(() => {});
        }
      }
      await connection
        .execute("UPDATE customers SET storage_used_mb = ? WHERE customer_uid = ?", [
          totalBytes / 1048576,
          customerUid,
        ])
        .catch(() => {});
      console.log(`  db: ${customerUid} storage_used_mb = ${(totalBytes / 1048576).toFixed(2)}`);
    }
  } finally {
    await connection.end().catch(() => {});
  }
}

async function main() {
  console.log("=== GLB texture optimizer ===");
  console.log(`root         : ${ROOT}`);
  console.log(`max texture  : ${MAX_TEXTURE}px`);
  console.log(`jpeg quality : ${QUALITY}`);
  console.log(`mode         : ${DRY_RUN ? "dry run" : "apply"}`);
  if (ONLY_PRODUCT) console.log(`product      : ${ONLY_PRODUCT}`);
  console.log();

  let deps;
  try {
    const [core, extensions, functions, sharpModule] = await Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
      import("sharp"),
    ]);
    deps = {
      NodeIO: core.NodeIO,
      ALL_EXTENSIONS: extensions.ALL_EXTENSIONS,
      textureCompress: functions.textureCompress,
      sharp: sharpModule.default,
    };
  } catch (error) {
    console.error("Missing dependencies. Install with: npm install sharp @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions");
    console.error(String(error?.message || error));
    process.exit(1);
  }

  const models = await walkModels(STORAGE_ROOT);
  if (!models.length) {
    console.log(`No product models found under ${STORAGE_ROOT}`);
    return;
  }

  console.log(`Found ${models.length} model(s)\n`);

  const touchedCustomers = new Set();
  let savedBytes = 0;
  let optimizedCount = 0;

  for (const entry of models) {
    process.stdout.write(`${entry.productUid.padEnd(20)} ${mb(entry.sizeBytes).padStart(10)}  `);
    try {
      const result = await optimizeModel(entry, deps);
      if (result.skipped) {
        console.log(`skip (${result.skipped})`);
        continue;
      }
      const saved = result.originalBytes - result.optimizedBytes;
      savedBytes += saved;
      optimizedCount++;
      if (!result.dryRun) touchedCustomers.add(entry.customerUid);
      console.log(
        `${result.dryRun ? "would shrink" : "shrunk"} → ${mb(result.optimizedBytes)} ` +
          `(-${((saved / result.originalBytes) * 100).toFixed(0)}%), ` +
          `${result.largestBefore}px → ${result.largestAfter}px`,
      );
    } catch (error) {
      console.log(`FAILED: ${String(error?.message || error).slice(0, 120)}`);
    }
  }

  console.log();
  if (touchedCustomers.size) {
    console.log("Syncing storage usage...");
    await syncStorageUsage(touchedCustomers);
  }

  console.log(`\n${optimizedCount} model(s) ${DRY_RUN ? "would be" : ""} optimized, ${mb(savedBytes)} saved.`);
  if (!DRY_RUN && !SKIP_BACKUP && optimizedCount) {
    console.log(`Originals kept in ${BACKUP_ROOT}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
