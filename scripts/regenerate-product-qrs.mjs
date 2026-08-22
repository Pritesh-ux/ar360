#!/usr/bin/env node
/**
 * Backfill product qr.png files with AR360 (or plan-allowed custom) center logos.
 *
 * Usage (on VPS from deploy root):
 *   node scripts/regenerate-product-qrs.mjs --dry-run
 *   node scripts/regenerate-product-qrs.mjs
 *   node scripts/regenerate-product-qrs.mjs --limit 50
 */

import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import process from "process";
import mysql from "mysql2/promise";
import QRCode from "qrcode";
import sharp from "sharp";

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
const DRY_RUN = flag("dry-run");
const LIMIT = Number(option("limit", "0")) || 0;

function loadEnvFile(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(path.join(ROOT, ".env"));

const APP_URL = String(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ar360studio.com").replace(
  /\/+$/,
  "",
);
const BRAND_LOGO = path.join(ROOT, "public", "brand", "qr-center-logo.png");
const STORAGE = path.join(ROOT, "storage", "Customers");

async function loadLogoBuffer(logoUrl) {
  const trimmed = String(logoUrl || "").trim();
  if (!trimmed) return fs.readFile(BRAND_LOGO);

  if (trimmed.startsWith("data:")) {
    const match = /^data:[^;]+;base64,(.+)$/i.exec(trimmed);
    if (!match) return fs.readFile(BRAND_LOGO);
    return Buffer.from(match[1], "base64");
  }

  if (trimmed.includes("/brand/") || trimmed.endsWith("qr-center-logo.png")) {
    const rel = trimmed.includes("/brand/")
      ? trimmed.slice(trimmed.indexOf("/brand/") + 1)
      : "brand/qr-center-logo.png";
    try {
      return await fs.readFile(path.join(ROOT, "public", rel.replace(/^\//, "")));
    } catch {
      return fs.readFile(BRAND_LOGO);
    }
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      return await fs.readFile(path.join(ROOT, "public", trimmed.replace(/^\//, "")));
    } catch {
      /* fall through */
    }
    try {
      return await fs.readFile(path.join(ROOT, "storage", trimmed.replace(/^\//, "")));
    } catch {
      return fs.readFile(BRAND_LOGO);
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await fetch(trimmed, { signal: AbortSignal.timeout(8000) });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch {
      /* fall through */
    }
  }

  return fs.readFile(BRAND_LOGO);
}

async function stampCenterLogo(qrPng, logoBytes, sizePercent) {
  const qrMeta = await sharp(qrPng).metadata();
  const canvas = qrMeta.width || 1024;
  const targetWidth = Math.max(48, Math.round(canvas * (Math.min(40, Math.max(12, sizePercent)) / 100)));
  const resizedLogo = await sharp(logoBytes)
    .ensureAlpha()
    .trim({ threshold: 24 })
    .resize({ width: targetWidth, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  const padX = Math.max(6, Math.round(canvas * 0.012));
  const padY = Math.max(4, Math.round(canvas * 0.008));
  const plateW = resizedLogo.info.width + padX * 2;
  const plateH = resizedLogo.info.height + padY * 2;
  const plate = await sharp({
    create: {
      width: plateW,
      height: plateH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .composite([{ input: resizedLogo.data, left: padX, top: padY }])
    .toBuffer();

  const left = Math.max(0, Math.round((canvas - plateW) / 2));
  const top = Math.max(0, Math.round(((qrMeta.height || canvas) - plateH) / 2));
  return sharp(qrPng).composite([{ input: plate, left, top }]).png().toBuffer();
}

function isBrandLogo(url) {
  const value = String(url || "").toLowerCase();
  return (
    !value ||
    value.includes("/brand/qr-center-logo.png") ||
    value.endsWith("qr-center-logo.png") ||
    value.includes("/brand/ui-mark.png") ||
    value.includes("/brand/ar360-mark")
  );
}

async function main() {
  await fs.access(BRAND_LOGO);

  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "arstudio",
    connectionLimit: 2,
  });

  const [rows] = await pool.query(
    `SELECT q.id, q.customer_uid, q.product_id, q.qr_code, q.qr_uid, q.public_id,
            q.logo_url, q.logo_size, q.destination_url
       FROM product_qr_codes q
      WHERE q.deleted_at IS NULL
      ORDER BY q.id ASC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}`,
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const qrCode = row.qr_code || row.qr_uid || row.public_id || row.product_id;
    const destination = `${APP_URL}/qr/${encodeURIComponent(qrCode)}`;
    const outPath = path.join(STORAGE, row.customer_uid, "Products", row.product_id, "qr.png");
    const customUrl = String(row.logo_url || "").trim();
    // DB only stores user custom logos; null/empty means AR360 brand.
    const useCustom = Boolean(customUrl) && !isBrandLogo(customUrl);
    const logoUrl = useCustom ? customUrl : "/brand/qr-center-logo.png";
    const size = useCustom
      ? Number(row.logo_size) >= 12 && Number(row.logo_size) <= 40
        ? Number(row.logo_size)
        : 22
      : 32;

    try {
      if (DRY_RUN) {
        console.log(`[dry-run] #${row.id} ${row.product_id} -> ${logoUrl} @${size}%`);
        ok += 1;
        continue;
      }

      await fs.mkdir(path.dirname(outPath), { recursive: true });
      let png = await QRCode.toBuffer(destination, {
        type: "png",
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "H",
      });
      const logoBytes = await loadLogoBuffer(logoUrl);
      png = await stampCenterLogo(png, logoBytes, size);
      await fs.writeFile(outPath, png);
      console.log(`[ok] #${row.id} ${row.product_id} (${useCustom ? "custom" : "ar360"})`);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[fail] #${row.id} ${row.product_id}`, error?.message || error);
    }
  }

  await pool.end();
  console.log(`DONE ok=${ok} skipped=${skipped} failed=${failed} dryRun=${DRY_RUN}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
