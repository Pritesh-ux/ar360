import { BufferAttribute, CanvasTexture, SRGBColorSpace } from "three";

/** Preserve GLTFLoader texture bindings when AR360 inspector overrides maps. */

export type TextureBinding = {
  texCoord: number;
  offset: [number, number] | null;
  rotation: number | null;
  scale: [number, number] | null;
};

export function materialDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = window.location.search;
    return q.includes("matdebug=1") || window.localStorage.getItem("ar360MatDebug") === "1";
  } catch {
    return false;
  }
}

export function captureTextureBinding(textureInfo: any): TextureBinding | null {
  if (!textureInfo) return null;
  let texCoord = 0;
  try {
    texCoord = Number(
      typeof textureInfo.getTexCoord === "function"
        ? textureInfo.getTexCoord()
        : textureInfo.texCoord ?? 0,
    );
  } catch {
    texCoord = Number(textureInfo.texCoord || 0);
  }
  if (!Number.isFinite(texCoord)) texCoord = 0;

  const readVec2 = (getter: string, prop: string): [number, number] | null => {
    try {
      const value =
        typeof textureInfo[getter] === "function" ? textureInfo[getter]() : textureInfo[prop];
      if (Array.isArray(value) && value.length >= 2) {
        return [Number(value[0]) || 0, Number(value[1]) || 0];
      }
      if (value && typeof value === "object" && "x" in value) {
        return [Number(value.x) || 0, Number(value.y) || 0];
      }
    } catch {
      // Optional KHR_texture_transform
    }
    return null;
  };

  let rotation: number | null = null;
  try {
    const raw =
      typeof textureInfo.getRotation === "function"
        ? textureInfo.getRotation()
        : textureInfo.rotation;
    if (raw != null && Number.isFinite(Number(raw))) rotation = Number(raw);
  } catch {
    rotation = null;
  }

  return {
    texCoord,
    offset: readVec2("getOffset", "offset"),
    rotation,
    scale: readVec2("getScale", "scale"),
  };
}

export function restoreTextureBinding(textureInfo: any, binding: TextureBinding | null) {
  if (!textureInfo || !binding) return;
  try {
    if (typeof textureInfo.setTexCoord === "function") {
      textureInfo.setTexCoord(binding.texCoord);
    } else {
      textureInfo.texCoord = binding.texCoord;
    }
  } catch {
    // Optional
  }
  try {
    if (binding.offset && typeof textureInfo.setOffset === "function") {
      textureInfo.setOffset(binding.offset);
    }
  } catch {
    // Optional
  }
  try {
    if (binding.rotation != null && typeof textureInfo.setRotation === "function") {
      textureInfo.setRotation(binding.rotation);
    }
  } catch {
    // Optional
  }
  try {
    if (binding.scale && typeof textureInfo.setScale === "function") {
      textureInfo.setScale(binding.scale);
    }
  } catch {
    // Optional
  }
}

export function applyUvChannelToThreeTexture(threeTex: any, texCoord: number) {
  if (!threeTex || typeof threeTex !== "object") return;
  if ("channel" in threeTex) threeTex.channel = texCoord;
  threeTex.needsUpdate = true;
}

export function isInspectorUploadedTextureUrl(uri?: string | null): boolean {
  const raw = String(uri || "").trim().replace(/\\/g, "/");
  if (!raw) return false;
  if (raw.startsWith("data:")) return true;
  if (raw.startsWith("/api/assets/")) return true;
  if (raw.includes("/Storage/Customers/")) return true;
  if (raw.startsWith("blob:")) return false;
  return /^https?:\/\//i.test(raw);
}

export function uvDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.location.search.includes("uvdebug=1");
  } catch {
    return false;
  }
}

function getUvDebugTexture() {
  if (typeof document === "undefined") return null;
  const w = window as typeof window & { __ar360UvDebugTex?: any };
  if (w.__ar360UvDebugTex?.isTexture) return w.__ar360UvDebugTex;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      img.data[i] = Math.round((x / (size - 1)) * 255);
      img.data[i + 1] = Math.round((1 - y / (size - 1)) * 255);
      img.data[i + 2] = 40;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  const cells = 8;
  for (let i = 0; i <= cells; i += 1) {
    const p = (i / cells) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.fillStyle = "#fff";
  ctx.font = "28px sans-serif";
  ctx.fillText("U →", size - 90, 36);
  ctx.fillText("V ↑", 12, 36);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  tex.flipY = true;
  w.__ar360UvDebugTex = tex;
  return tex;
}

function meshMaterials(node: any): any[] {
  if (Array.isArray(node?.material)) return node.material;
  return node?.material ? [node.material] : [];
}

/** Temporary UV checker. Does not persist. Restore when uvdebug is off. */
export function applyUvDebugOverlay(roots: any[]) {
  const enabled = uvDebugEnabled();
  const debugTex = enabled ? getUvDebugTexture() : null;

  const visit = (node: any) => {
    if (!node?.isMesh && !node?.isSkinnedMesh) return;
    for (const material of meshMaterials(node)) {
      if (!material || typeof material !== "object") continue;
      const prev = material.userData?.ar360UvDebugPrev;
      if (!enabled) {
        if (prev) {
          material.map = prev;
          material.needsUpdate = true;
          if (material.userData) delete material.userData.ar360UvDebugPrev;
        }
        continue;
      }
      if (!debugTex) continue;
      const name = String(material.name || node.name || "");
      const hasMap = Boolean(material.map);
      const isLogoSlot = /usf|logo|chrof/i.test(name) || hasMap;
      if (!isLogoSlot) continue;
      if (!material.userData) material.userData = {};
      if (!material.userData.ar360UvDebugPrev && material.map && material.map !== debugTex) {
        material.userData.ar360UvDebugPrev = material.map;
      }
      if (material.map !== debugTex) {
        material.map = debugTex;
        material.needsUpdate = true;
      }
    }
  };

  for (const root of roots) root?.traverse?.(visit);
}

export function uvExtent(attr: any): { count: number; minU: number; maxU: number; minV: number; maxV: number; sample: number[] } | null {
  if (!attr?.count || !attr.array) return null;
  const arr = attr.array as ArrayLike<number>;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  const sample: number[] = [];
  const sampleLimit = uvDebugEnabled() ? 60 : 20;
  for (let i = 0; i < attr.count; i += 1) {
    const u = Number(arr[i * 2]);
    const v = Number(arr[i * 2 + 1]);
    if (i < sampleLimit / 2) sample.push(u, v);
    if (Number.isFinite(u)) {
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
    }
    if (Number.isFinite(v)) {
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
  }
  return { count: attr.count, minU, maxU, minV, maxV, sample };
}

function uvLooksCorrupt(attr: any, posCount: number): boolean {
  if (!attr || Number(attr.count) !== Number(posCount)) return true;
  const ext = uvExtent(attr);
  if (!ext) return true;
  if (![ext.minU, ext.maxU, ext.minV, ext.maxV].every((n) => Number.isFinite(n))) return true;
  if (Math.abs(ext.minU) > 8 || Math.abs(ext.maxU) > 8 || Math.abs(ext.minV) > 8 || Math.abs(ext.maxV) > 8) {
    return true;
  }
  return false;
}

/**
 * Fit one planar UV to a flat primitive (Material ID plate). Uses position.getX/Y/Z
 * so interleaved GLTF buffers don't produce shard UVs.
 */
export function ensureAabbPlanarUv(geometry: any, force = false) {
  const pos = geometry?.attributes?.position;
  if (!pos || typeof pos.getX !== "function") return;
  const count = Number(pos.count || 0);
  if (count < 3) return;

  try {
    geometry.computeBoundingBox?.();
  } catch {
    return;
  }
  const min = geometry.boundingBox?.min;
  const max = geometry.boundingBox?.max;
  if (!min || !max) return;

  const dx = Math.abs(max.x - min.x);
  const dy = Math.abs(max.y - min.y);
  const dz = Math.abs(max.z - min.z);
  const maxD = Math.max(dx, dy, dz, 1e-6);
  const minD = Math.min(dx, dy, dz);
  const isFlat = minD / maxD < 0.45;
  const generated = Boolean(geometry.userData?.ar360GeneratedUv);
  const existing = geometry.attributes.uv;

  if (!isFlat) {
    if (generated) {
      geometry.deleteAttribute?.("uv");
      if (geometry.userData) geometry.userData.ar360GeneratedUv = false;
    }
    if (!force) return;
  }

  if (existing && !generated && !uvLooksCorrupt(existing, count)) return;

  let uMin = min.x;
  let vMin = min.y;
  let uSize = Math.max(1e-6, dx);
  let vSize = Math.max(1e-6, dy);
  let readU: (i: number) => number = (i) => pos.getX(i);
  let readV: (i: number) => number = (i) => pos.getY(i);
  if (dx <= dy && dx <= dz) {
    uMin = min.y;
    vMin = min.z;
    uSize = Math.max(1e-6, dy);
    vSize = Math.max(1e-6, dz);
    readU = (i) => pos.getY(i);
    readV = (i) => pos.getZ(i);
  } else if (dy <= dx && dy <= dz) {
    uMin = min.x;
    vMin = min.z;
    uSize = Math.max(1e-6, dx);
    vSize = Math.max(1e-6, dz);
    readU = (i) => pos.getX(i);
    readV = (i) => pos.getZ(i);
  }

  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    uv[i * 2] = (readU(i) - uMin) / uSize;
    uv[i * 2 + 1] = 1 - (readV(i) - vMin) / vSize;
  }

  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.userData = geometry.userData || {};
  geometry.userData.ar360GeneratedUv = true;
  geometry.attributes.uv.needsUpdate = true;
}

export function debugGLTFMaterials(roots: any[], label = "AR360 GLB MATERIALS") {
  const rows: Array<Record<string, string | number | boolean>> = [];
  const usfHits: Array<Record<string, unknown>> = [];

  const visit = (node: any) => {
    if (!node?.isMesh && !node?.isSkinnedMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [];
    const groups = (node.geometry?.groups || []).map((g: any) => ({
      start: g.start,
      count: g.count,
      materialIndex: g.materialIndex,
    }));
    const uv0 = uvExtent(node.geometry?.attributes?.uv);
    const uv1 = uvExtent(node.geometry?.attributes?.uv1 || node.geometry?.attributes?.uv2);

    materials.forEach((material: any, index: number) => {
      const map = material?.map;
      const image = map?.image;
      const name = String(material?.name || "");
      const blobHint = String(image?.src || image?.currentSrc || map?.name || name);
      const isUsf = /usf|logo/i.test(`${name} ${node.name || ""} ${blobHint}`);
      const uvValid =
        uv0 &&
        Number.isFinite(uv0.minU) &&
        (uv0.maxU !== uv0.minU || uv0.maxV !== uv0.minV) &&
        !(uv0.minU === 0 && uv0.maxU === 0 && uv0.minV === 0 && uv0.maxV === 0);

      rows.push({
        OBJECT: String(node.name || "(unnamed)"),
        MAT_LEN: materials.length,
        MAT_INDEX: index,
        MATERIAL: name || `(index ${index})`,
        UUID: String(material?.uuid || "").slice(0, 8),
        TYPE: String(material?.type || ""),
        MAP: map ? "Texture" : "null",
        IMAGE: image ? (image.complete === false ? "loading" : "loaded") : "none",
        WIDTH: Number(image?.naturalWidth || image?.width || 0),
        HEIGHT: Number(image?.naturalHeight || image?.height || 0),
        CHANNEL: Number(map?.channel ?? 0),
        REPEAT: map?.repeat ? `${map.repeat.x},${map.repeat.y}` : "",
        UV0: uv0
          ? `${uv0.count} [${uv0.minU.toFixed(3)}..${uv0.maxU.toFixed(3)}] sample=${uv0.sample
              .slice(0, 8)
              .map((n) => n.toFixed(2))
              .join(",")}`
          : "NO TEXCOORD_0",
        UV1: uv1 ? `${uv1.count}` : "NO",
        GROUPS: groups.length
          ? groups.map((g: any) => `${g.start}:${g.count}:mat${g.materialIndex}`).join("|")
          : "none (one material per primitive)",
        VISIBLE: Boolean(map && image && uvValid) ? "YES" : "FAILED",
      });

      if (isUsf) {
        usfHits.push({
          mesh: node.name,
          material: name,
          materialIndex: index,
          uuid: material?.uuid,
          map: Boolean(map),
          mapImage: blobHint.slice(-80),
          imageComplete: image?.complete,
          naturalWidth: image?.naturalWidth,
          uv0,
          uv1,
          groups,
          nativeEqualsInspector: null,
        });
      }
    });
  };

  for (const root of roots) {
    root?.traverse?.(visit);
  }

  console.log(label);
  if (rows.length) console.table(rows);
  if (usfHits.length) {
    console.log("USF MATERIAL FOUND", usfHits);
  } else {
    console.warn("USF MATERIAL NOT FOUND in rendered scene");
  }
}
