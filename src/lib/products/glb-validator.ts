import { ProductErrorCode, friendlyProductError } from "@/lib/products/product-errors";
import { MAX_FILE_SIZES } from "@/lib/storage";

const GLB_MAGIC = "glTF";
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const ALLOWED_MIME_TYPES = new Set([
  "model/gltf-binary",
  "application/octet-stream",
  "application/gltf-buffer",
  "",
]);

type GltfJson = {
  asset?: { version?: string };
  scenes?: number[];
  scene?: number;
  nodes?: Array<{ mesh?: number; children?: number[] }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number>; indices?: number; mode?: number }> }>;
  accessors?: Array<{
    bufferView?: number;
    componentType?: number;
    count?: number;
    type?: string;
    min?: number[];
    max?: number[];
  }>;
  bufferViews?: Array<{ buffer?: number; byteOffset?: number; byteLength?: number }>;
  buffers?: Array<{ byteLength?: number; uri?: string }>;
  images?: Array<{ bufferView?: number; uri?: string; mimeType?: string }>;
  textures?: Array<{ source?: number }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
};

export type GlbValidationSuccess = {
  ok: true;
  meshCount: number;
  textureCount: number;
  maxDimension: number;
  hasDraco: boolean;
};

export type GlbValidationFailure = {
  ok: false;
  code: typeof ProductErrorCode.INVALID_GLB | typeof ProductErrorCode.MODEL_CORRUPTED | typeof ProductErrorCode.TEXTURE_MISSING;
  message: string;
};

export type GlbValidationResult = GlbValidationSuccess | GlbValidationFailure;

function parseGlbChunks(buffer: Buffer): { json: GltfJson; bin: Buffer | null } | null {
  if (buffer.length < 12) return null;

  const magic = buffer.toString("ascii", 0, 4);
  if (magic !== GLB_MAGIC) return null;

  const version = buffer.readUInt32LE(4);
  if (version !== 2) return null;

  const totalLength = buffer.readUInt32LE(8);
  if (totalLength > buffer.length || totalLength < 20) return null;

  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Buffer | null = null;

  while (offset + 8 <= totalLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (chunkLength < 0 || offset + chunkLength > buffer.length) return null;

    const chunkData = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === JSON_CHUNK) {
      try {
        const text = chunkData.toString("utf8").replace(/\0+$/, "").trim();
        json = JSON.parse(text) as GltfJson;
      } catch {
        return null;
      }
    } else if (chunkType === BIN_CHUNK) {
      bin = Buffer.from(chunkData);
    }
  }

  if (!json) return null;
  return { json, bin };
}

function hasRenderableMesh(json: GltfJson) {
  const meshes = json.meshes || [];
  if (!meshes.length) return false;

  return meshes.some((mesh) =>
    (mesh.primitives || []).some((primitive) => {
      const attrs = primitive.attributes || {};
      return typeof attrs.POSITION === "number" || typeof primitive.indices === "number";
    }),
  );
}

function sceneExists(json: GltfJson) {
  if (Array.isArray(json.scenes) && json.scenes.length > 0) return true;
  if (typeof json.scene === "number") return true;
  if (Array.isArray(json.nodes) && json.nodes.length > 0) return true;
  return false;
}

function computeMaxDimension(json: GltfJson): number {
  let maxDim = 0;
  for (const accessor of json.accessors || []) {
    if (!accessor.max || !accessor.min) continue;
    for (let i = 0; i < Math.min(accessor.max.length, accessor.min.length); i++) {
      const span = Math.abs(Number(accessor.max[i] || 0) - Number(accessor.min[i] || 0));
      if (Number.isFinite(span)) maxDim = Math.max(maxDim, span);
    }
  }
  return maxDim;
}

function validateTextureReferences(json: GltfJson, bin: Buffer | null): string | null {
  const images = json.images || [];
  const bufferViews = json.bufferViews || [];
  const buffers = json.buffers || [];

  for (const image of images) {
    if (image.uri) {
      if (image.uri.startsWith("data:")) continue;
      return "External texture files are not supported. Embed textures inside the GLB.";
    }
    if (typeof image.bufferView !== "number") {
      return "A texture image is missing its data reference.";
    }
    const view = bufferViews[image.bufferView];
    if (!view) return "A texture references a missing buffer view.";
    if (typeof view.buffer !== "number" || !buffers[view.buffer]) {
      return "A texture references a missing buffer.";
    }
    const buffer = buffers[view.buffer];
    if (buffer.uri) {
      return "External buffer files are not supported. Use a self-contained GLB.";
    }
    const byteOffset = view.byteOffset || 0;
    const byteLength = view.byteLength || 0;
    if (!bin || byteOffset + byteLength > bin.length) {
      return "Embedded texture data is missing or truncated.";
    }
  }

  for (const texture of json.textures || []) {
    if (typeof texture.source === "number" && !images[texture.source]) {
      return "A material texture points to a missing image.";
    }
  }

  return null;
}

function validateUnsupportedCompression(json: GltfJson): string | null {
  const required = json.extensionsRequired || [];
  const blocked = required.filter(
    (ext) => ext !== "KHR_draco_mesh_compression" && !ext.startsWith("KHR_"),
  );
  if (blocked.length) {
    return `Unsupported model extension: ${blocked[0]}. Re-export without proprietary extensions.`;
  }
  return null;
}

export function validateGlbUpload(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number;
}): GlbValidationResult {
  const ext = input.fileName.toLowerCase().endsWith(".glb");
  if (!ext) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, "Only .glb files are accepted."),
    };
  }

  const mime = String(input.mimeType || "").toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, "Unexpected file type for a GLB model."),
    };
  }

  const size = input.sizeBytes ?? input.buffer.length;
  const maxSize = MAX_FILE_SIZES[".glb"];
  if (size <= 0 || size > maxSize) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(
        ProductErrorCode.INVALID_GLB,
        size <= 0 ? "The uploaded file is empty." : "GLB file exceeds the maximum allowed size.",
      ),
    };
  }

  const parsed = parseGlbChunks(input.buffer);
  if (!parsed) {
    return {
      ok: false,
      code: ProductErrorCode.MODEL_CORRUPTED,
      message: friendlyProductError(ProductErrorCode.MODEL_CORRUPTED),
    };
  }

  const { json, bin } = parsed;

  if (json.asset?.version && !String(json.asset.version).startsWith("2")) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, "Only glTF 2.0 models are supported."),
    };
  }

  if (!sceneExists(json)) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, "The model has no scene to display."),
    };
  }

  if (!hasRenderableMesh(json)) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, "The model contains no renderable mesh."),
    };
  }

  const textureError = validateTextureReferences(json, bin);
  if (textureError) {
    return {
      ok: false,
      code: ProductErrorCode.TEXTURE_MISSING,
      message: friendlyProductError(ProductErrorCode.TEXTURE_MISSING, textureError),
    };
  }

  const compressionError = validateUnsupportedCompression(json);
  if (compressionError) {
    return {
      ok: false,
      code: ProductErrorCode.INVALID_GLB,
      message: friendlyProductError(ProductErrorCode.INVALID_GLB, compressionError),
    };
  }

  // Scale checks removed — customers may upload models at any authored size.
  const maxDimension = computeMaxDimension(json);

  const extensions = json.extensionsUsed || [];
  const hasDraco = extensions.includes("KHR_draco_mesh_compression");

  return {
    ok: true,
    meshCount: json.meshes?.length || 0,
    textureCount: json.textures?.length || 0,
    maxDimension,
    hasDraco,
  };
}
