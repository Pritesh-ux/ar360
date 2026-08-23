"use client";

import { sanitizeOrigin } from "@/lib/url";
import { isProtectedAssetUrl } from "@/lib/billing/asset-url";
import { canonicalizeProductGlbPath } from "@/lib/modelSource";
import AppImage from "@/components/shared/AppImage";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import {
  hasCustomMaterialTextures,
  liveInspectorMatchesNative,
  shouldApplyMaterialOverride,
} from "@/components/features/editor/utils";
import { snapshotNativeMaterialsFromViewer } from "@/lib/materials/native-snapshot";
import {
  applyMeshFlagsForMaterial,
  applyGemstoneOpticsToBacking,
  applyGemstoneOpticalApproximationToBacking,
  disableGemstoneOpticalApproximationOnBacking,
  probeGemstoneOpticalBacking,
  ensurePhysicalBackingForRefraction,
  getThreeBackingMaterials,
  resolveAttenuationDistanceForThree,
  resolveGemstoneAttenuationDistanceForThree,
  resolveGemstoneRuntimeThickness,
  resolveGemstoneTransmissionFactor,
  resolveWebTransmissionFactor,
  tintHex,
  GEMSTONE_ATTENUATION_REFERENCE_THICKNESS,
} from "@/lib/materials/inspector-apply";
import { isClearedMaterialTexture, resolveRuntimeGemstoneSetting } from "@/lib/materials/diamond-look";
import { clampDispersion } from "@/lib/materials/gemstone-presets";
import { resolveGemstoneOpticsApproxParams } from "@/lib/materials/gemstone-optics-approx";
import { ensureModelViewerKhrTransmission } from "@/lib/materials/khr-transmission-bake";
import { softenTextureUri } from "@/lib/materials/soften-texture";
import {
  resolveViewerBumpScale,
  resolveViewerBumpSoftness,
} from "@/lib/materials/viewer-bump-feel";
import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
} from "three";
import {
  applyThreeTextureTransform,
  isDefaultTextureTransform,
  textureTransformSig,
  type TextureTransform,
} from "@/lib/materials/texture-transform";
import { pickWorldHit } from "@/components/features/editor/frame-selected";
import { ensureAabbPlanarUv } from "@/lib/materials/glb-texture-bind";
import {
  isTransparentMaterialPart,
  listGemOrGlassNameHints,
  stripTransparencyOverridesForOpaqueSlot,
} from "@/lib/materials/transparent-part";
import { collectMaterialSceneNames } from "@/lib/materials/material-scene-names";
import { hideBackdropPlanes } from "@/lib/model/backdrop-plane";
import { ensureStudioFormLights } from "@/lib/model/studio-form-lights";
import { applyEnvironmentGrade } from "@/lib/model/environment-grade";
import { startModelViewerTransparentClearLoop } from "@/lib/model/viewer-transparent-clear";
import { isGemRendererActiveForProduct } from "@/lib/gem-integration";
import GemRendererOverlay from "@/components/shared/GemRendererOverlay";
import { deactivateGemProduct } from "@/lib/gem-integration";
import { planWhiteProductDepth } from "@/lib/materials/white-product-depth";
import {
  formatModelViewerScale,
  maxModelDimension,
  minModelDimension,
  resolveArModelScale,
  type ArModelUnit,
} from "@/lib/ar-model-scale";

function getViewerThreeScene(viewer: any): any | null {
  if (!viewer) return null;
  try {
    const sceneSymbol = Object.getOwnPropertySymbols(viewer).find(
      (symbol) => symbol.description === "scene",
    );
    return sceneSymbol ? (viewer as any)[sceneSymbol] ?? null : null;
  } catch {
    return null;
  }
}
export type ViewerMaterial = {
  index: number;
  name: string;
  isLogoTarget: boolean;
  /** Glass / water / diamond / clear plastic — Object transparency targets only these. */
  isTransparentPart: boolean;
  /** Mesh/node names tied to this material (for gem detection / UI hints). */
  relatedNames?: string[];
};

export type MaterialsLoadedMeta = {
  /** Scene meshes that look like diamond/gem/glass even when materials are not split yet. */
  gemMeshHints: string[];
};

export type MaterialLogoLayer = {
  name?: string;
  image: string;
  mode: "print" | "engrave" | "emboss";
  blendMode: "normal" | "multiply" | "screen" | "overlay";
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  opacity: number;
};

type MaterialSetting = {
  type?: "standard" | "gemstone";
  gemstoneType?:
    | "diamond"
    | "ruby"
    | "sapphire"
    | "emerald"
    | "amethyst"
    | "moissanite";
  dispersion?: number;
  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  occlusionStrength?: number;
  opacity?: number;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
  transmission?: number;
  ior?: number;
  thickness?: number;
  attenuationDistance?: number;
  attenuationColor?: string;
  specularIntensity?: number;
  specularColor?: string;
  envMapIntensity?: number;
  reflectionIntensity?: number;
  reflectionBlur?: number;
  reflectionTint?: string;
  fresnelStrength?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  normalScale?: number;
  bumpTexture?: string;
  bumpScale?: number;
  bumpSoftness?: number;
  baseColorMapTransform?: TextureTransform;
  metallicRoughnessMapTransform?: TextureTransform;
  normalMapTransform?: TextureTransform;
  emissiveMapTransform?: TextureTransform;
  occlusionMapTransform?: TextureTransform;
  bumpMapTransform?: TextureTransform;
  baseColorTexCoord?: number;
  baseColorTexOffsetU?: number;
  baseColorTexOffsetV?: number;
  baseColorTexScaleU?: number;
  baseColorTexScaleV?: number;
  baseColorTexRotation?: number;
  baseColorTexFlipU?: boolean;
  baseColorTexFlipV?: boolean;
  doubleSided?: boolean;
  depthWrite?: boolean;
  depthTest?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  logoLayer?: MaterialLogoLayer;
};

type Hotspot = {
  id: string;
  title?: string;
  description?: string;
  position: string;
  normal?: string;
  actionType?: string;
  actionValue?: string;
};

export type LogoDecal = {
  id: string;
  name: string;
  image: string;
  position: string;
  normal: string;
  size: number;
  rotation: number;
  opacity: number;
};

type Props = {
  src?: string;
  poster?: string;
  /** model-viewer loading strategy. Landing should prefer "lazy". */
  loading?: "auto" | "lazy" | "eager";

  exposure?: number;
  skyboxImage?: string;
  environmentImage?: string;
  /** Grades IBL from any HDR — white / 1 = unchanged. */
  environmentTint?: string;
  environmentSaturation?: number;
  /** model-viewer tone-mapping: commerce is best for product depth/color. */
  toneMapping?: "auto" | "aces" | "agx" | "commerce" | "neutral";
  backgroundColor?: string;
  transparent?: boolean;
  shadowIntensity?: number;
  shadowSoftness?: number;

  autoRotate?: boolean;
  cameraControls?: boolean;
  /** Disables scroll/pinch zoom while keeping orbit (when cameraControls is on). */
  disableZoom?: boolean;
  /**
   * Disables model-viewer tap-to-recenter (default on).
   * Empty-canvas / side clicks otherwise pan the product away, then framing snaps back.
   */
  disableTap?: boolean;
  showArButton?: boolean;
  interactionPrompt?: boolean;
  autoPlay?: boolean;
  /** AR surface target: floor (default) or wall. */
  arPlacement?: "floor" | "wall";
  /** Opt-in 1:1 lock. Off by default so buyers can pinch-resize inside AR. */
  realScale?: boolean;
  /**
   * Uniform model scale for AR real-world size (glTF unit = meter).
   * When omitted with modelUnit "auto", inferred from bounding box.
   */
  modelScale?: number | null;
  /** USDZ for Apple Quick Look (model-viewer ios-src). */
  iosSrc?: string;
  /** Declared authoring unit; "auto" infers cm/mm from dimensions. */
  modelUnit?: ArModelUnit;
  onModelScaleResolved?: (scale: number) => void;
  fov?: number;
  cameraOrbit?: string;
  cameraTarget?: string;

  selectedMaterialIndex?: number;
  /** Temporarily emissive-highlight this material slot (e.g. 1s on select). */
  highlightMaterialIndex?: number | null;
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  occlusionStrength?: number;
  bumpTexture?: string;
  bumpScale?: number;
  bumpSoftness?: number;
  opacity?: number;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
  transmission?: number;
  ior?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  specularIntensity?: number;
  specularColor?: string;
  envMapIntensity?: number;
  reflectionIntensity?: number;
  reflectionBlur?: number;
  reflectionTint?: string;
  fresnelStrength?: number;
  allMaterialSettings?: Record<number, MaterialSetting>;

  hotspots?: Hotspot[];
  logoDecals?: LogoDecal[];

  pickHotspot?: boolean;
  onHotspotPicked?: (position: string) => void;

  pickLogoDecal?: boolean;
  onLogoDecalPicked?: (point: { position: string; normal: string }) => void;

  /** Right-click a mesh to select its material slot (editor). */
  onMaterialPicked?: (
    index: number,
    hit?: { x: number; y: number; z: number; uuid?: string; additive?: boolean; object?: any },
  ) => void;

  onMaterialsLoaded?: (
    materials: ViewerMaterial[],
    nativeSettings: Record<number, MaterialSetting>,
    meta?: MaterialsLoadedMeta,
  ) => void;
  onModelReady?: () => void | Promise<void>;
  onLoadProgress?: (progress: number) => void;
  onModelError?: (event: Event) => void;
  /** Skip editor material/texture overrides (landing page previews). */
  disableMaterialOverrides?: boolean;
  /** Active product id — enables internal GemRenderer path when flagged. */
  productId?: string;
  variantId?: string;
  /** Product-level environment Y rotation (degrees) for gem HDRI bridge. */
  environmentRotation?: number;
  /**
   * Show the in-viewer progress pill. Set false when a parent already owns
   * loading UI (editor / hero) so users don't see stacked spinners.
   */
  showLoadProgress?: boolean;
  forwardedRef?: any;
};

function hexToRgb01(hex: string) {
  const clean = hex.replace("#", "").padEnd(6, "0");

  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

function parseImageMimeType(uri: string) {
  if (uri.startsWith("data:")) {
    const match = uri.match(/^data:([^;,]+)/);
    return match?.[1] || "image/png";
  }

  const lower = uri.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".webp")) return "image/webp";
  return "image/png";
}

function isSameOriginAssetPath(path: string) {
  return (
    path.startsWith("/api/assets/") ||
    path.startsWith("/Storage/") ||
    path.startsWith("/uploads/")
  );
}

/**
 * Safari (especially iPhone) is strict: Image/WebGL with crossOrigin=anonymous
 * needs ACAO headers. Our /Storage assets are same-origin but often omit CORS,
 * so bump/albedo maps silently fail on mobile while Chrome on PC still works.
 * Always promote those URLs to blob: via same-origin fetch.
 */
async function resolveTextureUriForViewer(uri: string) {
  const normalized = toCurrentOriginAssetUrl(uri);
  const mimeType = parseImageMimeType(normalized);

  // model-viewer.createTexture often fails on large data: URIs — convert to blob:.
  if (normalized.startsWith("data:")) {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`Texture data URI conversion failed (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    trackViewerTextureBlobUrl(objectUrl);
    return {
      uri: objectUrl,
      mimeType: blob.type || mimeType,
    };
  }

  if (normalized.startsWith("blob:")) {
    return { uri: normalized, mimeType };
  }

  if (typeof window !== "undefined" && isSameOriginAssetPath(normalized)) {
    const fetchUrl = `${sanitizeOrigin(window.location.origin)}${normalized}`;
    const response = await fetch(fetchUrl, {
      credentials: "include",
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`Texture fetch failed (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    trackViewerTextureBlobUrl(objectUrl);
    return {
      uri: objectUrl,
      mimeType: blob.type || mimeType,
    };
  }

  return { uri: normalized, mimeType };
}

const viewerTextureBlobUrls = new Set<string>();

function trackViewerTextureBlobUrl(url: string) {
  if (!url.startsWith("blob:")) return;
  viewerTextureBlobUrls.add(url);
  if (viewerTextureBlobUrls.size > 48) {
    const first = viewerTextureBlobUrls.values().next().value;
    if (first) {
      viewerTextureBlobUrls.delete(first);
      try {
        URL.revokeObjectURL(first);
      } catch {
        // ignore
      }
    }
  }
}

function revokeViewerTextureBlobUrls() {
  for (const url of viewerTextureBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  viewerTextureBlobUrls.clear();
}

async function createViewerTexture(viewer: any, uri?: string) {
  if (!uri?.trim()) return null;
  // Unpin sentinel (any rewritten form) must never hit the network.
  if (isClearedMaterialTexture(uri)) return null;

  const previousCredentials = Boolean(viewer.withCredentials);
  viewer.withCredentials = false;

  try {
    const { uri: resolvedUri, mimeType } = await resolveTextureUriForViewer(uri);
    if (isClearedMaterialTexture(resolvedUri)) return null;
    return await viewer.createTexture(resolvedUri, mimeType);
  } finally {
    viewer.withCredentials = previousCredentials;
  }
}

function configureModelViewerDecoders() {
  if (typeof window === "undefined") return;

  const w = window as typeof window & {
    ModelViewerElement?: {
      dracoDecoderLocation?: string;
      ktx2TranscoderLocation?: string;
    };
  };

  w.ModelViewerElement ??= {};
  w.ModelViewerElement.dracoDecoderLocation = `${sanitizeOrigin(window.location.origin)}/vendor/draco/gltf/`;
  w.ModelViewerElement.ktx2TranscoderLocation =
    w.ModelViewerElement.ktx2TranscoderLocation ||
    "https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/";
}

// Keep fetched model object URLs alive for the whole browser session.
// model-viewer/THREE creates its own temporary blob URLs for embedded GLB
// images. Replacing or revoking the parent model URL while those images are
// decoding causes the recurring "Couldn't load texture blob:" error.
const stableModelSourceCache = new Map<string, Promise<string>>();

const GLB_MAGIC = 0x46546c67; // glTF

async function probeProtectedGlbUrl(url: string): Promise<string> {
  const candidates = [url];
  const canonical = canonicalizeProductGlbPath(url);
  if (canonical && canonical !== url) candidates.push(canonical);

  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        credentials: "include",
        headers: { Range: "bytes=0-11" },
        cache: "no-store",
      });

      // Auth / missing file — do not hand JSON error bodies to GLTFLoader
      // (that produces Uncaught RangeError: Invalid typed array length).
      if (!response.ok && response.status !== 206) {
        lastError = new Error(`Model asset unavailable (${response.status})`);
        continue;
      }

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json") || contentType.includes("text/")) {
        lastError = new Error("Model asset returned a non-GLB response");
        continue;
      }

      const buf = new Uint8Array(await response.arrayBuffer());
      // If the server ignored Range and returned the whole file, only inspect magic.
      if (buf.byteLength < 4) {
        lastError = new Error("Model asset is empty or truncated");
        continue;
      }
      const magic = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0, true);
      if (magic !== GLB_MAGIC) {
        lastError = new Error("Model asset is not a valid GLB");
        continue;
      }

      // Prefer the URL (not a blob) so model-viewer keeps embedded texture decoding stable.
      // Only use a blob when we accidentally downloaded the entire asset via ignored Range.
      const contentRange = response.headers.get("content-range");
      if (!contentRange && buf.byteLength > 64 * 1024) {
        const objectUrl = URL.createObjectURL(
          new Blob([buf], { type: "model/gltf-binary" }),
        );
        return objectUrl;
      }
      return candidate;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Model probe failed");
    }
  }

  throw lastError || new Error("Model asset could not be verified");
}

function getStableModelSource(src: string): Promise<string> {
  const normalized = toCurrentOriginAssetUrl(src);

  if (!normalized || normalized.startsWith("blob:")) {
    return Promise.resolve(normalized);
  }

  // For data: URIs convert to a blob once so the large base64 string is not
  // repeatedly re-parsed by model-viewer on every re-render.
  if (normalized.startsWith("data:")) {
    const cached = stableModelSourceCache.get(normalized);
    if (cached) return cached;

    const pending = (async () => {
      const response = await fetch(normalized);
      if (!response.ok) {
        throw new Error(`Data model conversion failed (${response.status})`);
      }
      return URL.createObjectURL(await response.blob());
    })();

    stableModelSourceCache.set(normalized, pending);
    pending.catch(() => stableModelSourceCache.delete(normalized));
    return pending;
  }

  // Protected product GLBs: probe magic bytes first. Feeding a 404/403 JSON body
  // straight into model-viewer causes Uncaught RangeError during GLTF parse.
  if (isProtectedAssetUrl(normalized) && /\.gl(?:b|tf)(\?|$)/i.test(normalized)) {
    const cached = stableModelSourceCache.get(normalized);
    if (cached) return cached;

    const pending = probeProtectedGlbUrl(normalized);
    stableModelSourceCache.set(normalized, pending);
    pending.catch(() => stableModelSourceCache.delete(normalized));
    return pending;
  }

  // Public / relative models: pass the URL directly to model-viewer.
  return Promise.resolve(normalized);
}


function toCurrentOriginAssetUrl(src?: string) {
  const raw = String(src || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;

  if (typeof window === "undefined") return raw;

  try {
    if (raw.startsWith("/")) return raw;

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0") {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      if (url.origin === window.location.origin || sanitizeOrigin(url.origin) === sanitizeOrigin(window.location.origin)) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      return raw;
    }
  } catch {
    return raw;
  }

  return raw;
}

async function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  try {
    const { uri } = await resolveTextureUriForViewer(src);
    return new Promise((resolve, reject) => {
      const img = new Image();
      // blob:/data: must not set crossOrigin — Safari taints / fails load.
      if (!uri.startsWith("data:") && !uri.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = uri;
    });
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const fallback = toCurrentOriginAssetUrl(src);
      if (!fallback.startsWith("data:") && !fallback.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = fallback;
    });
  }
}

function removeNearWhiteBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) continue;

    const isAlmostWhite = r > 238 && g > 238 && b > 238;
    const isLightGray =
      r > 225 &&
      g > 225 &&
      b > 225 &&
      Math.abs(r - g) < 12 &&
      Math.abs(g - b) < 12;

    if (isAlmostWhite || isLightGray) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/** White-padded logos (JPG) as albedo look like stickers. Punch white, keep ink. */
async function preparePaddedLogoAlbedo(uri: string): Promise<string> {
  try {
    const img = await loadHtmlImage(uri);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < 4 || h < 4) return uri;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return uri;

    ctx.drawImage(img, 0, 0, w, h);
    const sample = ctx.getImageData(0, 0, w, h).data;
    let nearWhite = 0;
    const total = w * h;
    for (let i = 0; i < sample.length; i += 4) {
      const r = sample[i];
      const g = sample[i + 1];
      const b = sample[i + 2];
      if (r > 225 && g > 225 && b > 225 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) {
        nearWhite += 1;
      }
    }
    if (nearWhite / total < 0.28) return uri;

    removeNearWhiteBackground(canvas);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const outCtx = out.getContext("2d");
    if (!outCtx) return uri;
    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, w, h);
    outCtx.drawImage(canvas, 0, 0);
    return await new Promise((resolve) => {
      out.toBlob(
        (blob) => {
          if (!blob) {
            resolve(uri);
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        "image/png",
      );
    });
  } catch {
    return uri;
  }
}

function trimTransparentCanvas(source: HTMLCanvasElement) {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;

  const { width, height } = source;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return source;

  const padding = 6;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropWidth = Math.max(1, maxX - minX + 1);
  const cropHeight = Math.max(1, maxY - minY + 1);
  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;

  const croppedCtx = cropped.getContext("2d", { willReadFrequently: true });
  if (!croppedCtx) return source;

  croppedCtx.drawImage(
    source,
    minX,
    minY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  return cropped;
}

function normalizeCompositeOperation(
  blendMode: MaterialLogoLayer["blendMode"],
): GlobalCompositeOperation {
  if (blendMode === "multiply") return "multiply";
  if (blendMode === "screen") return "screen";
  if (blendMode === "overlay") return "overlay";
  return "source-over";
}

function overlayBlend(base: number, top: number) {
  return base < 128
    ? (2 * base * top) / 255
    : 255 - (2 * (255 - base) * (255 - top)) / 255;
}

async function createLogoBakedTexture(setting: MaterialSetting) {
  const layer = setting.logoLayer;
  if (!layer?.image?.trim()) return setting.baseColorTexture;

  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return setting.baseColorTexture;

  const [r, g, b] = hexToRgb01(setting.baseColor || "#ffffff");
  ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  ctx.fillRect(0, 0, size, size);

  if (setting.baseColorTexture && !isClearedMaterialTexture(setting.baseColorTexture)) {
    try {
      const baseImg = await loadHtmlImage(setting.baseColorTexture);
      ctx.drawImage(baseImg, 0, 0, size, size);
    } catch (error) {
      console.warn("Base texture could not be loaded for logo bake", error);
    }
  }

  const logoImg = await loadHtmlImage(layer.image);
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = size;
  logoCanvas.height = size;
  const logoCtx = logoCanvas.getContext("2d", { willReadFrequently: true });
  if (!logoCtx) return setting.baseColorTexture;

  const cleanedLogo = document.createElement("canvas");
  cleanedLogo.width = logoImg.naturalWidth || logoImg.width || 512;
  cleanedLogo.height = logoImg.naturalHeight || logoImg.height || 512;
  const cleanedCtx = cleanedLogo.getContext("2d", { willReadFrequently: true });

  let finalLogoSource: HTMLCanvasElement | HTMLImageElement = logoImg;
  let finalLogoRatio = logoImg.height / Math.max(1, logoImg.width);

  if (cleanedCtx) {
    cleanedCtx.drawImage(logoImg, 0, 0, cleanedLogo.width, cleanedLogo.height);
    removeNearWhiteBackground(cleanedLogo);

    // Important: many uploaded logos are tiny text inside a large white square.
    // After white-background removal, crop to the real non-transparent logo pixels,
    // otherwise the user only sees a white patch / invisible tiny logo.
    const croppedLogo = trimTransparentCanvas(cleanedLogo);
    finalLogoSource = croppedLogo;
    finalLogoRatio = croppedLogo.height / Math.max(1, croppedLogo.width);
  }

  const finalLogoWidth = Math.max(8, size * layer.scale);
  const finalLogoHeight = finalLogoWidth * finalLogoRatio;
  const finalX = size / 2 + layer.offsetX * size;
  const finalY = size / 2 + layer.offsetY * size;

  logoCtx.save();
  logoCtx.translate(finalX, finalY);
  logoCtx.rotate((layer.rotation * Math.PI) / 180);
  logoCtx.globalAlpha = layer.opacity;
  logoCtx.drawImage(
    finalLogoSource,
    -finalLogoWidth / 2,
    -finalLogoHeight / 2,
    finalLogoWidth,
    finalLogoHeight,
  );
  logoCtx.restore();

  if (layer.mode === "engrave") {
    const logoData = logoCtx.getImageData(0, 0, size, size);
    const baseData = ctx.getImageData(0, 0, size, size);

    for (let i = 0; i < logoData.data.length; i += 4) {
      const a = logoData.data[i + 3] / 255;
      if (a <= 0) continue;
      const mark = 1 - 0.38 * a;
      baseData.data[i] = Math.max(0, baseData.data[i] * mark);
      baseData.data[i + 1] = Math.max(0, baseData.data[i + 1] * mark);
      baseData.data[i + 2] = Math.max(0, baseData.data[i + 2] * mark);
    }

    ctx.putImageData(baseData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  if (layer.mode === "emboss") {
    const logoData = logoCtx.getImageData(0, 0, size, size);
    const baseData = ctx.getImageData(0, 0, size, size);

    for (let i = 0; i < logoData.data.length; i += 4) {
      const a = logoData.data[i + 3] / 255;
      if (a <= 0) continue;
      const lift = 32 * a;
      baseData.data[i] = Math.min(255, baseData.data[i] + lift);
      baseData.data[i + 1] = Math.min(255, baseData.data[i + 1] + lift);
      baseData.data[i + 2] = Math.min(255, baseData.data[i + 2] + lift);
    }

    ctx.putImageData(baseData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  if (layer.blendMode === "normal") {
    ctx.drawImage(logoCanvas, 0, 0);
    return canvas.toDataURL("image/png");
  }

  // Browser blend modes keep the logo local on this baked canvas.
  // Do not use texture.repeat/offset here, otherwise the logo repeats on UVs.
  const beforeBlend = ctx.getImageData(0, 0, size, size);
  ctx.save();
  ctx.globalCompositeOperation = normalizeCompositeOperation(layer.blendMode);
  ctx.drawImage(logoCanvas, 0, 0);
  ctx.restore();

  // Some browsers do not support overlay/screen consistently on canvas-backed textures.
  // If nothing changed, fall back to manual pixel blending below.
  const afterBlend = ctx.getImageData(0, 0, size, size);
  let changed = false;
  for (let i = 0; i < afterBlend.data.length; i += 128) {
    if (afterBlend.data[i] !== beforeBlend.data[i]) {
      changed = true;
      break;
    }
  }
  if (changed) return canvas.toDataURL("image/png");

  ctx.putImageData(beforeBlend, 0, 0);
  const logoData = logoCtx.getImageData(0, 0, size, size);
  const baseData = ctx.getImageData(0, 0, size, size);

  for (let i = 0; i < logoData.data.length; i += 4) {
    const a = logoData.data[i + 3] / 255;
    if (a <= 0) continue;

    for (let channel = 0; channel < 3; channel++) {
      const base = baseData.data[i + channel];
      const top = logoData.data[i + channel];
      let blended = top;

      if (layer.blendMode === "multiply") blended = (base * top) / 255;
      if (layer.blendMode === "screen")
        blended = 255 - ((255 - base) * (255 - top)) / 255;
      if (layer.blendMode === "overlay") blended = overlayBlend(base, top);

      baseData.data[i + channel] = base * (1 - a) + blended * a;
    }
  }

  ctx.putImageData(baseData, 0, 0);
  return canvas.toDataURL("image/png");
}

function buildMaterialOverrideMap(input: {
  allMaterialSettings?: Record<number, MaterialSetting>;
  nativeMaterials?: Record<number, MaterialSetting>;
  selectedMaterialIndex?: number;
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  occlusionStrength?: number;
  bumpTexture?: string;
  bumpScale?: number;
  bumpSoftness?: number;
  opacity?: number;
  alphaMode?: "OPAQUE" | "BLEND" | "MASK";
  transmission?: number;
  ior?: number;
  thickness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  specularIntensity?: number;
  specularColor?: string;
  envMapIntensity?: number;
  reflectionIntensity?: number;
  reflectionBlur?: number;
  reflectionTint?: string;
  fresnelStrength?: number;
}) {
  const settings: Record<number, MaterialSetting> = {};

  for (const [indexKey, setting] of Object.entries(input.allMaterialSettings || {})) {
    if (shouldApplyMaterialOverride(setting) || hasInspectorExtras(setting)) {
      settings[Number(indexKey)] = setting;
    }
  }

  // Live factor overlay is editor-only. Public/embed pass allMaterialSettings
  // without live props — inventing defaults here wiped every variant's slot 0.
  const hasLiveProps =
    input.baseColor != null ||
    input.metalness != null ||
    input.roughness != null ||
    input.emissiveColor != null ||
    Boolean(input.baseColorTexture) ||
    Boolean(input.metallicRoughnessTexture) ||
    Boolean(input.normalTexture) ||
    Boolean(input.emissiveTexture) ||
    Boolean(input.occlusionTexture) ||
    input.occlusionStrength != null ||
    Boolean(input.bumpTexture) ||
    input.bumpScale != null ||
    input.bumpSoftness != null ||
    input.opacity != null ||
    input.alphaMode != null ||
    input.transmission != null ||
    input.ior != null ||
    input.thickness != null ||
    input.clearcoat != null ||
    input.clearcoatRoughness != null ||
    input.specularIntensity != null ||
    input.specularColor != null ||
    input.envMapIntensity != null ||
    input.reflectionIntensity != null ||
    input.reflectionBlur != null ||
    input.reflectionTint != null ||
    input.fresnelStrength != null;
  const liveSlot =
    input.selectedMaterialIndex != null && Number.isFinite(Number(input.selectedMaterialIndex))
      ? Number(input.selectedMaterialIndex)
      : null;

  if (hasLiveProps && liveSlot != null) {
    // Only include live texture keys when defined — spreading `undefined`
    // would wipe textures already present in allMaterialSettings.
    const live: MaterialSetting = {
      baseColor: input.baseColor || "#ffffff",
      metalness: Number(input.metalness ?? 0),
      roughness: Number(input.roughness ?? 0.5),
      emissiveColor: input.emissiveColor || "#000000",
    };
    if (input.baseColorTexture != null) live.baseColorTexture = input.baseColorTexture;
    if (input.metallicRoughnessTexture != null) {
      live.metallicRoughnessTexture = input.metallicRoughnessTexture;
    }
    if (input.normalTexture != null) live.normalTexture = input.normalTexture;
    if (input.emissiveTexture != null) live.emissiveTexture = input.emissiveTexture;
    if (input.occlusionTexture != null) live.occlusionTexture = input.occlusionTexture;
    if (input.occlusionStrength != null) live.occlusionStrength = Number(input.occlusionStrength);
    if (input.bumpTexture != null) live.bumpTexture = input.bumpTexture;
    if (input.bumpScale != null) live.bumpScale = Number(input.bumpScale);
    if (input.bumpSoftness != null) live.bumpSoftness = Number(input.bumpSoftness);
    if (input.opacity != null) live.opacity = input.opacity;
    if (input.alphaMode != null) live.alphaMode = input.alphaMode;
    if (input.transmission != null) live.transmission = input.transmission;
    if (input.ior != null) live.ior = input.ior;
    if (input.thickness != null) live.thickness = input.thickness;
    if (input.clearcoat != null) live.clearcoat = input.clearcoat;
    if (input.clearcoatRoughness != null) live.clearcoatRoughness = input.clearcoatRoughness;
    if (input.specularIntensity != null) live.specularIntensity = Number(input.specularIntensity);
    if (input.specularColor != null) live.specularColor = input.specularColor;
    if (input.envMapIntensity != null) live.envMapIntensity = Number(input.envMapIntensity);
    if (input.reflectionIntensity != null) live.reflectionIntensity = Number(input.reflectionIntensity);
    if (input.reflectionBlur != null) live.reflectionBlur = Number(input.reflectionBlur);
    if (input.reflectionTint != null) live.reflectionTint = input.reflectionTint;
    if (input.fresnelStrength != null) live.fresnelStrength = Number(input.fresnelStrength);

    const native = input.nativeMaterials?.[liveSlot];
    const mirrorsNative = liveInspectorMatchesNative(live, native);
    // Seeding the inspector from GLB natives must NOT count as an override —
    // that path used to re-apply every slot and wipe baked MR maps.
    const shouldMergeLive =
      Boolean(settings[liveSlot]) ||
      hasCustomMaterialTextures(live) ||
      ((shouldApplyMaterialOverride(live) || hasInspectorExtras(live)) && !mirrorsNative);

    if (shouldMergeLive) {
      settings[liveSlot] = {
        ...settings[liveSlot],
        ...live,
        baseColor: live.baseColor ?? settings[liveSlot]?.baseColor,
        metalness: live.metalness,
        roughness: live.roughness,
        emissiveColor: live.emissiveColor ?? settings[liveSlot]?.emissiveColor,
        occlusionStrength: live.occlusionStrength ?? settings[liveSlot]?.occlusionStrength,
        opacity: live.opacity ?? settings[liveSlot]?.opacity,
        alphaMode: live.alphaMode ?? settings[liveSlot]?.alphaMode,
        transmission: live.transmission ?? settings[liveSlot]?.transmission,
        ior: live.ior ?? settings[liveSlot]?.ior,
        thickness: live.thickness ?? settings[liveSlot]?.thickness,
        clearcoat: live.clearcoat ?? settings[liveSlot]?.clearcoat,
        clearcoatRoughness: live.clearcoatRoughness ?? settings[liveSlot]?.clearcoatRoughness,
        specularIntensity: live.specularIntensity ?? settings[liveSlot]?.specularIntensity,
        specularColor: live.specularColor ?? settings[liveSlot]?.specularColor,
        envMapIntensity: live.envMapIntensity ?? settings[liveSlot]?.envMapIntensity,
        reflectionIntensity: live.reflectionIntensity ?? settings[liveSlot]?.reflectionIntensity,
        reflectionBlur: live.reflectionBlur ?? settings[liveSlot]?.reflectionBlur,
        reflectionTint: live.reflectionTint ?? settings[liveSlot]?.reflectionTint,
        fresnelStrength: live.fresnelStrength ?? settings[liveSlot]?.fresnelStrength,
        baseColorTexture: live.baseColorTexture ?? settings[liveSlot]?.baseColorTexture,
        metallicRoughnessTexture:
          live.metallicRoughnessTexture ?? settings[liveSlot]?.metallicRoughnessTexture,
        normalTexture: live.normalTexture ?? settings[liveSlot]?.normalTexture,
        emissiveTexture: live.emissiveTexture ?? settings[liveSlot]?.emissiveTexture,
        occlusionTexture: live.occlusionTexture ?? settings[liveSlot]?.occlusionTexture,
        bumpTexture: isClearedMaterialTexture(live.bumpTexture)
          ? live.bumpTexture
          : live.bumpTexture?.trim() || settings[liveSlot]?.bumpTexture,
        bumpScale: live.bumpScale ?? settings[liveSlot]?.bumpScale,
        bumpSoftness: live.bumpSoftness ?? settings[liveSlot]?.bumpSoftness,
        bumpMapTransform: live.bumpMapTransform ?? settings[liveSlot]?.bumpMapTransform,
        metallicRoughnessMapTransform:
          live.metallicRoughnessMapTransform ?? settings[liveSlot]?.metallicRoughnessMapTransform,
        normalMapTransform: live.normalMapTransform ?? settings[liveSlot]?.normalMapTransform,
        emissiveMapTransform: live.emissiveMapTransform ?? settings[liveSlot]?.emissiveMapTransform,
        occlusionMapTransform: live.occlusionMapTransform ?? settings[liveSlot]?.occlusionMapTransform,
        baseColorMapTransform: live.baseColorMapTransform ?? settings[liveSlot]?.baseColorMapTransform,
      };
    }
  }

  return settings;
}

/** Per-material handle to the GLB's original metallicRoughness texture. */
const nativeMrTextureByMaterial = new WeakMap<object, any>();

function hasInspectorExtras(setting?: MaterialSetting | null) {
  if (!setting) return false;
  return (
    setting.type === "gemstone" ||
    (setting.dispersion != null && Number(setting.dispersion) > 0.0001) ||
    (setting.clearcoat != null && Number(setting.clearcoat) > 0.001) ||
    (setting.clearcoatRoughness != null && Number(setting.clearcoatRoughness) > 0.001) ||
    (setting.envMapIntensity != null && Math.abs(Number(setting.envMapIntensity) - 1) > 0.001) ||
    (setting.reflectionIntensity != null &&
      Math.abs(Number(setting.reflectionIntensity) - 1) > 0.001) ||
    (setting.reflectionBlur != null && Number(setting.reflectionBlur) > 0.001) ||
    (setting.fresnelStrength != null && Math.abs(Number(setting.fresnelStrength) - 1) > 0.001) ||
    (setting.specularIntensity != null && Math.abs(Number(setting.specularIntensity) - 1) > 0.001) ||
    (setting.normalScale != null && Math.abs(Number(setting.normalScale) - 1) > 0.001) ||
    (setting.bumpScale != null && Math.abs(Number(setting.bumpScale) - 1) > 0.001) ||
    (setting.bumpSoftness != null && Number(setting.bumpSoftness) > 0.001) ||
    Boolean(setting.bumpTexture?.trim()) ||
    !isDefaultTextureTransform(setting.baseColorMapTransform) ||
    !isDefaultTextureTransform(setting.metallicRoughnessMapTransform) ||
    !isDefaultTextureTransform(setting.normalMapTransform) ||
    !isDefaultTextureTransform(setting.emissiveMapTransform) ||
    !isDefaultTextureTransform(setting.occlusionMapTransform) ||
    !isDefaultTextureTransform(setting.bumpMapTransform) ||
    (setting.ior != null && Math.abs(Number(setting.ior) - 1.5) > 0.001) ||
    (setting.thickness != null && Number(setting.thickness) > 0.001) ||
    (setting.attenuationDistance != null && Number(setting.attenuationDistance) > 0.001) ||
    (setting.attenuationColor != null &&
      String(setting.attenuationColor).trim().toLowerCase() !== "#ffffff") ||
    (setting.reflectionTint != null &&
      String(setting.reflectionTint).trim().toLowerCase() !== "#ffffff") ||
    (setting.specularColor != null &&
      String(setting.specularColor).trim().toLowerCase() !== "#ffffff") ||
    Boolean(setting.doubleSided) ||
    setting.depthWrite === false ||
    setting.depthTest === false ||
    Number(setting.baseColorTexCoord ?? 0) === 1 ||
    Math.abs(Number(setting.baseColorTexOffsetU ?? 0)) > 0.0001 ||
    Math.abs(Number(setting.baseColorTexOffsetV ?? 0)) > 0.0001 ||
    Math.abs(Number(setting.baseColorTexScaleU ?? 1) - 1) > 0.0001 ||
    Math.abs(Number(setting.baseColorTexScaleV ?? 1) - 1) > 0.0001 ||
    Math.abs(Number(setting.baseColorTexRotation ?? 0)) > 0.0001 ||
    Boolean(setting.baseColorTexFlipU) ||
    Boolean(setting.baseColorTexFlipV)
  );
}

function extractThreeTextureFromMvTexture(mvTexture: any): any | null {
  const seen = new Set<object>();
  const queue: any[] = [mvTexture];
  let steps = 0;
  while (queue.length && steps < 40) {
    steps += 1;
    const obj = queue.shift();
    if (!obj || typeof obj !== "object" || seen.has(obj)) continue;
    seen.add(obj);
    if (obj.isTexture) return obj;
    try {
      for (const key of Object.getOwnPropertySymbols(obj)) {
        const value = obj[key];
        if (value instanceof Set) {
          for (const item of value) queue.push(item);
        } else {
          queue.push(value);
        }
      }
    } catch {
      // Optional
    }
    for (const key of ["source", "image", "texture", "threeTexture"]) {
      if (obj[key]) queue.push(obj[key]);
    }
  }
  return null;
}

const bumpTextureCache = new Map<string, any>();

function bumpTextureCacheKey(uri: string, softness: number) {
  let hash = 2166136261;
  for (let i = 0; i < uri.length; i += 1) {
    hash ^= uri.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(36)}:${softness.toFixed(2)}`;
}

async function loadCachedBumpThreeTexture(
  viewer: any,
  uri: string,
  softness: number,
): Promise<any | null> {
  const key = bumpTextureCacheKey(uri, softness);
  const cached = bumpTextureCache.get(key);
  if (cached?.isTexture) return cached;
  const loaded = await loadBumpThreeTexture(viewer, uri);
  if (loaded?.isTexture) {
    if (bumpTextureCache.size > 24) {
      const first = bumpTextureCache.keys().next().value;
      if (first) bumpTextureCache.delete(first);
    }
    bumpTextureCache.set(key, loaded);
  }
  return loaded;
}

function visitSlotThreeMaterials(
  viewer: any,
  material: any,
  visit: (threeMat: any) => void,
) {
  const backing = getThreeBackingMaterials(material);
  const backingIds = new Set(backing.map((m) => m?.uuid).filter(Boolean));
  const slotName = String(material?.name || "").trim();
  const seen = new Set<string>();

  const belongs = (threeMat: any) => {
    if (!threeMat) return false;
    if (backing.includes(threeMat) || backingIds.has(threeMat?.uuid)) return true;
    if (slotName && String(threeMat.name || "").trim() === slotName) return true;
    try {
      for (const value of Object.values(material || {})) {
        if (value === threeMat) return true;
        if (Array.isArray(value) && value.includes(threeMat)) return true;
        if (value instanceof Set && value.has(threeMat)) return true;
      }
    } catch {
      // Optional
    }
    return false;
  };

  const run = (threeMat: any) => {
    if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) return;
    if (typeof threeMat.uuid !== "string" || seen.has(threeMat.uuid)) return;
    seen.add(threeMat.uuid);
    visit(threeMat);
  };

  for (const threeMat of backing) run(threeMat);
  for (const root of collectViewerSceneRootsForDebug(viewer)) {
    root.traverse?.((mesh: any) => {
      if (!mesh?.isMesh && !mesh?.isSkinnedMesh) return;
      const meshMats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const threeMat of meshMats) {
        if (!belongs(threeMat)) continue;
        run(threeMat);
      }
    });
  }
}

function applyExistingMapTransforms(viewer: any, index: number, setting?: MaterialSetting | null) {
  if (!setting) return;
  const material = viewer?.model?.materials?.[index];
  if (!material) return;
  const bumpScale =
    setting.bumpScale != null && Number.isFinite(Number(setting.bumpScale))
      ? resolveViewerBumpScale(Number(setting.bumpScale))
      : null;
  visitSlotThreeMaterials(viewer, material, (threeMat) => {
    maybeApplyMapTransform(threeMat.map, setting.baseColorMapTransform, setting.baseColorTexture);
    maybeApplyMapTransform(
      threeMat.metalnessMap,
      setting.metallicRoughnessMapTransform,
      setting.metallicRoughnessTexture,
    );
    maybeApplyMapTransform(
      threeMat.roughnessMap,
      setting.metallicRoughnessMapTransform,
      setting.metallicRoughnessTexture,
    );
    maybeApplyMapTransform(threeMat.normalMap, setting.normalMapTransform, setting.normalTexture);
    maybeApplyMapTransform(threeMat.emissiveMap, setting.emissiveMapTransform, setting.emissiveTexture);
    maybeApplyMapTransform(threeMat.aoMap, setting.occlusionMapTransform, setting.occlusionTexture);
    maybeApplyMapTransform(threeMat.bumpMap, setting.bumpMapTransform, setting.bumpTexture);
    if (bumpScale != null && "bumpScale" in threeMat) threeMat.bumpScale = bumpScale;
    threeMat.needsUpdate = true;
  });
}

async function loadBumpThreeTexture(viewer: any, uri: string): Promise<any | null> {
  try {
    const mv = await createViewerTexture(viewer, uri);
    const extracted = extractThreeTextureFromMvTexture(mv);
    if (extracted?.isTexture) {
      configureBumpThreeTexture(extracted, viewer);
      return extracted;
    }
  } catch (error) {
    console.warn("Bump map model-viewer texture failed", error);
  }
  return createBumpCanvasTexture(uri, viewer);
}

function getViewerMaxAnisotropy(viewer?: any): number {
  try {
    for (const key of Object.getOwnPropertySymbols(viewer || {})) {
      const value = (viewer as any)[key];
      const renderer = value?.threeRenderer || value;
      const max = Number(renderer?.capabilities?.getMaxAnisotropy?.());
      if (Number.isFinite(max) && max > 1) {
        // Same cap on phone and PC so tiled bumps match across devices.
        return Math.min(16, max);
      }
    }
  } catch {
    // Optional
  }
  return 8;
}

function configureBumpThreeTexture(tex: any, viewer?: any) {
  if (!tex?.isTexture) return;
  try {
    tex.colorSpace = NoColorSpace;
  } catch {
    // Optional
  }
  try {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
  } catch {
    // Optional
  }
  try {
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = getViewerMaxAnisotropy(viewer);
  } catch {
    // Optional
  }
  tex.needsUpdate = true;
}

async function createBumpCanvasTexture(uri: string, viewer?: any): Promise<any | null> {
  try {
    const { uri: resolvedUri } = await resolveTextureUriForViewer(uri);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bump image load failed"));
      // blob:/data: do not need crossOrigin; setting it breaks Safari.
      if (!resolvedUri.startsWith("data:") && !resolvedUri.startsWith("blob:")) {
        el.crossOrigin = "anonymous";
      }
      el.src = resolvedUri;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 1;
    canvas.height = img.naturalHeight || img.height || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const tex = new CanvasTexture(canvas);
    configureBumpThreeTexture(tex, viewer);
    return tex;
  } catch (error) {
    console.warn("Bump map canvas fallback failed", error);
    return null;
  }
}

function maybeApplyMapTransform(
  tex: any,
  transform: TextureTransform | null | undefined,
  mapUri?: string,
) {
  if (!tex?.isTexture) return;
  const custom = Boolean(mapUri?.trim()) && !isClearedMaterialTexture(mapUri);
  if (!custom && isDefaultTextureTransform(transform)) return;
  applyThreeTextureTransform(tex, transform);
}

function applyBumpToSlotMeshes(
  viewer: any,
  material: any,
  bumpTex: any | null,
  bumpScale: number,
  clear: boolean,
  transform?: TextureTransform | null,
) {
  const backing = getThreeBackingMaterials(material);
  const backingIds = new Set(backing.map((m) => m?.uuid).filter(Boolean));
  const slotName = String(material?.name || "").trim();

  const belongsToSlot = (threeMat: any) => {
    if (!threeMat) return false;
    if (backing.includes(threeMat) || backingIds.has(threeMat?.uuid)) return true;
    if (slotName && String(threeMat.name || "").trim() === slotName) return true;
    try {
      for (const value of Object.values(material || {})) {
        if (value === threeMat) return true;
        if (Array.isArray(value) && value.includes(threeMat)) return true;
        if (value instanceof Set && value.has(threeMat)) return true;
      }
    } catch {
      // Optional
    }
    return false;
  };

  const writeMat = (threeMat: any) => {
    if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) return;
    if (typeof threeMat.uuid !== "string") return;
    if (clear) {
      threeMat.bumpMap = null;
      threeMat.userData = threeMat.userData || {};
      threeMat.userData.ar360Bump = false;
      if ("bumpScale" in threeMat) threeMat.bumpScale = 0;
    } else if (bumpTex) {
      applyThreeTextureTransform(bumpTex, transform);
      threeMat.bumpMap = bumpTex;
      threeMat.userData = threeMat.userData || {};
      threeMat.userData.ar360Bump = true;
      if ("bumpScale" in threeMat) threeMat.bumpScale = bumpScale;
    }
    threeMat.needsUpdate = true;
  };

  for (const threeMat of backing) writeMat(threeMat);

  for (const root of collectViewerSceneRootsForDebug(viewer)) {
    root.traverse?.((mesh: any) => {
      if (!mesh?.isMesh && !mesh?.isSkinnedMesh) return;
      const meshMats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      let matched = false;
      for (const threeMat of meshMats) {
        if (!belongsToSlot(threeMat)) continue;
        writeMat(threeMat);
        matched = true;
      }
      if (matched && mesh.geometry) ensureAabbPlanarUv(mesh.geometry, true);
    });
  }
}

function collectViewerSceneRootsForDebug(viewer: any): any[] {
  const roots: any[] = [];
  const seen = new Set<object>();
  const push = (value: any) => {
    if (!value || typeof value !== "object" || typeof value.traverse !== "function") return;
    if (seen.has(value)) return;
    seen.add(value);
    roots.push(value);
  };
  if (!viewer) return roots;
  push(viewer.model?.scene);
  push((viewer as any).scene);
  try {
    for (const key of Object.getOwnPropertySymbols(viewer)) {
      const value = viewer[key];
      push(value);
      if (value && typeof value === "object") {
        push(value.scene);
        push(value.threeScene);
        try {
          for (const inner of Object.getOwnPropertySymbols(value)) {
            push(value[inner]);
          }
        } catch {
          // Optional
        }
      }
    }
  } catch {
    // Optional
  }
  return roots;
}

function applyBaseColorUvPlacement(viewer: any, material: any, setting: MaterialSetting) {
  const hasMap =
    Boolean(setting.baseColorTexture?.trim()) &&
    !isClearedMaterialTexture(setting.baseColorTexture);
  if (!hasMap) return;

  const pbr = material?.pbrMetallicRoughness;
  const extracted = extractThreeTextureFromMvTexture(
    pbr?.baseColorTexture?.texture ?? pbr?.baseColorTexture?.getTexture?.(),
  );
  const backing = getThreeBackingMaterials(material);
  const backingIds = new Set(backing.map((m) => m?.uuid).filter(Boolean));
  const slotName = String(material?.name || "").trim();

  const applyTransform = (threeTex: any) => {
    if (!threeTex?.isTexture) return;
    if ("channel" in threeTex) {
      threeTex.channel = Number(setting.baseColorTexCoord ?? 0) === 1 ? 1 : 0;
    }
    if (!isDefaultTextureTransform(setting.baseColorMapTransform)) {
      applyThreeTextureTransform(threeTex, setting.baseColorMapTransform);
      return;
    }
    threeTex.wrapS = 1001;
    threeTex.wrapT = 1001;
    threeTex.offset?.set?.(
      Number(setting.baseColorTexOffsetU ?? 0) || 0,
      Number(setting.baseColorTexOffsetV ?? 0) || 0,
    );
    let scaleU = Number(setting.baseColorTexScaleU ?? 1);
    let scaleV = Number(setting.baseColorTexScaleV ?? 1);
    if (!Number.isFinite(scaleU) || scaleU === 0) scaleU = 1;
    if (!Number.isFinite(scaleV) || scaleV === 0) scaleV = 1;
    if (setting.baseColorTexFlipU) scaleU = -scaleU;
    if (setting.baseColorTexFlipV) scaleV = -scaleV;
    threeTex.repeat?.set?.(scaleU, scaleV);
    const deg = Number(setting.baseColorTexRotation ?? 0);
    if (Number.isFinite(deg)) {
      threeTex.rotation = (deg * Math.PI) / 180;
      threeTex.center?.set?.(0.5, 0.5);
    }
    threeTex.updateMatrix?.();
    threeTex.needsUpdate = true;
  };

  applyTransform(extracted);
  for (const threeMat of backing) {
    if (extracted && !threeMat?.map) {
      threeMat.map = extracted;
      threeMat.needsUpdate = true;
    }
    if (threeMat?.map) applyTransform(threeMat.map);
  }

  for (const root of collectViewerSceneRootsForDebug(viewer)) {
    root.traverse?.((mesh: any) => {
      if (!mesh?.isMesh && !mesh?.isSkinnedMesh) return;
      const meshMats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const threeMat of meshMats) {
        const sameInstance =
          backing.includes(threeMat) || backingIds.has(threeMat?.uuid);
        const sameName = slotName && threeMat?.name === slotName;
        if (!sameInstance && !sameName) continue;
        if (extracted && !threeMat.map) {
          threeMat.map = extracted;
          threeMat.needsUpdate = true;
        }
        if (threeMat.map) applyTransform(threeMat.map);
        if (mesh.geometry) ensureAabbPlanarUv(mesh.geometry, true);
      }
    });
  }
}

function applyLivePbrFactors(viewer: any, index: number, setting: MaterialSetting) {
  const material = viewer?.model?.materials?.[index];
  const pbr = material?.pbrMetallicRoughness;
  if (!pbr) return;

  setting = resolveRuntimeGemstoneSetting(setting, material?.name);

  const blur = Number(setting.reflectionBlur ?? 0);
  let effectiveRough = Number(setting.roughness ?? 0.5);
  if (blur > 0.001) effectiveRough = Math.min(1, Math.max(effectiveRough, blur));
  const effectiveMetallic =
    setting.type === "gemstone" ? 0 : Number(setting.metalness ?? 0);
  const alpha =
    setting.opacity != null && Number.isFinite(Number(setting.opacity))
      ? Math.min(1, Math.max(0, Number(setting.opacity)))
      : 1;
  const [r, g, b] = hexToRgb01(setting.baseColor || "#ffffff");

  try {
    const mrUrl = setting.metallicRoughnessTexture;
    if (!mrUrl || !String(mrUrl).trim()) {
      pbr.metallicRoughnessTexture?.setTexture?.(null);
    }
  } catch {
    // Optional — baked MR maps multiply factors and make sliders look broken.
  }

  try {
    if (typeof pbr.setMetallicFactor === "function") pbr.setMetallicFactor(effectiveMetallic);
    else pbr.metallicFactor = effectiveMetallic;
    if (typeof pbr.setRoughnessFactor === "function") pbr.setRoughnessFactor(effectiveRough);
    else pbr.roughnessFactor = effectiveRough;
    pbr.setBaseColorFactor?.([r, g, b, alpha]);
  } catch {
    // Optional
  }

  const specularBase = Number(setting.specularIntensity ?? 1);
  const fresnel = Number(setting.fresnelStrength ?? 1);
  const specularEffective = Math.min(1, Math.max(0, specularBase * fresnel));
  try {
    material.setSpecularFactor?.(specularEffective);
  } catch {
    // Optional
  }
  const clearcoat =
    setting.clearcoat != null && Number.isFinite(Number(setting.clearcoat))
      ? Number(setting.clearcoat)
      : null;
  const clearcoatRoughness =
    setting.clearcoatRoughness != null && Number.isFinite(Number(setting.clearcoatRoughness))
      ? Number(setting.clearcoatRoughness)
      : null;
  try {
    if (clearcoat != null) material.setClearcoatFactor?.(clearcoat);
    if (clearcoatRoughness != null) material.setClearcoatRoughnessFactor?.(clearcoatRoughness);
  } catch {
    // Optional
  }

  try {
    const backing = getThreeBackingMaterials(material, viewer);
    const envIntensity = Math.max(
      0,
      Number(setting.envMapIntensity ?? 1) * Number(setting.reflectionIntensity ?? 1),
    );
    for (const threeMat of backing) {
      if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) continue;
      if (threeMat.color?.setRGB) threeMat.color.setRGB(r, g, b);
      if ("metalness" in threeMat) threeMat.metalness = effectiveMetallic;
      if ("roughness" in threeMat) threeMat.roughness = effectiveRough;
      if ("opacity" in threeMat) threeMat.opacity = alpha;
      if ("specularIntensity" in threeMat) threeMat.specularIntensity = specularEffective;
      if ("clearcoat" in threeMat && clearcoat != null) threeMat.clearcoat = clearcoat;
      if ("clearcoatRoughness" in threeMat && clearcoatRoughness != null) {
        threeMat.clearcoatRoughness = clearcoatRoughness;
      }
      if ("envMapIntensity" in threeMat) threeMat.envMapIntensity = envIntensity;
    }
  } catch {
    // Optional
  }

  try {
    viewer.requestUpdate?.();
  } catch {
    // Optional
  }
}

async function applyMaterialSettingToSlot(
  viewer: any,
  index: number,
  setting: MaterialSetting,
  applyMetalRoughness = true,
  force = false,
  nativeSetting?: MaterialSetting,
) {
  const material = viewer.model.materials[index];
  if (!material) return;

  setting = resolveRuntimeGemstoneSetting(setting, material.name);

  // Always apply inspector settings when present — do not drop Clear Coat / IOR
  // edits just because the rest of the slot still looks "default".
  if (!force && !shouldApplyMaterialOverride(setting) && !hasInspectorExtras(setting)) return;

  const pbr = material.pbrMetallicRoughness;
  if (!pbr) return;

  try {
    if (material && !nativeMrTextureByMaterial.has(material)) {
      const baked = pbr.metallicRoughnessTexture?.texture ?? null;
      if (baked) nativeMrTextureByMaterial.set(material, baked);
    }
  } catch {
    // Optional texture access
  }

  // Passthrough — Material Inspector is authoritative.
  setting = stripTransparencyOverridesForOpaqueSlot(
    setting,
    nativeSetting,
    material.name,
  );

  try {
    await material.ensureLoaded?.();
  } catch {
    // Optional lazy material load
  }

  const transmissionHint =
    setting.transmission != null && Number.isFinite(Number(setting.transmission))
      ? Math.min(1, Math.max(0, Number(setting.transmission)))
      : 0;
  const transparentLikeSlot = isTransparentMaterialPart({
    name: material.name,
    opacity: setting.opacity,
    alphaMode: setting.alphaMode,
    transmission: setting.transmission,
    metalness: setting.metalness,
    roughness: setting.roughness,
    baseColor: setting.baseColor,
  });
  // Metals + alpha BLEND both kill refraction visually; dielectric transmit path
  // needs opaque alpha for KHR_materials_transmission to show through.
  const transmitting = transmissionHint > 0.02;
  let alpha =
    setting.opacity != null && Number.isFinite(Number(setting.opacity))
      ? Math.min(1, Math.max(0, Number(setting.opacity)))
      : pbr.baseColorFactor
        ? pbr.baseColorFactor[3]
        : 1;
  if (transmitting) alpha = 1;

  const baseRough = Number(setting.roughness ?? 0.5);
  const blur = Number(setting.reflectionBlur ?? 0);
  let effectiveRough =
    blur > 0.001 ? Math.min(1, Math.max(baseRough, blur)) : baseRough;
  let effectiveMetallic = Number(setting.metalness ?? 0);
  if (setting.type === "gemstone") {
    // Metals kill dielectric transmission / gem fire.
    effectiveMetallic = 0;
  }

  const paddedLogoAlbedo =
    setting.baseColorTexture?.trim() && !isClearedMaterialTexture(setting.baseColorTexture)
      ? await preparePaddedLogoAlbedo(setting.baseColorTexture)
      : null;

  const applyFactors = () => {
    if (!applyMetalRoughness) return;
    if (
      paddedLogoAlbedo &&
      paddedLogoAlbedo !== setting.baseColorTexture &&
      effectiveMetallic < 0.5 &&
      !transmitting
    ) {
      effectiveMetallic = 1;
    }
    if (transmitting) effectiveMetallic = Math.min(effectiveMetallic, 0.05);
    try {
      const mrUrl = setting.metallicRoughnessTexture;
      // If the user is only tweaking roughness/metalness *factors* (no explicit MR
      // texture selected), a baked GLB metallic-roughness texture can still
      // multiply the final roughness and keep the result glossy.
      //
      // For "matte finish" UX, unpin the baked MR texture when:
      // - no MR texture URL is selected, and
      // - user actually changed roughness or metalness from defaults, and
      // - there are no other custom textures on the slot.
      const roughChanged = Math.abs(Number(setting.roughness ?? 0.5) - 0.5) > 0.001;
      const metalChanged = Math.abs(Number(setting.metalness ?? 0) - 0) > 0.001;
      const wantsOverrideBakedMr =
        !force &&
        (!mrUrl || (typeof mrUrl === "string" && !mrUrl.trim())) &&
        !hasCustomMaterialTextures(setting) &&
        (roughChanged || metalChanged);
      // Only SET a map when a URL is present. Never clear on "" — the Materials
      // UI defaults empty textures and would wipe baked GLB maps on every select.
      if (typeof mrUrl === "string" && mrUrl.trim()) {
        // Custom map applied in the texture block below.
      } else if (wantsOverrideBakedMr) {
        // Make factor sliders (especially roughness) visually authoritative.
        pbr.metallicRoughnessTexture?.setTexture?.(null);
      } else if (force) {
        const baked = nativeMrTextureByMaterial.get(material);
        if (baked) pbr.metallicRoughnessTexture?.setTexture?.(baked);
      }
    } catch {
      // Optional
    }
    if (typeof pbr.setMetallicFactor === "function") pbr.setMetallicFactor(effectiveMetallic);
    else pbr.metallicFactor = effectiveMetallic;
    if (typeof pbr.setRoughnessFactor === "function") pbr.setRoughnessFactor(effectiveRough);
    else pbr.roughnessFactor = effectiveRough;
  };

  const [r0, g0, b0] = hexToRgb01(setting.baseColor || "#ffffff");
  // Pure/near-black base + transmission can read as empty holes on actual
  // glass/gem parts. Avoid forcing normal solid materials toward white.
  let r = r0;
  let g = g0;
  let b = b0;
  // Jewelry thin-glass heuristic: dark albedos vanish under transmission, so we
  // used to lift them toward #f7fbff. That washout MUST NOT run for explicit
  // gemstone materials — it turns ruby/sapphire/emerald into white glass.
  if (
    setting.type !== "gemstone" &&
    transparentLikeSlot &&
    transmissionHint > 0.01
  ) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 0.45) {
      const lift = hexToRgb01("#f7fbff");
      r = lift[0];
      g = lift[1];
      b = lift[2];
    }
  }
  const whiteDepth =
    force || shouldApplyMaterialOverride(setting) || hasInspectorExtras(setting)
      ? {
          metalness: effectiveMetallic,
          roughness: effectiveRough,
          albedoScale: 1,
          specularIntensity: Number(setting.specularIntensity ?? 1),
          specularColor: setting.specularColor || "#ffffff",
          specularScale: 1,
          clearcoat: null as number | null,
          clearcoatRoughness: null as number | null,
          envMapScale: 1,
          rescuedCeramic: false,
        }
      : planWhiteProductDepth({
          baseColor: setting.baseColor || "#ffffff",
          metalness: effectiveMetallic,
          roughness: effectiveRough,
          opacity: alpha,
          transmission: transmissionHint,
          hasBaseColorMap: Boolean(
            paddedLogoAlbedo ||
              (setting.baseColorTexture?.trim() && !isClearedMaterialTexture(setting.baseColorTexture)),
          ),
          specularIntensity: Number(setting.specularIntensity ?? 1),
          specularColor: setting.specularColor || "#ffffff",
        });
  effectiveMetallic = whiteDepth.metalness;
  effectiveRough = whiteDepth.roughness;
  r *= whiteDepth.albedoScale;
  g *= whiteDepth.albedoScale;
  b *= whiteDepth.albedoScale;
  pbr.setBaseColorFactor([r, g, b, alpha]);
  applyFactors();

  const [er, eg, eb] = hexToRgb01(setting.emissiveColor || "#000000");
  material.setEmissiveFactor([er, eg, eb]);

  let mapsChanged = false;
  try {
    // "" = leave baked GLB map alone. CLEAR sentinel = explicitly unpin
    // (needed so dark stone maps don't punch holes when Transmission turns on).
    if (isClearedMaterialTexture(setting.baseColorTexture)) {
      pbr.baseColorTexture?.setTexture?.(null);
      mapsChanged = true;
    } else if (setting.baseColorTexture?.trim()) {
      const albedoUri = paddedLogoAlbedo || setting.baseColorTexture;
      const texture = await createViewerTexture(viewer, albedoUri);
      if (texture && typeof pbr.baseColorTexture?.setTexture === "function") {
        pbr.baseColorTexture.setTexture(texture);
        mapsChanged = true;
      } else if (!texture) {
        console.warn("Base color texture create returned null", setting.baseColorTexture.slice(0, 64));
      } else {
        console.warn("Material has no baseColorTexture slot to set");
      }
    }

    if (isClearedMaterialTexture(setting.metallicRoughnessTexture)) {
      pbr.metallicRoughnessTexture?.setTexture?.(null);
      mapsChanged = true;
    } else if (setting.metallicRoughnessTexture?.trim()) {
      const texture = await createViewerTexture(viewer, setting.metallicRoughnessTexture);
      if (texture) {
        pbr.metallicRoughnessTexture.setTexture(texture);
        mapsChanged = true;
      }
    }

    if (isClearedMaterialTexture(setting.normalTexture)) {
      material.normalTexture?.setTexture?.(null);
      mapsChanged = true;
    } else if (setting.normalTexture?.trim()) {
      const texture = await createViewerTexture(viewer, setting.normalTexture);
      if (texture) {
        material.normalTexture.setTexture(texture);
        mapsChanged = true;
      }
    }

    if (isClearedMaterialTexture(setting.emissiveTexture)) {
      material.emissiveTexture?.setTexture?.(null);
      mapsChanged = true;
    } else if (setting.emissiveTexture?.trim()) {
      const texture = await createViewerTexture(viewer, setting.emissiveTexture);
      if (texture) {
        material.emissiveTexture.setTexture(texture);
        mapsChanged = true;
      }
    }

    if (isClearedMaterialTexture(setting.occlusionTexture)) {
      material.occlusionTexture?.setTexture?.(null);
      mapsChanged = true;
    } else if (setting.occlusionTexture?.trim()) {
      const texture = await createViewerTexture(viewer, setting.occlusionTexture);
      if (texture) {
        material.occlusionTexture.setTexture(texture);
        mapsChanged = true;
      }
    }

    // Bump maps are not part of glTF / model-viewer Material API — apply on
    // this slot's Three.js meshes (including parts without UVs).
    const bumpScale = resolveViewerBumpScale(
      setting.bumpScale != null && Number.isFinite(Number(setting.bumpScale))
        ? Number(setting.bumpScale)
        : 1,
    );
    const bumpCleared = isClearedMaterialTexture(setting.bumpTexture);
    const bumpUri = bumpCleared ? "" : String(setting.bumpTexture || "").trim();
    let bumpThreeTex: any = null;
    if (bumpUri) {
      const softness = resolveViewerBumpSoftness(setting.bumpSoftness);
      let applyUri = bumpUri;
      if (softness > 0.01) {
        try {
          applyUri = await softenTextureUri(bumpUri, softness);
        } catch (err) {
          console.warn("Bump softness blur failed", err);
        }
      }
      bumpThreeTex = await loadCachedBumpThreeTexture(viewer, applyUri, softness);
      if (!bumpThreeTex) {
        console.warn("Bump map texture create/extract failed", bumpUri.slice(0, 64));
      }
    }

    const normalScale =
      setting.normalScale != null && Number.isFinite(Number(setting.normalScale))
        ? Math.max(0, Number(setting.normalScale))
        : 1;
    const aoIntensity =
      setting.occlusionStrength != null && Number.isFinite(Number(setting.occlusionStrength))
        ? Math.max(0, Math.min(1, Number(setting.occlusionStrength)))
        : 1;

    try {
      if (bumpCleared || bumpThreeTex) {
        applyBumpToSlotMeshes(
          viewer,
          material,
          bumpThreeTex,
          bumpScale,
          bumpCleared,
          setting.bumpMapTransform,
        );
      }
      const backing = getThreeBackingMaterials(material, viewer);
      for (const threeMat of backing) {
        if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) continue;
        if (typeof threeMat.uuid !== "string") continue;
        const roughChanged = Math.abs(Number(setting.roughness ?? 0.5) - 0.5) > 0.001;
        const metalChanged = Math.abs(Number(setting.metalness ?? 0) - 0) > 0.001;
        const mrUrl = String(setting.metallicRoughnessTexture || "");
        const wantsOverrideBakedMr =
          !force &&
          !mrUrl.trim() &&
          !hasCustomMaterialTextures(setting) &&
          (roughChanged || metalChanged);

        if (wantsOverrideBakedMr) {
          threeMat.metalnessMap = null;
          threeMat.roughnessMap = null;
        }

        if (isClearedMaterialTexture(setting.normalTexture)) {
          threeMat.normalMap = null;
        }
        if (isClearedMaterialTexture(setting.occlusionTexture)) {
          threeMat.aoMap = null;
        }
        if (isClearedMaterialTexture(setting.emissiveTexture)) {
          threeMat.emissiveMap = null;
        }
        if (isClearedMaterialTexture(setting.metallicRoughnessTexture)) {
          threeMat.metalnessMap = null;
          threeMat.roughnessMap = null;
        }
        if (isClearedMaterialTexture(setting.baseColorTexture)) {
          threeMat.map = null;
        }

        if (threeMat.normalScale) {
          if (typeof threeMat.normalScale.set === "function") {
            threeMat.normalScale.set(normalScale, normalScale);
          } else {
            threeMat.normalScale.x = normalScale;
            threeMat.normalScale.y = normalScale;
          }
        }

        if ("aoMapIntensity" in threeMat) {
          threeMat.aoMapIntensity = aoIntensity;
        }

        maybeApplyMapTransform(threeMat.map, setting.baseColorMapTransform, setting.baseColorTexture);
        maybeApplyMapTransform(
          threeMat.metalnessMap,
          setting.metallicRoughnessMapTransform,
          setting.metallicRoughnessTexture,
        );
        maybeApplyMapTransform(
          threeMat.roughnessMap,
          setting.metallicRoughnessMapTransform,
          setting.metallicRoughnessTexture,
        );
        maybeApplyMapTransform(threeMat.normalMap, setting.normalMapTransform, setting.normalTexture);
        maybeApplyMapTransform(
          threeMat.emissiveMap,
          setting.emissiveMapTransform,
          setting.emissiveTexture,
        );
        maybeApplyMapTransform(threeMat.aoMap, setting.occlusionMapTransform, setting.occlusionTexture);
        maybeApplyMapTransform(threeMat.bumpMap, setting.bumpMapTransform, setting.bumpTexture);

        threeMat.needsUpdate = true;
        mapsChanged = true;
      }
    } catch (error) {
      console.warn("Bump / normalScale Three apply failed", error);
    }
  } catch (error) {
    console.warn("Material texture override failed", error);
  }

  try {
    applyBaseColorUvPlacement(viewer, material, setting);
  } catch {
    // Optional
  }

  const resolvedAlphaMode = transmitting
    ? "OPAQUE"
    : setting.alphaMode || undefined;
  if (resolvedAlphaMode && typeof material.setAlphaMode === "function") {
    material.setAlphaMode(resolvedAlphaMode);
  }

  const transmission =
    setting.transmission != null && Number.isFinite(Number(setting.transmission))
      ? Math.min(1, Math.max(0, Number(setting.transmission)))
      : null;
  const ior =
    setting.ior != null && Number.isFinite(Number(setting.ior))
      ? Math.min(3.5, Math.max(1, Number(setting.ior)))
      : null;
  const thickness =
    setting.thickness != null && Number.isFinite(Number(setting.thickness))
      ? Math.min(5, Math.max(0, Number(setting.thickness)))
      : null;

  // Refraction / clearcoat / physical specular work only on MeshPhysicalMaterial.
  // Generic GLB slots are often MeshStandardMaterial — upgrade this slot before
  // applying those controls so the inspector behaves consistently.
  const needsPhysicalBackend =
    setting.type === "gemstone" ||
    (setting.dispersion != null && Number(setting.dispersion) > 0.0001) ||
    (transmission != null && transmission > 0.001) ||
    (ior != null && Math.abs(ior - 1.5) > 0.001) ||
    (thickness != null && thickness > 0.001) ||
    (setting.attenuationDistance != null &&
      Number.isFinite(Number(setting.attenuationDistance)) &&
      Number(setting.attenuationDistance) > 0) ||
    Boolean(setting.attenuationColor && setting.attenuationColor !== "#ffffff") ||
    (setting.clearcoat != null && Number(setting.clearcoat) > 0.001) ||
    (setting.clearcoatRoughness != null && Number(setting.clearcoatRoughness) > 0.001) ||
    (setting.specularIntensity != null && Math.abs(Number(setting.specularIntensity) - 1) > 0.001) ||
    Boolean(setting.specularColor && setting.specularColor !== "#ffffff") ||
    Boolean(
      setting.reflectionTint &&
        String(setting.reflectionTint).trim().toLowerCase() !== "#ffffff",
    ) ||
    (setting.reflectionIntensity != null &&
      Math.abs(Number(setting.reflectionIntensity) - 1) > 0.001) ||
    (setting.envMapIntensity != null && Math.abs(Number(setting.envMapIntensity) - 1) > 0.001) ||
    whiteDepth.rescuedCeramic;

  if (needsPhysicalBackend) {
    try {
      ensurePhysicalBackingForRefraction(material, viewer);
    } catch {
      // Optional
    }
  }

  // Jewelry thin-wall soft-cap is for thin glass shells only.
  // Faceted gemstones use a dedicated milder transmission/thickness path so
  // attenuation absorption and facet contrast remain visible.
  const isGemstone = setting.type === "gemstone";
  const gemThinWall =
    !isGemstone &&
    transmission != null &&
    transmission > 0.01 &&
    (thickness == null || thickness <= 0.4);

  const appliedTransmission =
    transmission == null
      ? null
      : isGemstone
        ? resolveGemstoneTransmissionFactor(transmission, setting.gemstoneType)
        : resolveWebTransmissionFactor(transmission, { thinWall: Boolean(gemThinWall) });

  if (appliedTransmission != null) {
    // Activates KHR_materials_transmission path on model-viewer / Physical mats.
    ensureModelViewerKhrTransmission(material, appliedTransmission);
  }

  if (ior != null) {
    try {
      material.setIor?.(ior);
    } catch {
      // Optional
    }
  }

  const appliedThickness = isGemstone
    ? resolveGemstoneRuntimeThickness(viewer, material, thickness)
    : thickness == null
      ? null
      : gemThinWall
        ? 0
        : thickness;

  if (appliedThickness != null) {
    try {
      material.setThicknessFactor?.(appliedThickness);
    } catch {
      // Optional
    }
  }

  const hasExplicitAttenuationDistance =
    setting.attenuationDistance != null &&
    Number.isFinite(Number(setting.attenuationDistance)) &&
    Number(setting.attenuationDistance) > 0;
  const hasExplicitAttenuationColor = Boolean(
    setting.attenuationColor &&
      String(setting.attenuationColor).trim().toLowerCase() !== "#ffffff",
  );
  // Never auto-tint gemstones — presets own attenuationColor / distance.
  const shouldAutoTintTransmission = Boolean(
    !isGemstone &&
      appliedTransmission != null &&
      appliedTransmission > 0.01 &&
      !hasExplicitAttenuationDistance &&
      !hasExplicitAttenuationColor &&
      String(setting.baseColor || "").trim() &&
      String(setting.baseColor || "").trim().toLowerCase() !== "#ffffff",
  );
  const autoAttenuationDistance = shouldAutoTintTransmission
    ? gemThinWall
      ? 0.35
      : 1
    : null;
  const effectiveAttenuationDistance =
    setting.attenuationDistance != null ? setting.attenuationDistance : autoAttenuationDistance;
  // Gemstones: scale attenuation to mesh optical thickness (fixes pink plastic on mm stones).
  const threeAttenuation = isGemstone
    ? resolveGemstoneAttenuationDistanceForThree(
        effectiveAttenuationDistance,
        Number(appliedThickness) || GEMSTONE_ATTENUATION_REFERENCE_THICKNESS,
        setting.gemstoneType,
      )
    : resolveAttenuationDistanceForThree(effectiveAttenuationDistance);
  if (threeAttenuation != null) {
    try {
      material.setAttenuationDistance?.(threeAttenuation);
    } catch {
      // Optional
    }
  }

  let attenRgb: [number, number, number] | null = null;
  const attenuationColorToApply = shouldAutoTintTransmission
    ? setting.baseColor || "#ffffff"
    : setting.attenuationColor;
  if (attenuationColorToApply) {
    try {
      const rgb = hexToRgb01(attenuationColorToApply);
      attenRgb = [rgb[0], rgb[1], rgb[2]];
      material.setAttenuationColor?.(attenRgb);
    } catch {
      // Optional
    }
  }

  const specularBase = Number(setting.specularIntensity ?? 1);
  const fresnel = Number(setting.fresnelStrength ?? 1);
  const specularTintSource = whiteDepth.rescuedCeramic
    ? whiteDepth.specularColor
    : setting.specularColor || "#ffffff";
  const tinted = tintHex(
    specularTintSource,
    setting.reflectionTint || "#ffffff",
  );
  // Specular tint must stay independent of Reflection Intensity. Intensity 0
  // should dim the HDRI, not erase Reflection Color.
  let specularEffective = Math.min(
    1,
    Math.max(0, specularBase * fresnel * (whiteDepth.specularScale ?? 1)),
  );
  if (whiteDepth.rescuedCeramic) {
    specularEffective = Math.max(specularEffective, whiteDepth.specularIntensity);
  }
  const [sr, sg, sb] = hexToRgb01(tinted);
  try {
    material.setSpecularFactor?.(specularEffective);
    material.setSpecularColorFactor?.([sr, sg, sb]);
  } catch {
    // Optional
  }

  const clearcoat =
    setting.clearcoat != null && Number.isFinite(Number(setting.clearcoat))
      ? Math.min(1, Math.max(0, Number(setting.clearcoat)))
      : whiteDepth.clearcoat;
  if (clearcoat != null) {
    try {
      material.setClearcoatFactor?.(clearcoat);
    } catch {
      // Optional
    }
  }
  const clearcoatRoughness =
    setting.clearcoatRoughness != null && Number.isFinite(Number(setting.clearcoatRoughness))
      ? Math.min(1, Math.max(0, Number(setting.clearcoatRoughness)))
      : whiteDepth.clearcoatRoughness;
  if (clearcoatRoughness != null) {
    try {
      material.setClearcoatRoughnessFactor?.(clearcoatRoughness);
    } catch {
      // Optional
    }
  }

  // Thin transmitting shells must stay FrontSide — double-sided gems vanish.
  const forceFrontForTransmit = Boolean(
    appliedTransmission != null && appliedTransmission > 0.01,
  );
  const doubleSidedEffective = forceFrontForTransmit
    ? false
    : setting.doubleSided != null
      ? Boolean(setting.doubleSided)
      : null;
  if (doubleSidedEffective != null) {
    try {
      if (typeof material.setDoubleSided === "function") {
        material.setDoubleSided(doubleSidedEffective);
      }
    } catch {
      // Optional
    }
  }

  // Keep correlated Three mats in sync after in-place Physical promote
  // (model-viewer facade can lag or leave dead Standard props).
  try {
    const backing = getThreeBackingMaterials(material, viewer);
    for (const threeMat of backing) {
      if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) continue;
      if (typeof threeMat.uuid !== "string") continue;
      if (threeMat.color?.setRGB) {
        threeMat.color.setRGB(r, g, b);
      }
      if ("opacity" in threeMat) threeMat.opacity = alpha;
      // Physical transmission is NOT alpha blending. transparent=true on a white
      // gem turns the stone into milky plastic and skips the refraction pass.
      const usePhysicalTx =
        Boolean(threeMat.isMeshPhysicalMaterial) &&
        appliedTransmission != null &&
        appliedTransmission > 0.001;
      if ("transparent" in threeMat) {
        threeMat.transparent = usePhysicalTx ? false : alpha < 0.999;
      }
      if (usePhysicalTx && "depthWrite" in threeMat) {
        threeMat.depthWrite = setting.depthWrite !== false;
      }
      if ("metalness" in threeMat) threeMat.metalness = effectiveMetallic;
      if ("roughness" in threeMat) threeMat.roughness = effectiveRough;
      if ("clearcoat" in threeMat && clearcoat != null) threeMat.clearcoat = clearcoat;
      if ("clearcoatRoughness" in threeMat && clearcoatRoughness != null) {
        threeMat.clearcoatRoughness = clearcoatRoughness;
      }
      if ("specularIntensity" in threeMat) threeMat.specularIntensity = specularEffective;
      if (threeMat.specularColor?.setRGB) {
        threeMat.specularColor.setRGB(sr, sg, sb);
      }
      if (appliedTransmission != null && "transmission" in threeMat) {
        threeMat.transmission = appliedTransmission;
      }
      if (appliedThickness != null && "thickness" in threeMat) {
        threeMat.thickness = appliedThickness;
      }
      if (threeAttenuation != null && "attenuationDistance" in threeMat) {
        threeMat.attenuationDistance = threeAttenuation;
      }
      if (ior != null && "ior" in threeMat) threeMat.ior = ior;
      if (forceFrontForTransmit && "side" in threeMat) threeMat.side = 0; // FrontSide
      if (attenRgb && threeMat.attenuationColor?.setRGB) {
        threeMat.attenuationColor.setRGB(attenRgb[0], attenRgb[1], attenRgb[2]);
      }
      threeMat.needsUpdate = true;
    }
  } catch {
    // Optional
  }

  // Gemstone fire / optics on the real model-viewer backing materials.
  try {
    if (setting.type === "gemstone") {
      applyGemstoneOpticsToBacking(material, {
        dispersion: clampDispersion(setting.dispersion ?? 0),
        gemstoneType: setting.gemstoneType,
        viewer,
      });
      // When GemRenderer owns the mesh, skip legacy optical approximation.
      if (!isGemRendererActiveForProduct()) {
        const scene = getViewerThreeScene(viewer);
        applyGemstoneOpticalApproximationToBacking(
          material,
          resolveGemstoneOpticsApproxParams({
            gemstoneType: setting.gemstoneType,
            ior: setting.ior ?? ior,
            transmission: appliedTransmission,
            attenRgb,
            baseRgb: [r, g, b],
          }),
          {
            sceneEnvironment: scene?.environment ?? null,
            viewer,
          },
        );
      }
      if (typeof window !== "undefined") {
        (window as any).__AR360_PROBE_GEM__ = () =>
          probeGemstoneOpticalBacking(material, {
            sceneEnvironment: getViewerThreeScene(viewer)?.environment ?? null,
          });
      }
    } else {
      disableGemstoneOpticalApproximationOnBacking(material);
      if (setting.dispersion != null && Number.isFinite(Number(setting.dispersion))) {
        applyGemstoneOpticsToBacking(material, {
          dispersion: clampDispersion(setting.dispersion),
          gemstoneType: null,
          viewer,
        });
      }
    }
  } catch {
    // Optional
  }

  if (
    typeof window !== "undefined" &&
    setting.type === "gemstone" &&
    ((window as any).__AR360_GEMSTONE_DEBUG__ || process.env.NODE_ENV === "development")
  ) {
    try {
      const backing = getThreeBackingMaterials(material, viewer)[0];
      const snap = {
        gemstoneType: setting.gemstoneType,
        ui: {
          baseColor: setting.baseColor,
          transmission: setting.transmission,
          thickness: setting.thickness,
          attenuationColor: setting.attenuationColor,
          attenuationDistance: setting.attenuationDistance,
          dispersion: setting.dispersion,
          ior: setting.ior,
          envMapIntensity: setting.envMapIntensity,
          reflectionIntensity: setting.reflectionIntensity,
        },
        applied: {
          transmission: appliedTransmission,
          thickness: appliedThickness,
          attenuationDistance: threeAttenuation,
          attenRgb,
          baseRgb: [r, g, b],
        },
        runtime: backing
          ? {
              type: backing.type,
              isPhysical: Boolean(backing.isMeshPhysicalMaterial),
              color: backing.color
                ? [backing.color.r, backing.color.g, backing.color.b]
                : null,
              metalness: backing.metalness,
              roughness: backing.roughness,
              transmission: backing.transmission,
              ior: backing.ior,
              thickness: backing.thickness,
              attenuationDistance: backing.attenuationDistance,
              attenuationColor: backing.attenuationColor
                ? [
                    backing.attenuationColor.r,
                    backing.attenuationColor.g,
                    backing.attenuationColor.b,
                  ]
                : null,
              dispersion: "dispersion" in backing ? backing.dispersion : undefined,
              iridescence: "iridescence" in backing ? backing.iridescence : undefined,
              envMapIntensity: backing.envMapIntensity,
              specularIntensity: backing.specularIntensity,
              clearcoat: backing.clearcoat,
              clearcoatRoughness: backing.clearcoatRoughness,
              gemOpticsApprox: Boolean(
                backing.userData?.ar360GemOpticsV6 ||
                  backing.userData?.ar360GemOpticsV5 ||
                  backing.userData?.ar360GemOpticsV4 ||
                  backing.userData?.ar360GemOpticsV3 ||
                  backing.userData?.ar360GemOpticsV2 ||
                  backing.userData?.ar360GemOpticsV1,
              ),
              gemOpticsEnabled: Number(backing.userData?.ar360GemEnabled) || 0,
              gemTransmitKeep: Number(backing.userData?.ar360GemTransmitKeep) || 0,
              gemBounce: Number(backing.userData?.ar360GemBounce) || 0,
              gemOuterCrush: Number(backing.userData?.ar360GemOuterCrush) || 0,
              gemSparkle: Number(backing.userData?.ar360GemSparkle) || 0,
              gemDebugMode: Number(backing.userData?.ar360GemDebugMode) || 0,
              gemHookOurs:
                backing.onBeforeCompile ===
                backing.userData?.ar360GemOnBeforeCompileRef,
              gemLastInject: backing.userData?.ar360GemLastInject ?? null,
              materialEnvMap: Boolean(backing.envMap),
              sceneEnvironment: Boolean(getViewerThreeScene(viewer)?.environment),
            }
          : null,
      };
      console.debug("[ar360:gemstone]", snap);
      (window as any).__AR360_LAST_GEMSTONE__ = snap;
    } catch {
      // Optional
    }
  }

  // Prefer model-viewer material APIs only. Avoid mid-loop Three dual-writes —
  // they force shader rebuilds and flood WebGL "useProgram: program not valid".
  try {
    if (
      Number.isFinite(Number(setting.envMapIntensity)) ||
      Number.isFinite(Number(setting.reflectionIntensity)) ||
      whiteDepth.envMapScale !== 1
    ) {
      const backing = getThreeBackingMaterials(material, viewer);
      const envBase = Number(setting.envMapIntensity ?? 1);
      const envMulLive = Number(setting.reflectionIntensity ?? 1);
      const tintedEnv = tintHex(
        setting.specularColor || "#ffffff",
        setting.reflectionTint || "#ffffff",
      );
      const tintLive =
        String(tintedEnv || "#ffffff").trim().toLowerCase() !== "#ffffff";
      // Gemstones: boost envMapIntensity so internal CubeUV bounce samples stay bright.
      // Outer Physical specular is crushed in the gem shader — do not starve env.
      const gemEnvScale = isGemstone ? 1.75 : 1;
      const envIntensity = Math.max(
        0,
        envBase *
          (tintLive ? Math.max(0.45, envMulLive) : envMulLive) *
          whiteDepth.envMapScale *
          gemEnvScale,
      );
      for (const threeMat of backing) {
        if (!threeMat?.isMeshStandardMaterial && !threeMat?.isMeshPhysicalMaterial) continue;
        if (typeof threeMat.uuid !== "string") continue;
        try {
          if ("envMapIntensity" in threeMat) threeMat.envMapIntensity = envIntensity;
        } catch {
          // Skip broken Three handles
        }
      }
    }
  } catch {
    // Optional
  }

  applyMeshFlagsForMaterial(viewer, index, {
    castShadow: setting.castShadow,
    receiveShadow: setting.receiveShadow,
    renderOrder: setting.renderOrder,
  });
}

function fingerprintMaterialSettings(
  settings?: Record<number, MaterialSetting> | null,
): string {
  if (!settings) return "";
  const texSig = (url?: string) => {
    const value = String(url || "");
    if (!value) return "0";
    if (isClearedMaterialTexture(value)) return "clear";
    // Content-stable without stringifying multi-MB data URLs every render.
    return `${value.length}:${value.slice(0, 40)}:${value.slice(-20)}`;
  };

  return Object.keys(settings)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const s = settings[Number(key)];
      if (!s) return "";
      return [
        key,
        s.type === "gemstone" ? "gem" : "std",
        s.gemstoneType || "",
        s.dispersion ?? "",
        s.baseColor || "",
        s.metalness ?? "",
        s.roughness ?? "",
        s.emissiveColor || "",
        texSig(s.baseColorTexture),
        texSig(s.metallicRoughnessTexture),
        texSig(s.normalTexture),
        texSig(s.emissiveTexture),
        texSig(s.occlusionTexture),
        texSig(s.bumpTexture),
        s.bumpScale ?? "",
        s.bumpSoftness ?? "",
        textureTransformSig(s.baseColorMapTransform),
        textureTransformSig(s.metallicRoughnessMapTransform),
        textureTransformSig(s.normalMapTransform),
        textureTransformSig(s.emissiveMapTransform),
        textureTransformSig(s.occlusionMapTransform),
        textureTransformSig(s.bumpMapTransform),
        s.normalScale ?? "",
        s.occlusionStrength ?? "",
        s.baseColorTexCoord ?? 0,
        s.baseColorTexOffsetU ?? 0,
        s.baseColorTexOffsetV ?? 0,
        s.baseColorTexScaleU ?? 1,
        s.baseColorTexScaleV ?? 1,
        s.baseColorTexRotation ?? 0,
        s.baseColorTexFlipU ? 1 : 0,
        s.baseColorTexFlipV ? 1 : 0,
        s.opacity ?? "",
        s.alphaMode || "",
        s.transmission ?? "",
        s.ior ?? "",
        s.thickness ?? "",
        s.attenuationDistance ?? "",
        s.attenuationColor || "",
        s.clearcoat ?? "",
        s.clearcoatRoughness ?? "",
        s.specularIntensity ?? "",
        s.specularColor || "",
        s.envMapIntensity ?? "",
        s.reflectionIntensity ?? "",
        s.reflectionBlur ?? "",
        s.reflectionTint || "",
        s.fresnelStrength ?? "",
        s.logoLayer?.image ? texSig(s.logoLayer.image) : "0",
        s.logoLayer?.scale ?? "",
        s.logoLayer?.offsetX ?? "",
        s.logoLayer?.offsetY ?? "",
        s.logoLayer?.rotation ?? "",
        s.logoLayer?.opacity ?? "",
        s.logoLayer?.mode ?? "",
        s.logoLayer?.blendMode ?? "",
        s.castShadow === false ? "0" : "1",
        s.receiveShadow === false ? "0" : "1",
        s.renderOrder ?? "",
      ].join("~");
    })
    .filter(Boolean)
    .join("|");
}

/** Maps / transmission only — factor slider drags must not retrigger full apply. */
function fingerprintHeavyMaterialSettings(
  settings?: Record<number, MaterialSetting> | null,
): string {
  if (!settings) return "";
  const texSig = (url?: string) => {
    const value = String(url || "");
    if (!value) return "0";
    if (isClearedMaterialTexture(value)) return "clear";
    return `${value.length}:${value.slice(0, 40)}:${value.slice(-20)}`;
  };

  return Object.keys(settings)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const s = settings[Number(key)];
      if (!s) return "";
      return [
        key,
        s.type === "gemstone" ? "gem" : "std",
        s.gemstoneType || "",
        s.dispersion ?? "",
        texSig(s.baseColorTexture),
        texSig(s.metallicRoughnessTexture),
        texSig(s.normalTexture),
        texSig(s.emissiveTexture),
        texSig(s.occlusionTexture),
        texSig(s.bumpTexture),
        s.bumpScale ?? "",
        s.bumpSoftness ?? "",
        textureTransformSig(s.baseColorMapTransform),
        textureTransformSig(s.metallicRoughnessMapTransform),
        textureTransformSig(s.normalMapTransform),
        textureTransformSig(s.emissiveMapTransform),
        textureTransformSig(s.occlusionMapTransform),
        textureTransformSig(s.bumpMapTransform),
        s.alphaMode || "",
        s.transmission ?? "",
        s.ior ?? "",
        s.thickness ?? "",
        s.attenuationDistance ?? "",
        s.attenuationColor || "",
        s.logoLayer?.image ? texSig(s.logoLayer.image) : "0",
        s.logoLayer?.rotation ?? "",
        s.logoLayer?.opacity ?? "",
        s.logoLayer?.mode ?? "",
        s.logoLayer?.blendMode ?? "",
      ].join("~");
    })
    .filter(Boolean)
    .join("|");
}

const ModelViewer = forwardRef<any, Props>(function ModelViewer(
  {
    src,
    poster,
    loading = "eager",

    exposure = 0.9,
    skyboxImage,
    environmentImage = "neutral",
    environmentTint = "#ffffff",
    environmentSaturation = 1,
    toneMapping = "commerce",
    backgroundColor = "#F0F2F5",
    transparent = false,
    shadowIntensity = 1.25,
    shadowSoftness = 0.7,

    autoRotate = true,
    cameraControls = true,
    disableZoom = false,
    disableTap = true,
    showArButton = true,
    interactionPrompt = true,
    autoPlay = true,
    arPlacement = "floor",
    realScale = false,
    modelScale = null,
    iosSrc,
    modelUnit = "auto",
    onModelScaleResolved,
    fov = 45,
    cameraOrbit,
    cameraTarget,

    selectedMaterialIndex,
    highlightMaterialIndex = null,
    baseColor,
    metalness,
    roughness,
    emissiveColor,
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    occlusionStrength,
    bumpTexture,
    bumpScale,
    bumpSoftness,
    opacity,
    alphaMode,
    transmission,
    ior,
    thickness,
    clearcoat,
    clearcoatRoughness,
    specularIntensity,
    specularColor,
    envMapIntensity,
    reflectionIntensity,
    reflectionBlur,
    reflectionTint,
    fresnelStrength,
    allMaterialSettings,

    hotspots = [],
    logoDecals = [],

    pickHotspot = false,
    onHotspotPicked,

    pickLogoDecal = false,
    onLogoDecalPicked,

    onMaterialPicked,

    onMaterialsLoaded,
    onModelReady,
    onLoadProgress,
    onModelError,
    disableMaterialOverrides = false,
    showLoadProgress = true,
    productId,
    variantId,
    environmentRotation,
    forwardedRef,
  },
  ref,
) {
  const materialSettingsFingerprint = fingerprintMaterialSettings(allMaterialSettings);
  const materialMapsFingerprint = fingerprintHeavyMaterialSettings(allMaterialSettings);
  const localRef = useRef<any>(null);
  const [viewerElement, setViewerElement] = useState<any>(null);
  const [runtimeSrc, setRuntimeSrc] = useState<string | undefined>(undefined);
  const [viewerReady, setViewerReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [modelLoading, setModelLoading] = useState(true);
  const [resolvedScale, setResolvedScale] = useState(1);
  const [gemMeshHintsState, setGemMeshHintsState] = useState<string[]>([]);
  const [materialNamesState, setMaterialNamesState] = useState<string[]>([]);
  const [threeScene, setThreeScene] = useState<any>(null);
  // Drop missing posters so model-viewer does not spam 404s in the console.
  const [safePoster, setSafePoster] = useState<string | undefined>(poster);
  const onMaterialsLoadedRef = useRef(onMaterialsLoaded);
  const onModelReadyRef = useRef(onModelReady);
  const onLoadProgressRef = useRef(onLoadProgress);
  const onModelErrorRef = useRef(onModelError);
  const onModelScaleResolvedRef = useRef(onModelScaleResolved);
  const lastMaterialsSignatureRef = useRef("");
  const readySrcRef = useRef<string | undefined>(undefined);
  const nativeMaterialsRef = useRef<Record<number, MaterialSetting>>({});
  const materialApplyGenerationRef = useRef(0);
  /** Slots that currently have an applied override (for restore on clear/variant switch). */
  const lastAppliedOverrideIndicesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const raw = String(poster || "").trim();
    if (!raw || isClearedMaterialTexture(raw)) {
      setSafePoster(undefined);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    // Fetch (not <img>) so missing posters don't spam Failed-to-load via model-viewer.
    setSafePoster(undefined);
    void (async () => {
      try {
        const response = await fetch(raw, { credentials: "include", cache: "force-cache" });
        if (!response.ok || cancelled) return;
        const blob = await response.blob();
        if (cancelled) return;
        if (!blob.type.startsWith("image/") && blob.size < 32) return;
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setSafePoster(objectUrl);
      } catch {
        // Missing / forbidden poster — leave unset.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [poster]);

  useEffect(() => {
    return () => {
      revokeViewerTextureBlobUrls();
    };
  }, []);

  useEffect(() => {
    setModelLoading(true);
    setLoadProgress(0);
    setResolvedScale(1);
    if (productId) deactivateGemProduct(productId);
    setGemMeshHintsState([]);
    setMaterialNamesState([]);
    setThreeScene(null);
  }, [runtimeSrc, productId]);

  useEffect(() => {
    return () => {
      if (productId) deactivateGemProduct(productId);
    };
  }, [productId]);

  const setRef = useCallback(
    (node: any) => {
      if (node) {
        setViewerElement(node);
        localRef.current = node;
        if (ref) {
          if (typeof ref === "function") {
            ref(node);
          } else {
            (ref as any).current = node;
          }
        }
        if (forwardedRef) {
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else {
            (forwardedRef as any).current = node;
          }
        }
      }
    },
    [ref, forwardedRef],
  );

  useEffect(() => {
    onMaterialsLoadedRef.current = onMaterialsLoaded;
    onModelReadyRef.current = onModelReady;
    onModelScaleResolvedRef.current = onModelScaleResolved;
    onLoadProgressRef.current = onLoadProgress;
    onModelErrorRef.current = onModelError;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadModelViewerOnce() {
      if (typeof window === "undefined") return;

      configureModelViewerDecoders();

      const w = window as typeof window & {
        __ar360ModelViewerReady?: boolean;
        __ar360ModelViewerLoading?: boolean;
        __ar360ModelViewerCallbacks?: Array<() => void>;
      };

      if (customElements.get("model-viewer") || w.__ar360ModelViewerReady) {
        w.__ar360ModelViewerReady = true;
        if (!cancelled) setViewerReady(true);
        return;
      }

      if (w.__ar360ModelViewerLoading) {
        await new Promise<void>((resolve) => {
          w.__ar360ModelViewerCallbacks ??= [];
          w.__ar360ModelViewerCallbacks.push(resolve);
        });
        return;
      }

      w.__ar360ModelViewerLoading = true;

      try {
        configureModelViewerDecoders();
        // Performance Sprint 9:
        // Use the installed npm package instead of loading model-viewer from
        // unpkg at runtime. This removes an external network dependency, makes
        // production builds more deterministic, and lets Next.js cache/bundle it.
        await import("@google/model-viewer");
      } catch (error) {
        console.error("model-viewer package failed to load", error);
      } finally {
        if (!cancelled) {
          w.__ar360ModelViewerReady = Boolean(customElements.get("model-viewer"));
          setViewerReady(w.__ar360ModelViewerReady);
        }

        w.__ar360ModelViewerLoading = false;
        const callbacks = w.__ar360ModelViewerCallbacks || [];
        w.__ar360ModelViewerCallbacks = [];
        callbacks.forEach((callback) => callback());
      }
    }

    void loadModelViewerOnce();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!src) {
      setRuntimeSrc(undefined);
      return () => {
        cancelled = true;
      };
    }

    // Resolve exactly one stable source per model. Protected models are fetched
    // once and cached as a session-long object URL. We deliberately do not
    // revoke it during React effect cleanup/Strict Mode remounts.
    void getStableModelSource(src)
      .then((resolved) => {
        if (!cancelled) setRuntimeSrc(resolved);
      })
      .catch((error) => {
        console.error("Model source loading failed", error);
        if (!cancelled) {
          setRuntimeSrc(undefined);
          onModelErrorRef.current?.(new Event("error"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    lastMaterialsSignatureRef.current = "";
    readySrcRef.current = undefined;
    nativeMaterialsRef.current = {};
    lastAppliedOverrideIndicesRef.current = new Set();
  }, [src]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer || !runtimeSrc) return;
    // Keep property in sync for custom-element attribute timing.
    viewer.withCredentials = isProtectedAssetUrl(runtimeSrc);
  }, [viewerElement, runtimeSrc]);

  // model-viewer often ignores React attribute updates after mount — set JS props.
  // Keep lighting/controls separate from camera framing so unrelated edits don't
  // re-apply a stale orbit and snap the user's rotation a few seconds later.
  useEffect(() => {
    const viewer = viewerElement as (HTMLElement & {
      exposure?: number;
      shadowIntensity?: number;
      shadowSoftness?: number;
      cameraControls?: boolean;
    }) | null;
    if (!viewer) return;

    const nextExposure = Number(exposure);
    const nextShadowIntensity = Number(shadowIntensity);
    const nextShadowSoftness = Number(shadowSoftness);

    try {
      if (Number.isFinite(nextExposure)) viewer.exposure = nextExposure;
    } catch {
      // ignore
    }
    try {
      if (Number.isFinite(nextShadowIntensity)) viewer.shadowIntensity = nextShadowIntensity;
    } catch {
      // ignore
    }
    try {
      if (Number.isFinite(nextShadowSoftness)) viewer.shadowSoftness = nextShadowSoftness;
    } catch {
      // ignore
    }
    try {
      if (cameraControls) {
        viewer.cameraControls = true;
        viewer.setAttribute("camera-controls", "");
      }
      if (disableZoom) {
        viewer.setAttribute("disable-zoom", "");
      } else {
        viewer.removeAttribute("disable-zoom");
      }
      if (disableTap) {
        (viewer as HTMLElement & { disableTap?: boolean }).disableTap = true;
        viewer.setAttribute("disable-tap", "");
      } else {
        (viewer as HTMLElement & { disableTap?: boolean }).disableTap = false;
        viewer.removeAttribute("disable-tap");
      }
    } catch {
      // ignore
    }

    if (Number.isFinite(nextExposure)) viewer.setAttribute("exposure", String(nextExposure));
    if (Number.isFinite(nextShadowIntensity)) {
      viewer.setAttribute("shadow-intensity", String(nextShadowIntensity));
    }
    if (Number.isFinite(nextShadowSoftness)) {
      viewer.setAttribute("shadow-softness", String(nextShadowSoftness));
    }
  }, [
    viewerElement,
    exposure,
    shadowIntensity,
    shadowSoftness,
    cameraControls,
    disableZoom,
    disableTap,
  ]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;
    try {
      ensureStudioFormLights(viewer);
    } catch {
      // Optional
    }
    try {
      applyEnvironmentGrade(viewer, environmentTint, environmentSaturation);
    } catch {
      // Optional
    }
  }, [viewerElement, environmentTint, environmentSaturation, runtimeSrc]);

  const lastAppliedOrbitRef = useRef<string>("");
  const lastAppliedTargetRef = useRef<string>("");
  const lastAppliedFovRef = useRef<string>("");

  useEffect(() => {
    const viewer = viewerElement as (HTMLElement & {
      cameraOrbit?: string;
      cameraTarget?: string;
      fieldOfView?: string;
      getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null;
      getAttribute?: (name: string) => string | null;
    }) | null;
    if (!viewer) return;

    try {
      const nextOrbit = String(cameraOrbit || "").trim();
      if (nextOrbit) {
        const attr = String(viewer.getAttribute?.("camera-orbit") || viewer.cameraOrbit || "").trim();
        const live = viewer.getCameraOrbit?.();
        // Re-apply when React orbit matches last write but the DOM still has a
        // temporary pull-back (poster) or other desynced radius.
        const attrMismatch = Boolean(attr && attr !== nextOrbit);
        let liveMismatch = false;
        if (live && Number.isFinite(live.radius)) {
          const m = nextOrbit.match(/([\d.]+)\s*m\s*$/i);
          const expectedM = m ? Number(m[1]) : NaN;
          if (Number.isFinite(expectedM) && expectedM > 0) {
            liveMismatch = Math.abs(live.radius - expectedM) / expectedM > 0.15;
          }
        }
        if (nextOrbit !== lastAppliedOrbitRef.current || attrMismatch || liveMismatch) {
          lastAppliedOrbitRef.current = nextOrbit;
          viewer.cameraOrbit = nextOrbit;
          viewer.setAttribute("camera-orbit", nextOrbit);
        }
      }
    } catch {
      // ignore
    }
    try {
      const nextTarget = String(cameraTarget || "").trim();
      if (nextTarget && nextTarget !== lastAppliedTargetRef.current) {
        lastAppliedTargetRef.current = nextTarget;
        viewer.cameraTarget = nextTarget;
        viewer.setAttribute("camera-target", nextTarget);
      }
    } catch {
      // ignore
    }
    try {
      const nextFov = `${fov}deg`;
      if (nextFov !== lastAppliedFovRef.current) {
        lastAppliedFovRef.current = nextFov;
        viewer.fieldOfView = nextFov;
        viewer.setAttribute("field-of-view", nextFov);
      }
    } catch {
      // ignore
    }
  }, [viewerElement, cameraOrbit, cameraTarget, fov]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;
    const color = transparent ? "transparent" : backgroundColor;
    viewer.style.background = color;
    viewer.style.backgroundColor = color;
    viewer.style.setProperty("--poster-color", color);

    if (!transparent) return;
    // model-viewer rewrites opaque clear often; keep alpha open for Studio AR video.
    return startModelViewerTransparentClearLoop(viewer);
  }, [viewerElement, backgroundColor, transparent]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;

    const handleLoad = () => {
      setModelLoading(false);
      setLoadProgress(100);

      // Drop baked-in studio floor meshes so the shadow controls only ever
      // change the shadow, never reveal a grey slab under the product.
      try {
        hideBackdropPlanes(viewer);
      } catch (error) {
        console.warn("Backdrop plane cleanup skipped", error);
      }
      try {
        ensureStudioFormLights(viewer);
      } catch (error) {
        console.warn("Studio form lights skipped", error);
      }
      try {
        applyEnvironmentGrade(viewer, environmentTint, environmentSaturation);
      } catch (error) {
        console.warn("Environment grade skipped", error);
      }

      // Apply real-world AR scale before framing / activateAR.
      // Measure at identity scale so re-runs don't compound getDimensions().
      void (async () => {
        try {
          const identity = formatModelViewerScale(1);
          viewer.setAttribute?.("scale", identity);
          try {
            viewer.scale = identity;
          } catch {
            // attribute is enough on most builds
          }
          try {
            await viewer.updateComplete;
          } catch {
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }

          const dims = viewer.getDimensions?.();
          const scale = resolveArModelScale({
            unit: modelUnit,
            scale: modelScale,
            maxDimension: maxModelDimension(dims),
            minDimension: minModelDimension(dims),
          });
          const attr = formatModelViewerScale(scale);
          viewer.setAttribute?.("scale", attr);
          try {
            viewer.scale = attr;
          } catch {
            // attribute is enough on most builds
          }
          setResolvedScale(scale);
          onModelScaleResolvedRef.current?.(scale);
        } catch (error) {
          console.warn("AR model scale resolve failed", error);
          setResolvedScale(1);
        }
      })();

      const modelMaterials = viewer.model?.materials || [];
      // One-shot Standard→Physical upgrade so Refraction Transmission works on
      // any slot without mid-slider mesh rebinds (which made gem parts vanish).
      try {
        for (const mvMat of modelMaterials) {
          ensurePhysicalBackingForRefraction(mvMat, viewer);
        }
      } catch {
        // Optional
      }
      const nativeSettings = snapshotNativeMaterialsFromViewer(viewer);
      const sceneNames = collectMaterialSceneNames(viewer);
      const gemMeshHints = listGemOrGlassNameHints(sceneNames.allMeshNames);

      const list = modelMaterials.map((m: any, index: number) => {
        const name = m.name || `Material ${index}`;
        const relatedNames = sceneNames.relatedNamesByIndex[index] || [];
        // Single baked material + "Diamond" child mesh ≠ safe to enable transparency
        // on the whole ring (gold would go clear too). Require a real material split.
        const relatedForDetect = modelMaterials.length > 1 ? relatedNames : [];
        const isLogoTarget =
          /logo|brand|print|decal|label|mark|uv|id[_\s-]*2/i.test(name);
        const native = nativeSettings[index];

        return {
          index,
          name,
          relatedNames,
          isLogoTarget,
          isTransparentPart: isTransparentMaterialPart({
            name,
            relatedNames: relatedForDetect,
            opacity: native?.opacity,
            alphaMode: native?.alphaMode,
            transmission: native?.transmission,
            metalness: native?.metalness,
            roughness: native?.roughness,
            baseColor: native?.baseColor,
          }),
        };
      });

      const materialsSignature = list
          .map((material) => `${material.index}:${material.name}:${material.isTransparentPart ? 1 : 0}:${(material.relatedNames || []).join(",")}`)
          .join("|");

      if (materialsSignature !== lastMaterialsSignatureRef.current) {
        lastMaterialsSignatureRef.current = materialsSignature;
        nativeMaterialsRef.current = nativeSettings;
        setGemMeshHintsState(gemMeshHints);
        setMaterialNamesState(list.map((m) => m.name));
        try {
          setThreeScene(getViewerThreeScene(viewer));
        } catch {
          setThreeScene(null);
        }
        onMaterialsLoadedRef.current?.(list, nativeSettings, { gemMeshHints });
      }

      if (readySrcRef.current !== runtimeSrc) {
        readySrcRef.current = runtimeSrc;
        void onModelReadyRef.current?.();
      }
    };

    viewer.addEventListener("load", handleLoad);

    if (viewer.loaded) {
      handleLoad();
    }

    return () => {
      viewer.removeEventListener("load", handleLoad);
    };
  }, [runtimeSrc, viewerElement, viewerReady, modelScale, modelUnit]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;

    const handleProgress = (event: Event) => {
      const progressEvent = event as CustomEvent<{ totalProgress?: number }>;
      const progress = progressEvent.detail?.totalProgress ?? 0;
      const percent = Math.round(progress * 100);
      setLoadProgress(percent);
      if (percent >= 100) {
        setModelLoading(false);
      }
      onLoadProgressRef.current?.(percent);
    };

    const handleError = (event: Event) => {
      if (viewer.loaded) {
        return;
      }

      const detail = (event as CustomEvent<{ message?: string; sourceError?: unknown }>).detail;
      const message =
        detail?.message ||
        (detail?.sourceError instanceof Error ? detail.sourceError.message : undefined) ||
        (typeof detail?.sourceError === "string" ? detail.sourceError : undefined);

      // Intermediate decode errors often report "Cannot read properties of undefined (reading 'scene')".
      // Only surface real load failures; ignore transient scene races while the model is still loading.
      const isTransientSceneError =
        typeof message === "string" && /reading 'scene'|reading \"scene\"/i.test(message);

      if (!isTransientSceneError) {
        console.error("ModelViewer load error", message || detail || event);
      }
      onModelErrorRef.current?.(event);
    };

    viewer.addEventListener("progress", handleProgress);
    viewer.addEventListener("error", handleError);

    return () => {
      viewer.removeEventListener("progress", handleProgress);
      viewer.removeEventListener("error", handleError);
    };
  }, [runtimeSrc, viewerElement, viewerReady]);

  useEffect(() => {
    if (disableMaterialOverrides) return;
    const viewer = viewerElement;
    if (!viewer?.loaded || !viewer.model?.materials) return;
    const overrides = buildMaterialOverrideMap({
      allMaterialSettings,
      nativeMaterials: nativeMaterialsRef.current,
      selectedMaterialIndex,
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      opacity,
      specularIntensity,
      specularColor,
      envMapIntensity,
      reflectionIntensity,
      reflectionBlur,
      reflectionTint,
      fresnelStrength,
      clearcoat,
      clearcoatRoughness,
    });
    const index =
      selectedMaterialIndex != null && Number.isFinite(Number(selectedMaterialIndex))
        ? Number(selectedMaterialIndex)
        : 0;
    const setting = overrides[index];
    if (!setting) return;
    applyLivePbrFactors(viewer, index, setting);
  }, [
    disableMaterialOverrides,
    viewerElement,
    viewerReady,
    selectedMaterialIndex,
    baseColor,
    metalness,
    roughness,
    emissiveColor,
    opacity,
    specularIntensity,
    specularColor,
    envMapIntensity,
    reflectionIntensity,
    reflectionBlur,
    reflectionTint,
    fresnelStrength,
    clearcoat,
    clearcoatRoughness,
    materialSettingsFingerprint,
  ]);

  useEffect(() => {
    if (disableMaterialOverrides) return;
    const viewer = viewerElement;
    if (!viewer) return;

    const liveInput = {
      allMaterialSettings,
      nativeMaterials: nativeMaterialsRef.current,
      selectedMaterialIndex,
      baseColor,
      metalness,
      roughness,
      emissiveColor,
      baseColorTexture,
      metallicRoughnessTexture,
      normalTexture,
      emissiveTexture,
      occlusionTexture,
      occlusionStrength,
      bumpTexture,
      bumpScale,
      bumpSoftness,
      opacity,
      alphaMode,
      transmission,
      ior,
      thickness,
      clearcoat,
      clearcoatRoughness,
      specularIntensity,
      specularColor,
      envMapIntensity,
      reflectionIntensity,
      reflectionBlur,
      reflectionTint,
      fresnelStrength,
    };

    // Apply Fit / Scale / Rotation immediately on already-loaded maps (overrides only).
    if (viewer.loaded && viewer.model?.materials) {
      const overrides = buildMaterialOverrideMap(liveInput);
      for (const indexKey of Object.keys(overrides)) {
        const index = Number(indexKey);
        if (!Number.isFinite(index)) continue;
        applyExistingMapTransforms(viewer, index, overrides[index]);
      }
      try {
        viewer.requestUpdate?.();
      } catch {
        // Optional
      }
    }

    let cancelled = false;
    const applyGeneration = (materialApplyGenerationRef.current += 1);

    async function applyMaterial() {
      await viewer.updateComplete;
      if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
      if (!viewer.loaded || !viewer.model?.materials) return;

      requestAnimationFrame(async () => {
        if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
        if (!viewer.loaded || !viewer.model?.materials) return;

        const overrides = buildMaterialOverrideMap(liveInput);

        if (!Object.keys(nativeMaterialsRef.current).length) {
          nativeMaterialsRef.current = snapshotNativeMaterialsFromViewer(viewer);
        }
        const native = nativeMaterialsRef.current;
        const previous = lastAppliedOverrideIndicesRef.current;
        const nextIndices = new Set(
          Object.keys(overrides)
            .map((key) => Number(key))
            .filter((index) => Number.isFinite(index)),
        );
        const toRestore = [...previous].filter((index) => !nextIndices.has(index));

        // Leave the GLB exactly as loaded when there is nothing to apply or restore.
        if (nextIndices.size === 0 && toRestore.length === 0) {
          lastAppliedOverrideIndicesRef.current = nextIndices;
          return;
        }

        for (const index of nextIndices) {
          applyExistingMapTransforms(viewer, index, overrides[index]);
        }
        try {
          viewer.requestUpdate?.();
        } catch {
          // Optional
        }

        // Restore slots that lost their override (variant switch / clear) back to
        // the GLB-native snapshot — never invent a generic material.
        for (const index of toRestore) {
          if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
          const setting = native[index];
          if (!setting) continue;
          await applyMaterialSettingToSlot(viewer, index, setting, true, true, setting);
          if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
        }

        for (const index of nextIndices) {
          if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
          const override = overrides[index];
          if (!override) continue;
          await applyMaterialSettingToSlot(
            viewer,
            index,
            override,
            true,
            false,
            native[index],
          );
          if (cancelled || applyGeneration !== materialApplyGenerationRef.current) return;
        }

        lastAppliedOverrideIndicesRef.current = nextIndices;

        try {
          viewer.requestUpdate?.();
        } catch {
          // Optional
        }
        try {
          ensureStudioFormLights(viewer);
        } catch {
          // Optional
        }
        try {
          applyEnvironmentGrade(viewer, environmentTint, environmentSaturation);
        } catch {
          // Optional
        }
      });
    }

    const handleModelLoad = () => {
      void applyMaterial();
    };

    viewer.addEventListener("load", handleModelLoad);
    if (viewer.loaded) {
      void applyMaterial();
    }

    return () => {
      cancelled = true;
      viewer.removeEventListener("load", handleModelLoad);
    };
  }, [
    selectedMaterialIndex,
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    occlusionStrength,
    bumpTexture,
    bumpScale,
    bumpSoftness,
    alphaMode,
    transmission,
    ior,
    thickness,
    // Variation switching changes metalness/roughness/baseColor factors too.
    // If we don't re-run this full-slot apply, non-selected slots can retain
    // the previous variation's factors.
    materialSettingsFingerprint,
    materialMapsFingerprint,
    environmentTint,
    environmentSaturation,
    disableMaterialOverrides,
    runtimeSrc,
    viewerReady,
    viewerElement,
  ]);

  // Material-select highlight pulse removed — concurrent emissive writes raced
  // material re-apply and could trigger WebGL "program not valid" storms.
  useEffect(() => {
    // Intentionally empty (highlightMaterialIndex retained for API compat).
  }, [highlightMaterialIndex]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;

    function handleClick(event: MouseEvent) {
      if (!pickHotspot && !pickLogoDecal) return;

      const hit = viewer.positionAndNormalFromPoint(
        event.clientX,
        event.clientY,
      );

      if (!hit?.position) return;

      const p = hit.position;
      const n = hit.normal || { x: 0, y: 1, z: 0 };

      const position = `${p.x.toFixed(3)}m ${p.y.toFixed(3)}m ${p.z.toFixed(
        3,
      )}m`;
      const normal = `${n.x.toFixed(3)}m ${n.y.toFixed(3)}m ${n.z.toFixed(3)}m`;

      if (pickLogoDecal) {
        onLogoDecalPicked?.({ position, normal });
        return;
      }

      onHotspotPicked?.(position);
    }

    viewer.addEventListener("click", handleClick);

    return () => {
      viewer.removeEventListener("click", handleClick);
    };
  }, [pickHotspot, pickLogoDecal, onHotspotPicked, onLogoDecalPicked, viewerElement, viewerReady]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer || !onMaterialPicked) return;

    const CLICK_MOVE_PX = 6;
    let down: { x: number; y: number } | null = null;
    let dragged = false;

    const pickAt = (event: MouseEvent) => {
      const clientX = event.clientX;
      const clientY = event.clientY;
      let hitMaterial: any = null;
      try {
        hitMaterial = viewer.materialFromPoint?.(clientX, clientY);
      } catch {
        return;
      }
      if (!hitMaterial) return;

      const materials = viewer.model?.materials;
      if (!Array.isArray(materials) || materials.length === 0) return;

      let index =
        typeof hitMaterial.index === "number" && Number.isFinite(hitMaterial.index)
          ? hitMaterial.index
          : materials.indexOf(hitMaterial);

      if (index < 0 || index >= materials.length) {
        index = materials.findIndex((m: any) => m === hitMaterial);
      }
      if (index < 0 || index >= materials.length) return;

      let hit: {
        x: number;
        y: number;
        z: number;
        uuid?: string;
        additive?: boolean;
        object?: any;
      } | undefined;
      try {
        const world = pickWorldHit(viewer, clientX, clientY);
        if (world) {
          hit = {
            x: world.x,
            y: world.y,
            z: world.z,
            uuid: world.uuid,
            additive: Boolean(event.shiftKey),
            object: world.object,
          };
        }
      } catch {
        // Focus still works from the material slot alone.
      }
      onMaterialPicked(index, hit);
    };

    function handlePointerDown(event: PointerEvent) {
      if (pickHotspot || pickLogoDecal) return;
      if (event.button !== 2) return;
      down = { x: event.clientX, y: event.clientY };
      dragged = false;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!down) return;
      if ((event.buttons & 2) === 0) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (dx * dx + dy * dy > CLICK_MOVE_PX * CLICK_MOVE_PX) {
        dragged = true;
      }
    }

    function handlePointerUp(event: PointerEvent) {
      if (!down) return;
      const wasDrag = dragged;
      down = null;
      dragged = false;
      if (pickHotspot || pickLogoDecal) return;
      if (event.button !== 2) return;
      if (wasDrag) return;
      pickAt(event);
    }

    function handleContextMenu(event: Event) {
      event.preventDefault();
    }

    viewer.addEventListener("pointerdown", handlePointerDown);
    viewer.addEventListener("pointermove", handlePointerMove);
    viewer.addEventListener("pointerup", handlePointerUp);
    viewer.addEventListener("contextmenu", handleContextMenu);

    return () => {
      viewer.removeEventListener("pointerdown", handlePointerDown);
      viewer.removeEventListener("pointermove", handlePointerMove);
      viewer.removeEventListener("pointerup", handlePointerUp);
      viewer.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [onMaterialPicked, pickHotspot, pickLogoDecal, viewerElement, viewerReady]);

  if (!viewerReady || !runtimeSrc) {
    return (
      <div className="h-full w-full animate-pulse rounded-[inherit] bg-slate-100" aria-label="Loading 3D viewer" />
    );
  }

  // Ensure model-viewer always receives a fully-qualified URL.
  // Relative /api/assets/... paths need an origin prefix so the element can
  // fetch with credentials correctly even when running inside a shadow root.
  const absoluteModelSrc = runtimeSrc.startsWith("/")
    ? `${typeof window !== "undefined" ? sanitizeOrigin(window.location.origin) : ""}${runtimeSrc}`
    : runtimeSrc;

  const legacyPackedEnvs = new Set(["sunset", "studio", "city", "warehouse", "forest", "apartment", "default"]);
  const resolveEnvUrl = (value?: string) => {
    if (!value || value === "default") return "neutral";
    if (legacyPackedEnvs.has(value)) return "neutral";
    // Legacy editor saved Radiance HDR as a huge data:/blob URL — that breaks
    // model-viewer on reopen (blank canvas + false "model load failed").
    if (value.startsWith("blob:") || value.startsWith("data:") || value.length > 2048) {
      return "neutral";
    }
    if (value === "neutral") return "neutral";
    if (value.startsWith("/") && typeof window !== "undefined") {
      return `${sanitizeOrigin(window.location.origin)}${value}`;
    }
    return value;
  };

  const safeEnvironmentImage = resolveEnvUrl(environmentImage);
  const safeSkyboxImage = skyboxImage
    ? resolveEnvUrl(
        skyboxImage === "neutral" ? "/hdr/neutral.hdr" : skyboxImage,
      )
    : undefined;

  const sendCredentials =
    isProtectedAssetUrl(absoluteModelSrc) ||
    isProtectedAssetUrl(safeEnvironmentImage) ||
    Boolean(safeSkyboxImage && isProtectedAssetUrl(safeSkyboxImage));

  return (
    <div className="relative h-full w-full min-h-full min-w-full">
    <model-viewer
      ref={setRef}
      src={absoluteModelSrc}
      poster={safePoster}
      loading={loading}
      reveal="auto"
      ar
      ar-modes="webxr scene-viewer quick-look"
      {...(iosSrc
        ? {
            "ios-src": (() => {
              const value = String(iosSrc || "").trim();
              if (!value) return undefined;
              if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("blob:") || value.startsWith("data:")) {
                return value;
              }
              if (value.startsWith("/") && typeof window !== "undefined") {
                return `${sanitizeOrigin(window.location.origin)}${value}`;
              }
              return value;
            })(),
          }
        : {})}
      ar-placement={arPlacement === "wall" ? "wall" : "floor"}
      ar-scale={realScale === true ? "fixed" : "auto"}
      scale={formatModelViewerScale(resolvedScale)}
      exposure={String(exposure)}
      tone-mapping={toneMapping}
      environment-image={safeEnvironmentImage}
      shadow-intensity={String(shadowIntensity)}
      shadow-softness={String(shadowSoftness)}
      field-of-view={`${fov}deg`}
      max-camera-orbit="auto 180deg 900%"
      min-camera-orbit="auto 0deg 95%"
      interpolation-decay="50"
      {...(sendCredentials ? { "with-credentials": true } : {})}
      {...(cameraOrbit ? { "camera-orbit": cameraOrbit } : {})}
      {...(cameraTarget ? { "camera-target": cameraTarget } : {})}
      {...(safeSkyboxImage ? { "skybox-image": safeSkyboxImage } : {})}
      interaction-prompt={interactionPrompt ? "auto" : "none"}
      {...(autoRotate
        ? {
            "auto-rotate": true,
            "auto-rotate-delay": "3000",
            "rotation-per-second": "18deg",
          }
        : {})}
      {...(cameraControls ? { "camera-controls": true } : {})}
      {...(disableZoom ? { "disable-zoom": true } : {})}
      {...(disableTap ? { "disable-tap": true } : {})}
      {...(autoPlay ? { autoplay: true } : {})}
      style={
        {
          display: "block",
          position: "relative",
          width: "100%",
          height: "100%",
          minWidth: "100%",
          minHeight: "100%",
          overflow: "hidden",
          // Let model-viewer own drag gestures; "manipulation" can make embeds feel static.
          touchAction: cameraControls ? "none" : "manipulation",
          cursor: pickHotspot || pickLogoDecal ? "crosshair" : cameraControls ? "grab" : "default",
          background: transparent ? "transparent" : backgroundColor,
          "--poster-color": transparent ? "transparent" : backgroundColor,
        } as CSSProperties
      }
    >
      {/* Hide model-viewer's built-in progress so we never stack two loaders. */}
      <div slot="progress-bar" className="hidden" aria-hidden="true" />
      {showLoadProgress && modelLoading && loadProgress < 100 && (
        <div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: transparent ? "rgba(255,255,255,0.82)" : backgroundColor || "#F0F2F5",
          }}
        >
          <div className="w-[150px] rounded-full border border-slate-100/80 bg-white/95 p-3 text-center shadow-md backdrop-blur-sm">
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#B8FF3C] transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <span className="mt-2 block text-[10px] font-bold text-slate-500">
              Loading {loadProgress}%
            </span>
          </div>
        </div>
      )}
      {showArButton ? (
        <button
          slot="ar-button"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#00B2CA] text-slate-950 px-6 py-3 rounded-full font-black"
        >
          View in AR
        </button>
      ) : (
        // Occupies the default AR slot so model-viewer does not render its
        // built-in cube/viewfinder button when the host provides its own CTA.
        <button
          slot="ar-button"
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
        />
      )}

      {logoDecals.map((decal) => (
        <button
          key={decal.id}
          slot={`hotspot-logo-${decal.id}`}
          data-position={decal.position}
          data-normal={decal.normal}
          className="pointer-events-none border-0 bg-transparent p-0"
          style={{
            width: `${decal.size}px`,
            height: `${decal.size}px`,
            opacity: decal.opacity,
            transform: `translate(-50%, -50%) rotate(${decal.rotation}deg)`,
          }}
          aria-label={decal.name}
        >
          <AppImage
            src={decal.image}
            alt={decal.name}
            className="block h-full w-full object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,.25)]"
            draggable={false}
          />
        </button>
      ))}

      {hotspots.map((hotspot) => (
        <button
          key={hotspot.id}
          slot={`hotspot-${hotspot.id}`}
          data-position={hotspot.position}
          data-normal={hotspot.normal || "0m 1m 0m"}
          type="button"
          className="ar360-hotspot-pin relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#B9FF2C] text-sm font-black text-[#0A0B14] shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
        >
          i
          <span className="ar360-hotspot-card pointer-events-none absolute left-10 top-1/2 z-20 w-56 -translate-y-1/2 rounded-2xl border border-[#E5E5E5] bg-white p-4 text-left opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-opacity duration-150">
            <strong className="ar360-hotspot-card-title block text-sm font-bold text-[#111111]">
              {hotspot.title || "Tag"}
            </strong>
            {hotspot.description ? (
              <span className="ar360-hotspot-card-body mt-1 block text-xs leading-relaxed text-[#525252]">
                {hotspot.description}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </model-viewer>
    <GemRendererOverlay
      viewer={viewerElement}
      scene={threeScene}
      productId={productId}
      variantId={variantId}
      modelUrl={absoluteModelSrc}
      gemMeshHints={gemMeshHintsState}
      materialNames={materialNamesState}
      environmentImage={safeEnvironmentImage}
      exposure={exposure}
      environmentRotation={environmentRotation}
    />
    </div>
  );
});

/** Warm the model-viewer custom element so the editor canvas opens faster. */
export function prefetchModelViewer() {
  if (typeof window === "undefined") return;

  configureModelViewerDecoders();

  const w = window as typeof window & {
    __ar360ModelViewerReady?: boolean;
    __ar360ModelViewerLoading?: boolean;
    __ar360ModelViewerCallbacks?: Array<() => void>;
  };

  if (customElements.get("model-viewer") || w.__ar360ModelViewerReady) {
    w.__ar360ModelViewerReady = true;
    return;
  }

  if (w.__ar360ModelViewerLoading) return;

  w.__ar360ModelViewerLoading = true;
  void import("@google/model-viewer")
    .then(() => {
      w.__ar360ModelViewerReady = Boolean(customElements.get("model-viewer"));
      w.__ar360ModelViewerCallbacks?.forEach((cb) => cb());
      w.__ar360ModelViewerCallbacks = [];
    })
    .catch((error) => {
      console.error("model-viewer package failed to prefetch", error);
    })
    .finally(() => {
      w.__ar360ModelViewerLoading = false;
    });
}

export default ModelViewer;
