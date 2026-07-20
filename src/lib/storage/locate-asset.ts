import fs from "fs/promises";
import path from "path";
import {
  DEFAULT_STORAGE_ROOT,
  LEGACY_STORAGE_ROOT,
  resolveStorageRoot,
} from "@/lib/storage/paths";

function uniqueRoots() {
  return [...new Set([resolveStorageRoot(), DEFAULT_STORAGE_ROOT, LEGACY_STORAGE_ROOT].map((root) => path.resolve(root)))];
}

function buildProductFilePath(root: string, customerUid: string, productUid: string, fileName: string) {
  const safeName = path.basename(fileName);
  return path.resolve(root, customerUid, "Products", productUid, safeName);
}

function isInsideRoot(root: string, candidate: string) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readProductJsonFileName(
  root: string,
  customerUid: string,
  productUid: string,
): Promise<string | null> {
  const jsonPath = buildProductFilePath(root, customerUid, productUid, "product.json");
  if (!isInsideRoot(root, jsonPath)) return null;

  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const json = JSON.parse(raw) as { fileName?: string };
    const fileName = String(json.fileName || "").trim();
    return fileName || null;
  } catch {
    return null;
  }
}

export async function locateProductAssetDiskPath(
  customerUid: string,
  productUid: string,
  fileName: string,
): Promise<string | null> {
  const safeName = path.basename(fileName);
  const namesToTry = new Set<string>([safeName]);

  if (safeName === "model.glb") {
    for (const root of uniqueRoots()) {
      const altName = await readProductJsonFileName(root, customerUid, productUid);
      if (altName) namesToTry.add(path.basename(altName));
    }
  }

  for (const root of uniqueRoots()) {
    for (const name of namesToTry) {
      const candidate = buildProductFilePath(root, customerUid, productUid, name);
      if (!isInsideRoot(root, candidate)) continue;
      if (await fileExists(candidate)) return candidate;
    }
  }

  return null;
}

export async function locateProductJsonPath(
  customerUid: string,
  productUid: string,
): Promise<string | null> {
  for (const root of uniqueRoots()) {
    const candidate = buildProductFilePath(root, customerUid, productUid, "product.json");
    if (!isInsideRoot(root, candidate)) continue;
    if (await fileExists(candidate)) return candidate;
  }

  return null;
}

export function getStorageRootsForScan() {
  return uniqueRoots();
}
