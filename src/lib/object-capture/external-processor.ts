import { readdir, readFile } from "fs/promises";
import path from "path";
import { getJobPaths } from "@/lib/object-capture/workspace";

export type ExternalProcessorResult = {
  buffer: Buffer;
  source: "external";
};

/**
 * Optional photogrammetry hook. POST job metadata + image paths to OC_PROCESSOR_URL.
 * Expects GLB bytes (model/gltf-binary) or JSON { glbUrl }.
 */
export async function runExternalProcessor(
  customerUid: string,
  jobId: string,
): Promise<ExternalProcessorResult | null> {
  const processorUrl = process.env.OC_PROCESSOR_URL?.trim();
  if (!processorUrl) return null;

  const paths = getJobPaths(customerUid, jobId);
  const secret = process.env.OC_PROCESSOR_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

  let imageFiles: string[] = [];
  try {
    const names = await readdir(paths.original);
    imageFiles = names
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .map((name) => path.join(paths.original, name));
  } catch {
    imageFiles = [];
  }

  const images = await Promise.all(
    imageFiles.slice(0, 32).map(async (filePath) => ({
      name: path.basename(filePath),
      base64: (await readFile(filePath)).toString("base64"),
    })),
  );

  const response = await fetch(processorUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "model/gltf-binary, application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      jobId,
      format: "glb",
      callbackUrl: appUrl ? `${appUrl.replace(/\/$/, "")}/api/object-capture/jobs/${jobId}` : undefined,
      images,
    }),
    signal: AbortSignal.timeout(Number(process.env.OC_PROCESSOR_TIMEOUT_MS || 120_000)),
  });

  if (!response.ok) {
    throw new Error(`External processor HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (
    contentType.includes("model/gltf-binary") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/gltf-buffer")
  ) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 12) throw new Error("External processor returned empty GLB");
    return { buffer, source: "external" };
  }

  const payload = (await response.json()) as { glbUrl?: string; modelUrl?: string };
  const glbUrl = payload.glbUrl || payload.modelUrl;
  if (!glbUrl) throw new Error("External processor JSON missing glbUrl");

  const glbRes = await fetch(glbUrl, { signal: AbortSignal.timeout(60_000) });
  if (!glbRes.ok) throw new Error(`Failed to download GLB from processor (${glbRes.status})`);

  const buffer = Buffer.from(await glbRes.arrayBuffer());
  return { buffer, source: "external" };
}
