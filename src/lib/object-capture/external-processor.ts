import { readdir, readFile } from "fs/promises";
import path from "path";
import { getJobPaths } from "@/lib/object-capture/workspace";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";

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

  const safe = await assertSafeOutboundUrl(glbUrl);
  if (safe.ok === false) {
    throw new Error(`Unsafe processor glbUrl: ${safe.error}`);
  }

  // Prefer same-host as OC_PROCESSOR_URL when configured (extra host lock).
  const allowedHosts = new Set<string>();
  try {
    if (processorUrl) allowedHosts.add(new URL(processorUrl).hostname.toLowerCase());
  } catch {
    // ignore
  }
  for (const host of String(process.env.OC_PROCESSOR_GLB_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)) {
    allowedHosts.add(host);
  }
  if (allowedHosts.size > 0) {
    const glbHost = new URL(safe.href).hostname.toLowerCase();
    if (!allowedHosts.has(glbHost)) {
      throw new Error(`Processor glbUrl host not allowlisted: ${glbHost}`);
    }
  }

  const glbRes = await fetch(safe.href, {
    signal: AbortSignal.timeout(60_000),
    redirect: "error",
  });
  if (!glbRes.ok) throw new Error(`Failed to download GLB from processor (${glbRes.status})`);

  const buffer = Buffer.from(await glbRes.arrayBuffer());
  if (buffer.byteLength < 12 || buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("Processor glbUrl did not return a valid GLB");
  }
  return { buffer, source: "external" };
}
