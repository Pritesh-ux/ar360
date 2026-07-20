import fs from "fs/promises";
import path from "path";
import { query } from "@/lib/db";
import { ALLOWED_EXTENSIONS } from "@/lib/storage";
import { resolveStorageRoot } from "@/lib/storage/paths";

const SAFE_SEGMENT_RE = /^[A-Za-z0-9_-]{1,180}$/;

export type FileTypeBucket = "models" | "images" | "textures" | "videos" | "other";

export type PlatformFileRecord = {
  fileName: string;
  customerUid: string;
  productUid: string;
  sizeBytes: number;
  fileType: FileTypeBucket;
  modifiedAt: string;
};

export type PlatformStorageAudit = {
  fileTypes: { key: FileTypeBucket; label: string; bytes: number }[];
  largestFiles: PlatformFileRecord[];
  scannedCustomers: number;
  scannedFiles: number;
};

function classifyFileType(fileName: string): FileTypeBucket {
  const ext = path.extname(fileName).toLowerCase();
  const lower = fileName.toLowerCase();
  if (ext === ".glb" || ext === ".gltf" || ext === ".usdz") return "models";
  if ([".mp4", ".webm", ".mov"].includes(ext)) return "videos";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    if (lower.includes("texture") || lower.includes("normal") || lower.includes("roughness")) {
      return "textures";
    }
    return "images";
  }
  return "other";
}

const FILE_TYPE_LABELS: Record<FileTypeBucket, string> = {
  models: "3D Models (glb/gltf)",
  images: "Images",
  textures: "Textures",
  videos: "Videos",
  other: "Others",
};

/**
 * Bounded platform storage scan for admin analytics.
 * Returns aggregate file-type totals and the largest files found.
 */
export async function scanPlatformStorage(options?: {
  maxCustomers?: number;
  maxLargestFiles?: number;
}): Promise<PlatformStorageAudit> {
  const maxCustomers = options?.maxCustomers ?? 100;
  const maxLargestFiles = options?.maxLargestFiles ?? 10;

  const storageRoot = resolveStorageRoot();
  const typeBytes: Record<FileTypeBucket, number> = {
    models: 0,
    images: 0,
    textures: 0,
    videos: 0,
    other: 0,
  };

  const largest: PlatformFileRecord[] = [];
  let scannedCustomers = 0;
  let scannedFiles = 0;

  let customerDirs: string[] = [];
  try {
    const entries = await fs.readdir(storageRoot, { withFileTypes: true });
    customerDirs = entries
      .filter((e) => e.isDirectory() && SAFE_SEGMENT_RE.test(e.name))
      .map((e) => e.name)
      .slice(0, maxCustomers);
  } catch {
    return {
      fileTypes: Object.entries(FILE_TYPE_LABELS).map(([key, label]) => ({
        key: key as FileTypeBucket,
        label,
        bytes: 0,
      })),
      largestFiles: [],
      scannedCustomers: 0,
      scannedFiles: 0,
    };
  }

  for (const customerUid of customerDirs) {
    scannedCustomers += 1;
    const productsRoot = path.join(storageRoot, customerUid, "Products");
    let productDirs: string[] = [];
    try {
      const entries = await fs.readdir(productsRoot, { withFileTypes: true });
      productDirs = entries.filter((e) => e.isDirectory() && SAFE_SEGMENT_RE.test(e.name)).map((e) => e.name);
    } catch {
      continue;
    }

    for (const productUid of productDirs) {
      const productFolder = path.join(productsRoot, productUid);
      let files: string[] = [];
      try {
        const entries = await fs.readdir(productFolder, { withFileTypes: true });
        files = entries.filter((e) => e.isFile()).map((e) => e.name);
      } catch {
        continue;
      }

      for (const fileName of files) {
        const ext = path.extname(fileName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext) && ![".mp4", ".webm", ".mov"].includes(ext)) continue;

        try {
          const stat = await fs.stat(path.join(productFolder, fileName));
          const fileType = classifyFileType(fileName);
          typeBytes[fileType] += stat.size;
          scannedFiles += 1;

          const record: PlatformFileRecord = {
            fileName,
            customerUid,
            productUid,
            sizeBytes: stat.size,
            fileType,
            modifiedAt: stat.mtime.toISOString(),
          };

          if (largest.length < maxLargestFiles) {
            largest.push(record);
            largest.sort((a, b) => b.sizeBytes - a.sizeBytes);
          } else if (stat.size > largest[largest.length - 1].sizeBytes) {
            largest[largest.length - 1] = record;
            largest.sort((a, b) => b.sizeBytes - a.sizeBytes);
          }
        } catch {
          // skip unreadable file
        }
      }
    }
  }

  return {
    fileTypes: (Object.keys(FILE_TYPE_LABELS) as FileTypeBucket[]).map((key) => ({
      key,
      label: FILE_TYPE_LABELS[key],
      bytes: typeBytes[key],
    })),
    largestFiles: largest,
    scannedCustomers,
    scannedFiles,
  };
}

export async function enrichLargestFiles(
  files: PlatformFileRecord[],
): Promise<
  (PlatformFileRecord & {
    customerName: string;
    productTitle: string;
  })[]
> {
  if (files.length === 0) return [];

  const customerUids = [...new Set(files.map((f) => f.customerUid))];
  const productUids = [...new Set(files.map((f) => f.productUid))];

  const customerPlaceholders = customerUids.map(() => "?").join(",");
  const productPlaceholders = productUids.map(() => "?").join(",");

  const [customers, products] = await Promise.all([
    query<{ customer_uid: string; contact_name: string }>(
      `SELECT customer_uid, contact_name FROM customers WHERE customer_uid IN (${customerPlaceholders})`,
      customerUids,
    ).catch(() => []),
    query<{ id: string; title: string }>(
      `SELECT id, title FROM products WHERE id IN (${productPlaceholders})`,
      productUids,
    ).catch(() => []),
  ]);

  const customerMap = Object.fromEntries(customers.map((c) => [c.customer_uid, c.contact_name]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.title]));

  return files.map((file) => ({
    ...file,
    customerName: customerMap[file.customerUid] || "Unknown",
    productTitle: productMap[file.productUid] || file.productUid,
  }));
}
