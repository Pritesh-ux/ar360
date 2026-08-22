import { validateGlbUpload } from "@/lib/products/glb-validator";

/**
 * Authoring tools (KeyShot, Blender, photogrammetry) embed source-resolution
 * textures, so a 7k-triangle chair can ship as a 35 MB GLB with 9600px maps.
 * Decoded, those maps need well over a gigabyte of texture memory and crash
 * mobile browsers, so uploads are downscaled before they reach storage.
 */

const DEFAULT_MAX_TEXTURE_SIZE = 2048;
const DEFAULT_QUALITY = 82;
/** Re-encoding within these margins costs more quality than the bytes it saves. */
const MIN_GAIN_RATIO = 0.05;
const MIN_GAIN_BYTES = 256 * 1024;

export type GlbOptimizeStats = {
  optimized: boolean;
  originalBytes: number;
  optimizedBytes: number;
  largestTextureBefore: number;
  largestTextureAfter: number;
  textureCount: number;
  skippedReason?: string;
};

export type GlbOptimizeResult = {
  buffer: Buffer;
  stats: GlbOptimizeStats;
};

export type GlbOptimizeOptions = {
  maxTextureSize?: number;
  quality?: number;
  /** Optimize even when the model is already small. */
  force?: boolean;
};

function maxTextureSizeSetting(explicit?: number) {
  if (explicit && explicit > 0) return explicit;
  const fromEnv = Number(process.env.AR360_GLB_MAX_TEXTURE_SIZE || 0);
  if (Number.isFinite(fromEnv) && fromEnv >= 256) return Math.min(fromEnv, 8192);
  return DEFAULT_MAX_TEXTURE_SIZE;
}

function readImageSize(data: Uint8Array): { width: number; height: number } | null {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      const isFrameHeader =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrameHeader) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      const segmentLength = buf.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    }
  }

  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const format = buf.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      };
    }
    if (format === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }

  return null;
}

/**
 * Downscales oversized embedded textures. Returns the original buffer whenever
 * optimization is unnecessary, unavailable, or produces a model that no longer
 * validates — an unoptimized upload is always better than a broken one.
 */
export async function optimizeGlbBuffer(
  input: Buffer,
  options: GlbOptimizeOptions = {},
): Promise<GlbOptimizeResult> {
  const maxTextureSize = maxTextureSizeSetting(options.maxTextureSize);
  const quality = options.quality ?? DEFAULT_QUALITY;

  const stats: GlbOptimizeStats = {
    optimized: false,
    originalBytes: input.length,
    optimizedBytes: input.length,
    largestTextureBefore: 0,
    largestTextureAfter: 0,
    textureCount: 0,
  };

  try {
    const [{ NodeIO }, { ALL_EXTENSIONS }, { textureCompress, TextureResizeFilter }, sharpModule] = await Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
      import("sharp"),
    ]);

    const sharp = sharpModule.default;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.readBinary(new Uint8Array(input));

    const textures = document.getRoot().listTextures();
    stats.textureCount = textures.length;

    for (const texture of textures) {
      const image = texture.getImage();
      if (!image) continue;
      const size = readImageSize(image);
      if (size) {
        stats.largestTextureBefore = Math.max(stats.largestTextureBefore, size.width, size.height);
      }
    }

    // Only oversized maps are worth touching; on geometry-heavy models a re-encode
    // loses quality without meaningfully shrinking the file.
    if (stats.largestTextureBefore <= maxTextureSize && !options.force) {
      stats.largestTextureAfter = stats.largestTextureBefore;
      stats.skippedReason = "textures-within-limit";
      return { buffer: input, stats };
    }

    await document.transform(
      textureCompress({
        encoder: sharp,
        resize: [maxTextureSize, maxTextureSize],
        resizeFilter: TextureResizeFilter.LANCZOS3,
        quality,
      }),
    );

    const output = Buffer.from(await io.writeBinary(document));

    stats.largestTextureAfter = 0;
    for (const texture of document.getRoot().listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const size = readImageSize(image);
      if (size) {
        stats.largestTextureAfter = Math.max(stats.largestTextureAfter, size.width, size.height);
      }
    }

    const saved = input.length - output.length;
    if (saved < MIN_GAIN_BYTES || saved / input.length < MIN_GAIN_RATIO) {
      stats.largestTextureAfter = stats.largestTextureBefore;
      stats.skippedReason = "no-meaningful-gain";
      return { buffer: input, stats };
    }

    const check = validateGlbUpload({
      buffer: output,
      fileName: "model.glb",
      mimeType: "model/gltf-binary",
    });

    if (check.ok === false) {
      stats.largestTextureAfter = stats.largestTextureBefore;
      stats.skippedReason = `validation-failed:${check.code}`;
      return { buffer: input, stats };
    }

    stats.optimized = true;
    stats.optimizedBytes = output.length;
    return { buffer: output, stats };
  } catch (error) {
    stats.largestTextureAfter = stats.largestTextureBefore;
    stats.skippedReason = error instanceof Error ? error.message.slice(0, 120) : "unknown-error";
    console.warn("[glb-optimize] skipped:", stats.skippedReason);
    return { buffer: input, stats };
  }
}

export function describeGlbOptimizeStats(stats: GlbOptimizeStats): string {
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(2)}MB`;
  if (!stats.optimized) {
    return `skipped (${stats.skippedReason || "no reason"}), ${mb(stats.originalBytes)}`;
  }
  return [
    `${mb(stats.originalBytes)} → ${mb(stats.optimizedBytes)}`,
    `textures ${stats.textureCount}`,
    `max ${stats.largestTextureBefore}px → ${stats.largestTextureAfter}px`,
  ].join(", ");
}

/** Above this, in-page model-viewer AR (especially iOS Safari) often OOM-crashes. */
export const MOBILE_AR_SAFE_BYTES = 35 * 1024 * 1024;

/** Build a lighter GLB for Scene Viewer / mobile AR (textures + mesh simplify). */
export async function buildArLiteGlb(
  input: Buffer,
  options?: { maxTextureSize?: number; quality?: number; ratio?: number },
): Promise<GlbOptimizeResult> {
  const maxTextureSize = Math.min(1024, options?.maxTextureSize ?? 1024);
  const quality = options?.quality ?? 70;
  const ratio = options?.ratio ?? 0.45;

  const stats: GlbOptimizeStats = {
    optimized: false,
    originalBytes: input.length,
    optimizedBytes: input.length,
    largestTextureBefore: 0,
    largestTextureAfter: 0,
    textureCount: 0,
  };

  try {
    const [
      { NodeIO },
      { ALL_EXTENSIONS },
      {
        textureCompress,
        TextureResizeFilter,
        dedup,
        weld,
        prune,
        simplify,
      },
      sharpModule,
      { MeshoptSimplifier },
    ] = await Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
      import("sharp"),
      import("meshoptimizer"),
    ]);

    await MeshoptSimplifier.ready;

    const sharp = sharpModule.default;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.readBinary(new Uint8Array(input));

    const textures = document.getRoot().listTextures();
    stats.textureCount = textures.length;
    for (const texture of textures) {
      const image = texture.getImage();
      if (!image) continue;
      const size = readImageSize(image);
      if (size) {
        stats.largestTextureBefore = Math.max(
          stats.largestTextureBefore,
          size.width,
          size.height,
        );
      }
    }

    await document.transform(
      dedup(),
      weld(),
      simplify({
        simplifier: MeshoptSimplifier,
        ratio,
        error: 0.001,
      }),
      prune(),
      textureCompress({
        encoder: sharp,
        resize: [maxTextureSize, maxTextureSize],
        resizeFilter: TextureResizeFilter.LANCZOS3,
        quality,
      }),
    );

    const output = Buffer.from(await io.writeBinary(document));

    stats.largestTextureAfter = 0;
    for (const texture of document.getRoot().listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const size = readImageSize(image);
      if (size) {
        stats.largestTextureAfter = Math.max(
          stats.largestTextureAfter,
          size.width,
          size.height,
        );
      }
    }

    const check = validateGlbUpload({
      buffer: output,
      fileName: "model.ar.glb",
      mimeType: "model/gltf-binary",
    });
    if (check.ok === false) {
      stats.skippedReason = `validation-failed:${check.code}`;
      return { buffer: input, stats };
    }

    // Keep lite only when it actually helps (or original was already huge).
    if (
      output.length >= input.length * 0.95 &&
      input.length < MOBILE_AR_SAFE_BYTES
    ) {
      stats.skippedReason = "no-meaningful-gain";
      return { buffer: input, stats };
    }

    stats.optimized = true;
    stats.optimizedBytes = output.length;
    return { buffer: output, stats };
  } catch (error) {
    stats.skippedReason =
      error instanceof Error ? error.message.slice(0, 120) : "unknown-error";
    console.warn("[glb-optimize] AR lite skipped:", stats.skippedReason);
    return { buffer: input, stats };
  }
}

/** Whether a full-quality model is too heavy to launch AR inside the Safari tab. */
export function isTooHeavyForInPageAr(bytes?: number | null) {
  return Number(bytes) > MOBILE_AR_SAFE_BYTES;
}
