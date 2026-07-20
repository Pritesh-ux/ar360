"use client";

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
  shouldApplyMaterialOverride,
} from "@/components/features/editor/utils";
import { isProtectedAssetUrl } from "@/lib/billing/asset-url";
import { snapshotNativeMaterialsFromViewer } from "@/lib/materials/native-snapshot";

export type ViewerMaterial = {
  index: number;
  name: string;
  isLogoTarget: boolean;
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
  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
  logoLayer?: MaterialLogoLayer;
};

type Hotspot = {
  id: string;
  title: string;
  description: string;
  position: string;
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

  exposure?: number;
  skyboxImage?: string;
  environmentImage?: string;
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
  showArButton?: boolean;
  interactionPrompt?: boolean;
  autoPlay?: boolean;
  /** AR surface target: floor (default) or wall. */
  arPlacement?: "floor" | "wall";
  /** When false, AR scale is adjustable (ar-scale=auto). */
  realScale?: boolean;
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
  allMaterialSettings?: Record<number, MaterialSetting>;

  hotspots?: Hotspot[];
  logoDecals?: LogoDecal[];

  pickHotspot?: boolean;
  onHotspotPicked?: (position: string) => void;

  pickLogoDecal?: boolean;
  onLogoDecalPicked?: (point: { position: string; normal: string }) => void;

  onMaterialsLoaded?: (
    materials: ViewerMaterial[],
    nativeSettings: Record<number, MaterialSetting>,
  ) => void;
  onModelReady?: () => void | Promise<void>;
  onLoadProgress?: (progress: number) => void;
  onModelError?: (event: Event) => void;
  /** Skip editor material/texture overrides (landing page previews). */
  disableMaterialOverrides?: boolean;
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

async function resolveTextureUriForViewer(uri: string) {
  const normalized = toCurrentOriginAssetUrl(uri);
  const mimeType = parseImageMimeType(normalized);

  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return { uri: normalized, mimeType };
  }

  if (normalized.startsWith("/api/assets/") && typeof window !== "undefined") {
    const fetchUrl = `${window.location.origin}${normalized}`;
    const response = await fetch(fetchUrl, {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Texture fetch failed (${response.status})`);
    }

    const blob = await response.blob();
    return {
      uri: URL.createObjectURL(blob),
      mimeType: blob.type || mimeType,
    };
  }

  return { uri: normalized, mimeType };
}

async function createViewerTexture(viewer: any, uri?: string) {
  if (!uri?.trim()) return null;

  const previousCredentials = Boolean(viewer.withCredentials);
  viewer.withCredentials = false;

  try {
    const { uri: resolvedUri, mimeType } = await resolveTextureUriForViewer(uri);
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
  w.ModelViewerElement.dracoDecoderLocation = `${window.location.origin}/vendor/draco/gltf/`;
  w.ModelViewerElement.ktx2TranscoderLocation =
    w.ModelViewerElement.ktx2TranscoderLocation ||
    "https://www.gstatic.com/basis-universal/versioned/2021-04-15-ba1c3e4/";
}

function isGlbAssetUrl(url: string) {
  const normalized = url.split("?")[0]?.split("#")[0]?.toLowerCase() || "";
  return normalized.endsWith(".glb");
}

async function fetchProtectedAssetBlob(url: string) {
  const normalized = toCurrentOriginAssetUrl(url);
  const fetchUrl = normalized.startsWith("/")
    ? `${window.location.origin}${normalized}`
    : normalized;

  const response = await fetch(fetchUrl, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Protected asset fetch failed (${response.status})`);
  }

  return URL.createObjectURL(await response.blob());
}

// Keep fetched model object URLs alive for the whole browser session.
// model-viewer/THREE creates its own temporary blob URLs for embedded GLB
// images. Replacing or revoking the parent model URL while those images are
// decoding causes the recurring "Couldn't load texture blob:" error.
const stableModelSourceCache = new Map<string, Promise<string>>();

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

  // For protected /api/assets/... URLs: pass the URL directly to model-viewer
  // with the `with-credentials` attribute instead of pre-fetching into a blob.
  //
  // Rationale: when we convert the GLB to a blob URL, model-viewer internally
  // creates its own temporary blob: URLs for each embedded texture image.
  // If model-viewer detects a src change (e.g. React re-render causes a new
  // string identity even for the same URL), it revokes those internal texture
  // blobs before the GPU finishes uploading them — causing the recurring
  // "Couldn't load texture blob:" error and a completely grey/white model.
  //
  // Passing the authenticated URL directly avoids all blob lifecycle issues:
  // model-viewer manages its own fetch with the session cookie via
  // with-credentials, embedded textures are decoded from the GLB binary buffer
  // (no sub-requests), and nothing is ever revoked externally.
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
      if (url.origin === window.location.origin) {
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
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = uri;
    });
  } catch (err) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = toCurrentOriginAssetUrl(src);
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

  if (setting.baseColorTexture) {
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

  const logoWidth = Math.max(8, size * layer.scale);
  const logoHeight = logoWidth * (logoImg.height / Math.max(1, logoImg.width));
  const x = size / 2 + layer.offsetX * size;
  const y = size / 2 + layer.offsetY * size;

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
}) {
  const settings: Record<number, MaterialSetting> = {};

  for (const [indexKey, setting] of Object.entries(input.allMaterialSettings || {})) {
    if (shouldApplyMaterialOverride(setting)) {
      settings[Number(indexKey)] = setting;
    }
  }

  const live: MaterialSetting = {
    baseColor: input.baseColor || "#ffffff",
    metalness: Number(input.metalness ?? 0),
    roughness: Number(input.roughness ?? 0.5),
    emissiveColor: input.emissiveColor || "#000000",
    baseColorTexture: input.baseColorTexture,
    metallicRoughnessTexture: input.metallicRoughnessTexture,
    normalTexture: input.normalTexture,
    emissiveTexture: input.emissiveTexture,
    occlusionTexture: input.occlusionTexture,
  };

  if (shouldApplyMaterialOverride(live)) {
    const idx = Number(input.selectedMaterialIndex ?? 0);
    settings[idx] = {
      ...settings[idx],
      ...live,
      baseColor: live.baseColor,
      metalness: live.metalness,
      roughness: live.roughness,
      emissiveColor: live.emissiveColor,
    };
  }

  return settings;
}

async function applyMaterialSettingToSlot(
  viewer: any,
  index: number,
  setting: MaterialSetting,
  applyMetalRoughness = true,
) {
  if (!shouldApplyMaterialOverride(setting)) return;

  const material = viewer.model.materials[index];
  if (!material) return;

  const pbr = material.pbrMetallicRoughness;
  const hasTextures = hasCustomMaterialTextures(setting);

  if (hasTextures) {
    const [r, g, b] = hexToRgb01(setting.baseColor || "#ffffff");
    pbr.setBaseColorFactor([r, g, b, 1]);

    if (applyMetalRoughness) {
      pbr.setMetallicFactor(Number(setting.metalness ?? 0));
      pbr.setRoughnessFactor(Number(setting.roughness ?? 0.5));
    }

    const [er, eg, eb] = hexToRgb01(setting.emissiveColor || "#000000");
    material.setEmissiveFactor([er, eg, eb]);

    try {
      if (setting.logoLayer?.image?.trim()) {
        const bakedBaseTexture = await createLogoBakedTexture(setting);
        if (bakedBaseTexture) {
          const texture = await createViewerTexture(viewer, bakedBaseTexture);
          if (texture) pbr.baseColorTexture.setTexture(texture);
        }
      } else if (setting.baseColorTexture?.trim()) {
        const texture = await createViewerTexture(viewer, setting.baseColorTexture);
        if (texture) pbr.baseColorTexture.setTexture(texture);
      }

      if (setting.metallicRoughnessTexture?.trim()) {
        const texture = await createViewerTexture(viewer, setting.metallicRoughnessTexture);
        if (texture) pbr.metallicRoughnessTexture.setTexture(texture);
      }

      if (setting.normalTexture?.trim()) {
        const texture = await createViewerTexture(viewer, setting.normalTexture);
        if (texture) material.normalTexture.setTexture(texture);
      }

      if (setting.emissiveTexture?.trim()) {
        const texture = await createViewerTexture(viewer, setting.emissiveTexture);
        if (texture) material.emissiveTexture.setTexture(texture);
      }

      if (setting.occlusionTexture?.trim()) {
        const texture = await createViewerTexture(viewer, setting.occlusionTexture);
        if (texture) material.occlusionTexture.setTexture(texture);
      }
    } catch (error) {
      console.warn("Material texture override failed", error);
    }
  } else {
    // Factor-only edits: adjust PBR values but keep the GLB's baked textures intact.
    const [r, g, b] = hexToRgb01(setting.baseColor || "#ffffff");
    pbr.setBaseColorFactor([r, g, b, 1]);

    if (applyMetalRoughness) {
      pbr.setMetallicFactor(Number(setting.metalness ?? 0));
      pbr.setRoughnessFactor(Number(setting.roughness ?? 0.5));
    }

    const [er, eg, eb] = hexToRgb01(setting.emissiveColor || "#000000");
    material.setEmissiveFactor([er, eg, eb]);
  }

  viewer.requestUpdate?.();
}

const ModelViewer = forwardRef<any, Props>(function ModelViewer(
  {
    src,
    poster,

    exposure = 0.9,
    skyboxImage,
    environmentImage = "neutral",
    toneMapping = "commerce",
    backgroundColor = "#F0F2F5",
    transparent = false,
    shadowIntensity = 1.25,
    shadowSoftness = 0.7,

    autoRotate = true,
    cameraControls = true,
    disableZoom = false,
    showArButton = true,
    interactionPrompt = true,
    autoPlay = true,
    arPlacement = "floor",
    realScale = true,
    fov = 45,
    cameraOrbit,
    cameraTarget,

    selectedMaterialIndex = 0,
    highlightMaterialIndex = null,
    baseColor = "#ffffff",
    metalness = 0,
    roughness = 0.5,
    emissiveColor = "#000000",
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    allMaterialSettings,

    hotspots = [],
    logoDecals = [],

    pickHotspot = false,
    onHotspotPicked,

    pickLogoDecal = false,
    onLogoDecalPicked,

    onMaterialsLoaded,
    onModelReady,
    onLoadProgress,
    onModelError,
    disableMaterialOverrides = false,
    forwardedRef,
  },
  ref,
) {
  const localRef = useRef<any>(null);
  const [viewerElement, setViewerElement] = useState<any>(null);
  const [runtimeSrc, setRuntimeSrc] = useState<string | undefined>(undefined);
  const [viewerReady, setViewerReady] = useState(false);
  const onMaterialsLoadedRef = useRef(onMaterialsLoaded);
  const onModelReadyRef = useRef(onModelReady);
  const onLoadProgressRef = useRef(onLoadProgress);
  const onModelErrorRef = useRef(onModelError);
  const lastMaterialsSignatureRef = useRef("");
  const readySrcRef = useRef<string | undefined>(undefined);

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
  }, [src]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;

    const handleLoad = () => {
      const modelMaterials = viewer.model?.materials || [];

      const list = modelMaterials.map((m: any, index: number) => {
        const name = m.name || `Material ${index}`;
        const isLogoTarget =
          /logo|brand|print|decal|label|mark|uv|id[_\s-]*2/i.test(name);

        return {
          index,
          name,
          isLogoTarget,
        };
      });

      const materialsSignature = list
          .map((material) => `${material.index}:${material.name}`)
          .join("|");

      if (materialsSignature !== lastMaterialsSignatureRef.current) {
        lastMaterialsSignatureRef.current = materialsSignature;
        const nativeSettings = snapshotNativeMaterialsFromViewer(viewer);
        onMaterialsLoadedRef.current?.(list, nativeSettings);
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
  }, [runtimeSrc, viewerElement, viewerReady]);

  useEffect(() => {
    const viewer = viewerElement;
    if (!viewer) return;

    const handleProgress = (event: Event) => {
      const progressEvent = event as CustomEvent<{ totalProgress?: number }>;
      const progress = progressEvent.detail?.totalProgress ?? 0;
      onLoadProgressRef.current?.(Math.round(progress * 100));
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
    if (!viewer) return;

    let cancelled = false;

    async function applyMaterial() {
      await viewer.updateComplete;
      if (cancelled || !viewer.loaded || !viewer.model?.materials) return;

      requestAnimationFrame(async () => {
        if (cancelled || !viewer.loaded || !viewer.model?.materials) return;

        const settings = buildMaterialOverrideMap({
          allMaterialSettings,
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
        });

        for (const [indexKey, setting] of Object.entries(settings)) {
          if (cancelled) return;
          const index = Number(indexKey);
          const isLiveSlot = index === selectedMaterialIndex;
          await applyMaterialSettingToSlot(
            viewer,
            index,
            setting,
            hasCustomMaterialTextures(setting) || isLiveSlot,
          );
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
    baseColor,
    metalness,
    roughness,
    emissiveColor,
    baseColorTexture,
    metallicRoughnessTexture,
    normalTexture,
    emissiveTexture,
    occlusionTexture,
    allMaterialSettings,
    disableMaterialOverrides,
    runtimeSrc,
    viewerReady,
    viewerElement,
  ]);

  // Soft emissive pulse on material select — no base-color swap (avoids visual jerk).
  useEffect(() => {
    if (disableMaterialOverrides) return;
    const viewer = viewerElement;
    if (!viewer?.model?.materials) return;
    if (highlightMaterialIndex == null || highlightMaterialIndex < 0) return;

    const material = viewer.model.materials[highlightMaterialIndex] as {
      emissiveFactor?: ArrayLike<number>;
      setEmissiveFactor: (v: number[]) => void;
    } | undefined;
    if (!material?.setEmissiveFactor) return;

    const from = material.emissiveFactor
      ? Array.from(material.emissiveFactor)
      : [0, 0, 0];
    const peak = [
      Math.min(1, from[0] + 0.55),
      Math.min(1, from[1] + 0.12),
      Math.min(1, from[2] + 0.08),
    ];

    let frame = 0;
    let cancelled = false;
    const easeInMs = 120;
    const holdMs = 650;
    const easeOutMs = 220;
    const startedAt = performance.now();

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - startedAt;
      let color = from;

      if (elapsed < easeInMs) {
        const t = easeOutCubic(elapsed / easeInMs);
        color = [lerp(from[0], peak[0], t), lerp(from[1], peak[1], t), lerp(from[2], peak[2], t)];
      } else if (elapsed < easeInMs + holdMs) {
        color = peak;
      } else if (elapsed < easeInMs + holdMs + easeOutMs) {
        const t = easeOutCubic((elapsed - easeInMs - holdMs) / easeOutMs);
        color = [lerp(peak[0], from[0], t), lerp(peak[1], from[1], t), lerp(peak[2], from[2], t)];
      } else {
        material.setEmissiveFactor(from);
        return;
      }

      material.setEmissiveFactor(color);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      material.setEmissiveFactor(from);
    };
  }, [highlightMaterialIndex, disableMaterialOverrides, viewerElement]);

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

  if (!viewerReady || !runtimeSrc) {
    return (
      <div className="h-full w-full animate-pulse rounded-[inherit] bg-slate-100" aria-label="Loading 3D viewer" />
    );
  }

  // Ensure model-viewer always receives a fully-qualified URL.
  // Relative /api/assets/... paths need an origin prefix so the element can
  // fetch with credentials correctly even when running inside a shadow root.
  const absoluteModelSrc = runtimeSrc.startsWith("/")
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${runtimeSrc}`
    : runtimeSrc;

  const legacyPackedEnvs = new Set(["sunset", "studio", "city", "warehouse", "forest", "apartment", "default"]);
  const safeEnvironmentImage =
    !environmentImage || legacyPackedEnvs.has(environmentImage) || environmentImage.startsWith("blob:")
      ? "neutral"
      : environmentImage;

  return (
<model-viewer
      ref={setRef}
      src={absoluteModelSrc}
      poster={poster}
      loading="eager"
      reveal="auto"
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-placement={arPlacement === "wall" ? "wall" : "floor"}
      ar-scale={realScale === false ? "auto" : "fixed"}
      exposure={String(exposure)}
      tone-mapping={toneMapping}
      environment-image={safeEnvironmentImage}
      shadow-intensity={String(shadowIntensity)}
      shadow-softness={String(shadowSoftness)}
      field-of-view={`${fov}deg`}
      {...(cameraOrbit ? { "camera-orbit": cameraOrbit } : {})}
      {...(cameraTarget ? { "camera-target": cameraTarget } : {})}
      {...(skyboxImage ? { "skybox-image": skyboxImage } : {})}
      interaction-prompt={interactionPrompt ? "auto" : "none"}
      {...(autoRotate ? { "auto-rotate": true } : {})}
      {...(cameraControls ? { "camera-controls": true } : {})}
      {...(disableZoom ? { "disable-zoom": true } : {})}
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
          touchAction: "manipulation",
          cursor: pickHotspot || pickLogoDecal ? "crosshair" : "default",
          background: transparent ? "transparent" : backgroundColor,
          "--poster-color": transparent ? "transparent" : backgroundColor,
        } as CSSProperties
      }
    >
      {showArButton && (
        <button
          slot="ar-button"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#00B2CA] text-slate-950 px-6 py-3 rounded-full font-black"
        >
          View in AR
        </button>
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
          <img
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
          data-normal="0m 1m 0m"
          className="group relative h-8 w-8 rounded-full bg-[var(--primary)] text-[var(--sidebar)] font-black shadow-[var(--shadow-sm)] border-2 border-[var(--surface)]"
        >
          i
          <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 hidden w-56 rounded-2xl bg-slate-950 text-white p-4 text-left shadow-2xl group-hover:block">
            <strong className="block text-sm">{hotspot.title}</strong>
            <span className="block text-xs text-slate-300 mt-1">
              {hotspot.description}
            </span>
          </span>
        </button>
      ))}
    </model-viewer>
  );
});

export default ModelViewer;
