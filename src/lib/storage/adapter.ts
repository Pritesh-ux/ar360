import fs from "fs/promises";
import path from "path";
import {
  getSecureProductFolder,
  getSecureProductPath,
  getPublicFileUrl,
} from "@/lib/storage";
import { resolveStorageRoot } from "@/lib/storage/paths";
import { toCdnAssetUrl } from "@/lib/billing/asset-url";

export type StorageBackend = "local" | "s3";

export interface StorageWriteInput {
  customerUid: string;
  productUid: string;
  fileName: string;
  data: Buffer;
}

export interface StorageAdapter {
  readonly backend: StorageBackend;
  write(input: StorageWriteInput): Promise<string>;
  deleteProductFolder(customerUid: string, productUid: string): Promise<void>;
}

function resolveBackend(): StorageBackend {
  const raw = String(process.env.STORAGE_BACKEND || "local").toLowerCase();
  return raw === "s3" ? "s3" : "local";
}

class LocalStorageAdapter implements StorageAdapter {
  readonly backend = "local" as const;

  async write(input: StorageWriteInput): Promise<string> {
    const diskPath = getSecureProductPath(input.customerUid, input.productUid, input.fileName);
    await fs.mkdir(path.dirname(diskPath), { recursive: true });
    await fs.writeFile(diskPath, input.data);
    return toCdnAssetUrl(getPublicFileUrl(input.customerUid, input.productUid, input.fileName));
  }

  async deleteProductFolder(customerUid: string, productUid: string): Promise<void> {
    const folderPath = getSecureProductFolder(customerUid, productUid);
    try {
      await fs.rm(folderPath, { recursive: true, force: true });
    } catch {
      // Folder already gone.
    }
  }
}

let cachedAdapter: StorageAdapter | null = null;

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (cachedAdapter) return cachedAdapter;

  const backend = resolveBackend();
  if (backend === "s3") {
    const { createS3StorageAdapter } = await import("@/lib/storage/adapter-s3");
    cachedAdapter = await createS3StorageAdapter();
  } else {
    cachedAdapter = new LocalStorageAdapter();
  }

  return cachedAdapter;
}

/** Ensures the active local storage root exists (no-op for S3). */
export async function ensureActiveStorageRoot(): Promise<string | null> {
  const adapter = await getStorageAdapter();
  if (adapter.backend === "s3") return null;
  const root = resolveStorageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}
