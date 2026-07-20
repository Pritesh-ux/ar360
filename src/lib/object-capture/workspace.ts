import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

function safeSegment(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid Object Capture identifier.");
  return value;
}

export function getObjectCaptureStorageRoot(): string {
  const configured = process.env.OBJECT_CAPTURE_STORAGE_ROOT?.trim();
  const root = path.resolve(configured || path.join(process.cwd(), "storage", "private", "object-capture"));
  const publicRoot = path.resolve(process.env.AR360_PROJECT_ROOT || process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("OBJECT_CAPTURE_STORAGE_ROOT must be private and cannot be inside public/.");
  }
  return root;
}

export function getJobPaths(customerUid: string, jobId: string) {
  const customer = safeSegment(customerUid);
  const job = safeSegment(jobId);
  const base = path.join(getObjectCaptureStorageRoot(), customer, job);
  return {
    base,
    original: path.join(base, "original"),
    processed: path.join(base, "processed"),
    textures: path.join(base, "textures"),
    output: path.join(base, "output"),
    logs: path.join(base, "logs"),
  };
}

export async function ensureJobFolders(customerUid: string, jobId: string) {
  const paths = getJobPaths(customerUid, jobId);
  await Promise.all(
    [paths.original, paths.processed, paths.textures, paths.output, paths.logs].map((dir) =>
      mkdir(dir, { recursive: true }),
    ),
  );
  return paths;
}

export function createStorageKey(jobId: string, area: "original" | "output", fileName: string) {
  return `${safeSegment(jobId)}/${area}/${path.basename(fileName)}`;
}

export function resolveStorageKey(customerUid: string, storageKey: string): string {
  const root = path.resolve(getObjectCaptureStorageRoot(), safeSegment(customerUid));
  const resolved = path.resolve(root, storageKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid Object Capture storage key.");
  }
  return resolved;
}

export async function readPrivateAsset(customerUid: string, storageKey: string) {
  return readFile(resolveStorageKey(customerUid, storageKey));
}

export async function writeProcessingLog(customerUid: string, jobId: string, message: string) {
  const paths = await ensureJobFolders(customerUid, jobId);
  const logPath = path.join(paths.logs, "processing.log");
  let previous = "";
  try {
    previous = await readFile(logPath, "utf8");
  } catch {}
  await writeFile(logPath, `${previous}[${new Date().toISOString()}] ${message}\n`, "utf8");
}
