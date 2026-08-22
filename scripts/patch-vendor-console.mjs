#!/usr/bin/env node
/**
 * @google/model-viewer 4.3.1 ships debug console.log statements and still loads
 * HDR environments through three's deprecated RGBELoader. Both spam the browser
 * console on every viewer page, so the installed package is patched after
 * install. Re-running is a no-op.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(root, "node_modules", "@google", "model-viewer");

const DEBUG_LOG_MARKERS = [
  "[onExtraModelChanged]",
  "IntersectionObserver fired!",
  "[$updateSource]",
];

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function stripDebugLogs(filePath) {
  const source = readIfExists(filePath);
  if (source == null) return false;

  const kept = source
    .split("\n")
    .filter((line) => {
      if (!line.includes("console.log(")) return true;
      return !DEBUG_LOG_MARKERS.some((marker) => line.includes(marker));
    })
    .join("\n");

  if (kept === source) return false;
  fs.writeFileSync(filePath, kept, "utf8");
  return true;
}

function useHdrLoader(filePath) {
  const source = readIfExists(filePath);
  if (source == null || !source.includes("RGBELoader")) return false;

  const patched = source
    .replace(
      /import \{ RGBELoader \} from 'three\/examples\/jsm\/loaders\/RGBELoader\.js';/,
      "import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';",
    )
    .replace(/new RGBELoader\(\)/g, "new HDRLoader()");

  if (patched === source) return false;
  fs.writeFileSync(filePath, patched, "utf8");
  return true;
}

if (!fs.existsSync(packageRoot)) {
  console.log("[patch-vendor-console] @google/model-viewer not installed — skipped.");
  process.exit(0);
}

const changed = [];
if (stripDebugLogs(path.join(packageRoot, "lib", "model-viewer-base.js"))) {
  changed.push("lib/model-viewer-base.js (debug logs)");
}
if (useHdrLoader(path.join(packageRoot, "lib", "three-components", "TextureUtils.js"))) {
  changed.push("lib/three-components/TextureUtils.js (HDRLoader)");
}

console.log(
  changed.length
    ? `[patch-vendor-console] patched: ${changed.join(", ")}`
    : "[patch-vendor-console] already clean.",
);
