import { ClampToEdgeWrapping, RepeatWrapping } from "three";

export type TextureFitMode = "original" | "square" | "fit";

export type TextureTransform = {
  /** Tile / zoom. 1 = default. */
  scale?: number;
  /** Degrees. */
  rotation?: number;
  /**
   * square = stretch to UV (default).
   * original = keep image aspect and tile.
   * fit = contain the whole image in UV (letterbox).
   */
  fit?: TextureFitMode;
};

export const DEFAULT_TEXTURE_TRANSFORM: Required<TextureTransform> = {
  scale: 1,
  rotation: 0,
  fit: "square",
};

export function normalizeTextureTransform(
  value?: TextureTransform | null,
): Required<TextureTransform> {
  const scale = Number(value?.scale);
  const rotation = Number(value?.rotation);
  const fit = value?.fit;
  return {
    scale: Number.isFinite(scale) ? Math.max(0.05, Math.min(16, scale)) : 1,
    rotation: Number.isFinite(rotation) ? rotation : 0,
    fit: fit === "original" || fit === "fit" || fit === "square" ? fit : "square",
  };
}

export function isDefaultTextureTransform(value?: TextureTransform | null): boolean {
  if (!value) return true;
  const t = normalizeTextureTransform(value);
  return t.scale === 1 && Math.abs(t.rotation) < 0.01 && t.fit === "square";
}

export function textureTransformSig(value?: TextureTransform | null): string {
  if (isDefaultTextureTransform(value)) return "";
  const t = normalizeTextureTransform(value);
  return `${t.fit}:${t.scale.toFixed(3)}:${t.rotation.toFixed(2)}`;
}

function textureImageAspect(tex: any): number {
  const img = tex?.image;
  if (!img) return 1;
  const first = Array.isArray(img) ? img[0] : img;
  const w = Number(first?.naturalWidth || first?.width || first?.videoWidth || 1);
  const h = Number(first?.naturalHeight || first?.height || first?.videoHeight || 1);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  return w / h;
}

/** Apply scale / rotation / fit onto a Three.js Texture. */
export function applyThreeTextureTransform(tex: any, value?: TextureTransform | null) {
  if (!tex?.isTexture) return;
  const t = normalizeTextureTransform(value);
  const aspect = textureImageAspect(tex);
  const s = t.scale;

  let repeatU = s;
  let repeatV = s;
  let offsetU = 0;
  let offsetV = 0;
  let wrap: typeof RepeatWrapping | typeof ClampToEdgeWrapping = RepeatWrapping;

  if (t.fit === "original") {
    if (aspect >= 1) {
      repeatU = s;
      repeatV = s * aspect;
    } else {
      repeatU = s / Math.max(aspect, 0.01);
      repeatV = s;
    }
    wrap = RepeatWrapping;
  } else if (t.fit === "fit") {
    wrap = ClampToEdgeWrapping;
    if (aspect >= 1) {
      repeatU = s;
      repeatV = s * aspect;
    } else {
      repeatU = s / Math.max(aspect, 0.01);
      repeatV = s;
    }
    offsetU = (1 - repeatU) / 2;
    offsetV = (1 - repeatV) / 2;
  }

  try {
    tex.wrapS = wrap;
    tex.wrapT = wrap;
  } catch {
    // Optional
  }
  tex.repeat?.set?.(repeatU, repeatV);
  tex.offset?.set?.(offsetU, offsetV);
  tex.rotation = (t.rotation * Math.PI) / 180;
  tex.center?.set?.(0.5, 0.5);
  tex.updateMatrix?.();
  tex.needsUpdate = true;
}
