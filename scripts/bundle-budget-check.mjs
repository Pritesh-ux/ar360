#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();
const nextStatic = path.join(root, ".next", "static");
const budgetKb = Number(process.env.BUNDLE_BUDGET_KB || 500);

if (!fs.existsSync(nextStatic)) {
  console.error(".next/static not found. Run npm run build first.");
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(js|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const assets = walk(nextStatic)
  .map((file) => ({
    file: path.relative(root, file).replaceAll("\\\\", "/"),
    kb: Math.round((fs.statSync(file).size / 1024) * 10) / 10,
  }))
  .sort((a, b) => b.kb - a.kb);

console.log(`Bundle budget: ${budgetKb} KB per asset`);
console.log("Largest assets:");
for (const asset of assets.slice(0, 25)) {
  const mark = asset.kb > budgetKb ? "OVER" : "OK";
  console.log(`${mark} ${asset.kb} KB ${asset.file}`);
}

const over = assets.filter((asset) => asset.kb > budgetKb);
if (over.length) {
  console.error(`\n${over.length} asset(s) exceed budget.`);
  process.exit(1);
}

console.log("\nStatus: OK");
