/**
 * Apply a uniform root-node scale to a GLB so Scene Viewer / Quick Look
 * (which ignore <model-viewer scale>) still show real-world size.
 * glTF: 1 unit = 1 meter.
 */

type GltfNode = {
  scale?: number[];
  matrix?: number[];
  children?: number[];
  [key: string]: unknown;
};

type GltfJson = {
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: GltfNode[];
  [key: string]: unknown;
};

const GLB_MAGIC = 0x46546c67; // glTF
const CHUNK_JSON = 0x4e4f534a; // JSON
const CHUNK_BIN = 0x004e4942; // BIN\0

function readHeader(view: DataView) {
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  if (magic !== GLB_MAGIC || version !== 2) {
    throw new Error("Not a valid GLB (glTF 2.0) file.");
  }
  return { length };
}

function scaleNode(node: GltfNode, scale: number) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    const m = node.matrix.slice();
    // Column-major: scale basis vectors (columns 0–2).
    for (const col of [0, 1, 2]) {
      m[col] *= scale;
      m[col + 4] *= scale;
      m[col + 8] *= scale;
    }
    node.matrix = m;
    return;
  }

  const existing = Array.isArray(node.scale) && node.scale.length >= 3
    ? node.scale
    : [1, 1, 1];
  node.scale = [
    Number(existing[0] || 1) * scale,
    Number(existing[1] || 1) * scale,
    Number(existing[2] || 1) * scale,
  ];
}

/** Scale only scene root nodes so child transforms do not compound. */
export function applyRootScaleToGltfJson(gltf: GltfJson, scale: number): GltfJson {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) {
    return gltf;
  }

  const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
  const scenes = Array.isArray(gltf.scenes) ? gltf.scenes : [];
  const sceneIndex = Number.isInteger(gltf.scene) ? Number(gltf.scene) : 0;
  const scene = scenes[sceneIndex] || scenes[0];
  const roots = Array.isArray(scene?.nodes) ? scene.nodes : [];

  if (roots.length === 0 && nodes.length > 0) {
    // No scene roots declared — scale every top-level-looking node once.
    for (const node of nodes) scaleNode(node, scale);
    return gltf;
  }

  for (const index of roots) {
    const node = nodes[index];
    if (node) scaleNode(node, scale);
  }

  return gltf;
}

export function scaleGlbBuffer(input: Buffer | Uint8Array, scale: number): Buffer {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("Invalid AR scale.");
  }
  if (Math.abs(scale - 1) < 1e-9) {
    return Buffer.isBuffer(input) ? input : Buffer.from(input);
  }

  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.byteLength < 20) throw new Error("GLB too small.");

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  readHeader(view);

  let offset = 12;
  let jsonChunk: Buffer | null = null;
  let binChunk: Buffer | null = null;
  let binChunkType = CHUNK_BIN;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    const chunkData = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === CHUNK_JSON) {
      jsonChunk = Buffer.from(chunkData);
    } else if (chunkType === CHUNK_BIN) {
      binChunk = Buffer.from(chunkData);
      binChunkType = chunkType;
    }
  }

  if (!jsonChunk) throw new Error("GLB missing JSON chunk.");

  const jsonText = jsonChunk.toString("utf8").replace(/\0+$/, "");
  const gltf = JSON.parse(jsonText) as GltfJson;
  applyRootScaleToGltfJson(gltf, scale);

  const nextJson = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPadding = (4 - (nextJson.byteLength % 4)) % 4;
  const jsonPaddedLen = nextJson.byteLength + jsonPadding;
  const jsonChunkTotal = 8 + jsonPaddedLen;

  const binLen = binChunk ? binChunk.byteLength : 0;
  const binPadding = binChunk ? (4 - (binLen % 4)) % 4 : 0;
  const binPaddedLen = binChunk ? binLen + binPadding : 0;
  const binChunkTotal = binChunk ? 8 + binPaddedLen : 0;

  const totalLength = 12 + jsonChunkTotal + binChunkTotal;
  const out = Buffer.alloc(totalLength);

  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);

  let w = 12;
  out.writeUInt32LE(jsonPaddedLen, w);
  out.writeUInt32LE(CHUNK_JSON, w + 4);
  nextJson.copy(out, w + 8);
  // pad JSON with spaces (glTF spec)
  out.fill(0x20, w + 8 + nextJson.byteLength, w + 8 + jsonPaddedLen);
  w += jsonChunkTotal;

  if (binChunk) {
    out.writeUInt32LE(binPaddedLen, w);
    out.writeUInt32LE(binChunkType, w + 4);
    binChunk.copy(out, w + 8);
    out.fill(0, w + 8 + binLen, w + 8 + binPaddedLen);
  }

  return out;
}

export function parseArScaleParam(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
  return n;
}

/** Append or replace arScale on a same-origin asset URL. */
export function withArScaleQuery(url: string, scale: number): string {
  if (!url || !Number.isFinite(scale) || scale <= 0) return url;
  if (Math.abs(scale - 1) < 1e-9) return url;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://local.invalid";
    const parsed = new URL(url, base);
    parsed.searchParams.set("arScale", String(Number(scale.toPrecision(6))));
    // Prefer path+search for relative proxy URLs.
    if (url.startsWith("/") || !/^https?:\/\//i.test(url)) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}arScale=${encodeURIComponent(String(scale))}`;
  }
}
