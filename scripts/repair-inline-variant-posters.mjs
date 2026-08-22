#!/usr/bin/env node
/**
 * Editor builds before the inline-asset guard stored variant thumbnails as
 * base64 data URLs inside products.variants. Those rows are megabytes wide and
 * slow every viewer/QR load, so this one-off repair writes each thumbnail into
 * the product folder and rewrites the JSON (DB row + product.json) to a path.
 *
 * Usage: node scripts/repair-inline-variant-posters.mjs [--dry-run]
 */
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const dryRun = process.argv.includes("--dry-run");

const STORAGE_PUBLIC_PREFIX = "/Storage/Customers";
const IMAGE_DATA_URL_RE = /^data:image\/([a-z+]+);base64,(.+)$/i;
const EXTENSIONS = { jpeg: "jpg", jpg: "jpg", png: "png", webp: "webp", "svg+xml": "svg" };
const SAFE_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
loadEnvFile(path.join(appRoot, ".env"));
loadEnvFile(path.join(appRoot, ".env.local"));

function directoryHasEntries(dir) {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function resolveStorageRoot() {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  const primary = path.resolve(appRoot, "storage", "Customers");
  if (directoryHasEntries(primary)) return primary;
  const legacy = path.resolve(appRoot, "public", "Storage", "Customers");
  if (directoryHasEntries(legacy)) return legacy;
  return primary;
}

const storageRoot = resolveStorageRoot();

function parseVariants(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function writeThumbnail(customerUid, productUid, variantId, dataUrl) {
  const match = String(dataUrl).match(IMAGE_DATA_URL_RE);
  if (!match) return null;
  if (!SAFE_SEGMENT_RE.test(customerUid) || !SAFE_SEGMENT_RE.test(productUid)) return null;

  const extension = EXTENSIONS[match[1].toLowerCase()] || "png";
  const slug = String(variantId || "variant").replace(/[^A-Za-z0-9_-]/g, "") || "variant";
  const fileName = `variant-${slug}.${extension}`;
  const folder = path.join(storageRoot, customerUid, "Products", productUid);
  const target = path.join(folder, fileName);

  if (!dryRun) {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(target, Buffer.from(match[2], "base64"));
  }

  return `${STORAGE_PUBLIC_PREFIX}/${customerUid}/Products/${productUid}/${fileName}`;
}

function rewriteProductJson(customerUid, productUid, variants) {
  const file = path.join(storageRoot, customerUid, "Products", productUid, "product.json");
  if (!fs.existsSync(file)) return false;
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    json.variants = variants;
    if (!dryRun) fs.writeFileSync(file, JSON.stringify(json, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "arstudio",
  });

  const [rows] = await connection.execute(
    `SELECT id, customer_uid, variants
       FROM products
      WHERE variants IS NOT NULL
        AND CAST(variants AS CHAR) LIKE '%data:image%'`,
  );

  console.log(`Storage root: ${storageRoot}`);
  console.log(`Rows with inline variant thumbnails: ${rows.length}${dryRun ? " (dry run)" : ""}`);

  let repaired = 0;
  for (const row of rows) {
    const variants = parseVariants(row.variants);
    if (!variants) continue;

    let touched = false;
    const next = variants.map((variant) => {
      if (!variant || typeof variant !== "object") return variant;
      if (typeof variant.poster !== "string" || !variant.poster.startsWith("data:image/")) {
        return variant;
      }
      const url = writeThumbnail(row.customer_uid, row.id, variant.id, variant.poster);
      touched = true;
      const copy = { ...variant };
      if (url) copy.poster = url;
      else delete copy.poster;
      return copy;
    });

    if (!touched) continue;

    const before = JSON.stringify(variants).length;
    const after = JSON.stringify(next).length;

    if (!dryRun) {
      await connection.execute(`UPDATE products SET variants = ? WHERE id = ? AND customer_uid = ?`, [
        JSON.stringify(next),
        row.id,
        row.customer_uid,
      ]);
      rewriteProductJson(row.customer_uid, row.id, next);
    }

    repaired += 1;
    console.log(`  ${row.id} (${row.customer_uid}): ${before} -> ${after} bytes`);
  }

  console.log(`Repaired ${repaired} product(s).`);
  await connection.end();
}

main().catch((error) => {
  console.error("Repair failed:", error);
  process.exit(1);
});
