#!/usr/bin/env node
import fs from "fs";
import path from "path";

const root = process.cwd();
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignore = new Set(["node_modules", ".next", ".git", "public", "dist"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (exts.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\\\", "/");
}

const files = walk(root);
const rows = files.map((file) => {
  const text = fs.readFileSync(file, "utf8");
  return {
    file: rel(file),
    lines: text.split(/\r?\n/).length,
    bytes: Buffer.byteLength(text),
    client: text.includes('"use client"') || text.includes("'use client'"),
    states: (text.match(/useState\s*</g) || text.match(/useState\s*\(/g) || []).length,
    effects: (text.match(/useEffect\s*\(/g) || []).length,
    localStorage: (text.match(/localStorage/g) || []).length,
    directDb: /from\s+["']@\/lib\/db["']/.test(text),
    modelViewerCdn: text.includes("unpkg.com/@google/model-viewer"),
  };
});

const bigFiles = rows.filter((r) => r.lines >= 500).sort((a, b) => b.lines - a.lines);
const heavyClients = rows
  .filter((r) => r.client && (r.lines >= 350 || r.states >= 15 || r.effects >= 8))
  .sort((a, b) => b.lines - a.lines);
const storageUsers = rows.filter((r) => r.localStorage > 0).sort((a, b) => b.localStorage - a.localStorage);
const directDbRoutes = rows.filter((r) => r.directDb && r.file.startsWith("src/app/api/"));
const cdnUsers = rows.filter((r) => r.modelViewerCdn);

function printTable(title, data, fields) {
  console.log(`\n## ${title}`);
  if (!data.length) {
    console.log("None");
    return;
  }
  for (const item of data.slice(0, 30)) {
    console.log(fields.map((f) => `${f}: ${item[f]}`).join(" | "));
  }
}

console.log("ARStudio360 Performance Audit");
console.log(`Files scanned: ${files.length}`);
printTable("Large files >= 500 lines", bigFiles, ["file", "lines", "bytes"]);
printTable("Heavy client components", heavyClients, ["file", "lines", "states", "effects"]);
printTable("localStorage usage", storageUsers, ["file", "localStorage"]);
printTable("Direct DB imports in API routes", directDbRoutes, ["file"]);
printTable("External model-viewer CDN usage", cdnUsers, ["file"]);

const fail = bigFiles.some((r) => r.lines > 2500) || cdnUsers.length > 0;
if (fail) {
  console.log("\nStatus: Needs attention");
  process.exitCode = 1;
} else {
  console.log("\nStatus: OK");
}
