#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();
const storageRoot = path.join(root, "public", "Storage");
const maxModelMb = Number(process.env.MAX_MODEL_MB || 25);

if (!fs.existsSync(storageRoot)) {
  console.log("public/Storage not found. Nothing to audit.");
  process.exit(0);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(glb|gltf|usdz)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

const models = walk(storageRoot)
  .map((file) => ({
    file: path.relative(root, file).replaceAll("\\\\", "/"),
    mb: Math.round((fs.statSync(file).size / 1024 / 1024) * 100) / 100,
  }))
  .sort((a, b) => b.mb - a.mb);

console.log(`Model asset budget: ${maxModelMb} MB`);
for (const model of models.slice(0, 50)) {
  const mark = model.mb > maxModelMb ? "OVER" : "OK";
  console.log(`${mark} ${model.mb} MB ${model.file}`);
}

const over = models.filter((model) => model.mb > maxModelMb);
if (over.length) {
  console.error(`\n${over.length} model asset(s) exceed budget. Optimize/Draco-compress before production.`);
  process.exitCode = 1;
} else {
  console.log("\nStatus: OK");
}
