import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { resolveStorageRoot } from "@/lib/storage/paths";

const TEMP_NAME_RE = /(^\.|\.tmp$|\.temp$|_cache|\.cache|~$)/i;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]{1,180}$/;

export type CleanupResult = {
  scannedFiles: number;
  removedFiles: number;
  freedBytes: number;
  dryRun: boolean;
  paths: string[];
};

export type OrphanScanResult = {
  orphanCount: number;
  orphanBytes: number;
  orphans: { path: string; customerUid: string; productUid: string; sizeBytes: number }[];
  scannedCustomers: number;
};

function resolveUnderStorageRoot(targetPath: string) {
  const storageRoot = path.resolve(resolveStorageRoot());
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(storageRoot + path.sep) && resolved !== storageRoot) {
    throw new Error("Path is outside storage root");
  }
  return resolved;
}

async function walkFiles(dir: string, onFile: (filePath: string, stat: { size: number }) => Promise<void>) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "temp" || entry.name === "cache" || entry.name === ".cache") {
        await walkFiles(full, onFile);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const stat = await fs.stat(full);
      await onFile(full, { size: stat.size });
    } catch {
      // skip
    }
  }
}

export async function cleanupTempStorage(options?: {
  olderThanDays?: number;
  dryRun?: boolean;
  maxFiles?: number;
}): Promise<CleanupResult> {
  const olderThanDays = options?.olderThanDays ?? 7;
  const dryRun = options?.dryRun ?? false;
  const maxFiles = options?.maxFiles ?? 200;
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const storageRoot = resolveStorageRoot();

  let scannedFiles = 0;
  let removedFiles = 0;
  let freedBytes = 0;
  const paths: string[] = [];

  await walkFiles(storageRoot, async (filePath, stat) => {
    scannedFiles += 1;
    const base = path.basename(filePath);
    const isTempName = TEMP_NAME_RE.test(base);
    let mtime = Date.now();
    try {
      mtime = (await fs.stat(filePath)).mtimeMs;
    } catch {
      return;
    }

    if (!isTempName && mtime >= cutoff) return;
    if (removedFiles >= maxFiles) return;

    paths.push(filePath);
    if (!dryRun) {
      try {
        resolveUnderStorageRoot(filePath);
        await fs.unlink(filePath);
        removedFiles += 1;
        freedBytes += stat.size;
      } catch {
        // skip locked or unsafe paths
      }
    } else {
      removedFiles += 1;
      freedBytes += stat.size;
    }
  });

  return { scannedFiles, removedFiles, freedBytes, dryRun, paths: paths.slice(0, 20) };
}

export async function scanOrphanFiles(options?: {
  maxCustomers?: number;
}): Promise<OrphanScanResult> {
  const maxCustomers = options?.maxCustomers ?? 50;
  const storageRoot = resolveStorageRoot();
  const productRows = await query<{ id: string; customer_uid: string }>(
    "SELECT id, customer_uid FROM products WHERE customer_uid IS NOT NULL AND customer_uid != ''",
  );
  const known = new Set(productRows.map((row) => `${row.customer_uid}/${row.id}`));

  const orphans: OrphanScanResult["orphans"] = [];
  let scannedCustomers = 0;

  let customerDirs: string[] = [];
  try {
    const entries = await fs.readdir(storageRoot, { withFileTypes: true });
    customerDirs = entries
      .filter((e) => e.isDirectory() && SAFE_SEGMENT_RE.test(e.name))
      .map((e) => e.name)
      .slice(0, maxCustomers);
  } catch {
    return { orphanCount: 0, orphanBytes: 0, orphans: [], scannedCustomers: 0 };
  }

  for (const customerUid of customerDirs) {
    scannedCustomers += 1;
    const productsRoot = path.join(storageRoot, customerUid, "Products");
    let productDirs: string[] = [];
    try {
      const entries = await fs.readdir(productsRoot, { withFileTypes: true });
      productDirs = entries
        .filter((e) => e.isDirectory() && SAFE_SEGMENT_RE.test(e.name))
        .map((e) => e.name);
    } catch {
      continue;
    }

    for (const productUid of productDirs) {
      if (known.has(`${customerUid}/${productUid}`)) continue;
      const folder = path.join(productsRoot, productUid);
      let sizeBytes = 0;
      try {
        const files = await fs.readdir(folder);
        for (const file of files) {
          try {
            const stat = await fs.stat(path.join(folder, file));
            if (stat.isFile()) sizeBytes += stat.size;
          } catch {
            // skip
          }
        }
      } catch {
        continue;
      }
      orphans.push({
        path: folder,
        customerUid,
        productUid,
        sizeBytes,
      });
    }
  }

  const orphanBytes = orphans.reduce((sum, row) => sum + row.sizeBytes, 0);
  return {
    orphanCount: orphans.length,
    orphanBytes,
    orphans: orphans.slice(0, 100),
    scannedCustomers,
  };
}

export async function deleteOrphanFolders(
  orphans: { path: string; sizeBytes?: number }[],
  dryRun = false,
) {
  let deleted = 0;
  let freedBytes = 0;

  for (const orphan of orphans) {
    if (dryRun) {
      deleted += 1;
      freedBytes += orphan.sizeBytes || 0;
      continue;
    }
    try {
      const safePath = resolveUnderStorageRoot(orphan.path);
      const stat = await fs.stat(safePath);
      if (!stat.isDirectory()) continue;

      await fs.rm(safePath, { recursive: true, force: true });
      deleted += 1;
      freedBytes += orphan.sizeBytes || 0;
    } catch {
      // skip unsafe or missing paths
    }
  }

  return { deleted, freedBytes, dryRun };
}
