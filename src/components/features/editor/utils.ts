import type { CSSProperties } from "react";
import {
  EDITOR_CAMERA_RADIUS_AT_0,
  EDITOR_CAMERA_RADIUS_AT_50,
  EDITOR_CAMERA_RADIUS_AT_100,
  EDITOR_ZOOM_SLIDER_CENTER,
  EDITOR_ZOOM_SLIDER_MAX,
  EDITOR_ZOOM_SLIDER_MIN,
} from "./constants";
import type { MaterialSetting } from "./types";
import {
  isDefaultTextureTransform,
  textureTransformSig,
} from "@/lib/materials/texture-transform";

function normalizeHex(value: unknown, fallback: string) {
  return String(value || fallback).trim().toLowerCase();
}

function isNearNumber(value: unknown, target: number, epsilon = 0.001) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed - target) <= epsilon;
}

function hasTextureUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  // Explicit unpin still counts as a material edit (any sentinel form).
  if (raw === "__clear__" || raw === "/__clear__" || raw.endsWith("/__clear__")) {
    return true;
  }
  return true;
}

export function isDefaultMaterialSetting(setting?: Partial<MaterialSetting>) {
  if (!setting) return true;

  // Explicit gemstone category is never "default" — must apply + persist.
  if (setting.type === "gemstone") return false;

  const opacity =
    setting.opacity != null && Number.isFinite(Number(setting.opacity))
      ? Number(setting.opacity)
      : 1;
  const transmission =
    setting.transmission != null && Number.isFinite(Number(setting.transmission))
      ? Number(setting.transmission)
      : 0;
  const alphaMode = String(setting.alphaMode || "OPAQUE").toUpperCase();
  const ior =
    setting.ior != null && Number.isFinite(Number(setting.ior)) ? Number(setting.ior) : 1.5;
  const thickness =
    setting.thickness != null && Number.isFinite(Number(setting.thickness))
      ? Number(setting.thickness)
      : 0;
  const attenuationDistance =
    setting.attenuationDistance != null && Number.isFinite(Number(setting.attenuationDistance))
      ? Number(setting.attenuationDistance)
      : 0;
  const dispersion =
    setting.dispersion != null && Number.isFinite(Number(setting.dispersion))
      ? Number(setting.dispersion)
      : 0;

  return (
    (setting.type == null || setting.type === "standard") &&
    setting.gemstoneType == null &&
    isNearNumber(dispersion, 0) &&
    normalizeHex(setting.baseColor, "#ffffff") === "#ffffff" &&
    isNearNumber(setting.metalness, 0) &&
    isNearNumber(setting.roughness, 0.5) &&
    normalizeHex(setting.emissiveColor, "#000000") === "#000000" &&
    isNearNumber(setting.occlusionStrength ?? 1.0, 1.0) &&
    isNearNumber(opacity, 1) &&
    isNearNumber(transmission, 0) &&
    (setting.ior == null || isNearNumber(ior, 1.5)) &&
    isNearNumber(thickness, 0) &&
    isNearNumber(attenuationDistance, 0) &&
    (setting.attenuationColor == null ||
      normalizeHex(setting.attenuationColor, "#ffffff") === "#ffffff") &&
    (setting.specularIntensity == null || isNearNumber(setting.specularIntensity, 1)) &&
    (setting.specularColor == null ||
      normalizeHex(setting.specularColor, "#ffffff") === "#ffffff") &&
    (setting.envMapIntensity == null || isNearNumber(setting.envMapIntensity, 1)) &&
    (setting.reflectionIntensity == null || isNearNumber(setting.reflectionIntensity, 1)) &&
    (setting.reflectionBlur == null || isNearNumber(setting.reflectionBlur, 0)) &&
    (setting.reflectionTint == null ||
      normalizeHex(setting.reflectionTint, "#ffffff") === "#ffffff") &&
    (setting.fresnelStrength == null || isNearNumber(setting.fresnelStrength, 1)) &&
    (setting.clearcoat == null || isNearNumber(setting.clearcoat, 0)) &&
    (setting.clearcoatRoughness == null || isNearNumber(setting.clearcoatRoughness, 0)) &&
    (setting.normalScale == null || isNearNumber(setting.normalScale, 1)) &&
    (setting.bumpScale == null || isNearNumber(setting.bumpScale, 1)) &&
    (setting.bumpSoftness == null || isNearNumber(setting.bumpSoftness, 0)) &&
    isDefaultTextureTransform(setting.baseColorMapTransform) &&
    isDefaultTextureTransform(setting.metallicRoughnessMapTransform) &&
    isDefaultTextureTransform(setting.normalMapTransform) &&
    isDefaultTextureTransform(setting.emissiveMapTransform) &&
    isDefaultTextureTransform(setting.occlusionMapTransform) &&
    isDefaultTextureTransform(setting.bumpMapTransform) &&
    (setting.doubleSided == null || setting.doubleSided === false) &&
    (setting.depthWrite == null || setting.depthWrite === true) &&
    (setting.depthTest == null || setting.depthTest === true) &&
    (setting.castShadow == null || setting.castShadow === true) &&
    (setting.receiveShadow == null || setting.receiveShadow === true) &&
    (setting.renderOrder == null || isNearNumber(setting.renderOrder, 0)) &&
    alphaMode === "OPAQUE" &&
    !hasCustomMaterialTextures(setting)
  );
}

/** True when the user uploaded textures or a logo — not factor-only slider tweaks. */
export function hasCustomMaterialTextures(setting?: Partial<MaterialSetting>) {
  if (!setting) return false;

  return (
    hasTextureUrl(setting.logoLayer?.image) ||
    hasTextureUrl(setting.baseColorTexture) ||
    hasTextureUrl(setting.metallicRoughnessTexture) ||
    hasTextureUrl(setting.normalTexture) ||
    hasTextureUrl(setting.emissiveTexture) ||
    hasTextureUrl(setting.occlusionTexture) ||
    hasTextureUrl(setting.bumpTexture)
  );
}

export function shouldApplyMaterialOverride(setting?: Partial<MaterialSetting>) {
  if (!setting) return false;
  return hasCustomMaterialTextures(setting) || !isDefaultMaterialSetting(setting);
}

export function materialSettingsMatch(
  a?: Partial<MaterialSetting>,
  b?: Partial<MaterialSetting>,
): boolean {
  if (!a || !b) return false;

  const categoryA = a.type === "gemstone" ? "gemstone" : "standard";
  const categoryB = b.type === "gemstone" ? "gemstone" : "standard";
  const gemA = categoryA === "gemstone" ? a.gemstoneType || "" : "";
  const gemB = categoryB === "gemstone" ? b.gemstoneType || "" : "";

  return (
    categoryA === categoryB &&
    gemA === gemB &&
    isNearNumber(a.dispersion ?? 0, Number(b.dispersion ?? 0)) &&
    normalizeHex(a.baseColor, "#ffffff") === normalizeHex(b.baseColor, "#ffffff") &&
    isNearNumber(a.metalness, Number(b.metalness ?? 0)) &&
    isNearNumber(a.roughness, Number(b.roughness ?? 0.5)) &&
    normalizeHex(a.emissiveColor, "#000000") === normalizeHex(b.emissiveColor, "#000000") &&
    isNearNumber(a.occlusionStrength ?? 1.0, Number(b.occlusionStrength ?? 1.0)) &&
    isNearNumber(a.opacity ?? 1, Number(b.opacity ?? 1)) &&
    isNearNumber(a.transmission ?? 0, Number(b.transmission ?? 0)) &&
    isNearNumber(a.ior ?? 1.5, Number(b.ior ?? 1.5)) &&
    isNearNumber(a.thickness ?? 0, Number(b.thickness ?? 0)) &&
    isNearNumber(a.attenuationDistance ?? 0, Number(b.attenuationDistance ?? 0)) &&
    normalizeHex(a.attenuationColor, "#ffffff") ===
      normalizeHex(b.attenuationColor, "#ffffff") &&
    isNearNumber(a.specularIntensity ?? 1, Number(b.specularIntensity ?? 1)) &&
    normalizeHex(a.specularColor, "#ffffff") === normalizeHex(b.specularColor, "#ffffff") &&
    isNearNumber(a.envMapIntensity ?? 1, Number(b.envMapIntensity ?? 1)) &&
    isNearNumber(a.reflectionIntensity ?? 1, Number(b.reflectionIntensity ?? 1)) &&
    isNearNumber(a.reflectionBlur ?? 0, Number(b.reflectionBlur ?? 0)) &&
    normalizeHex(a.reflectionTint, "#ffffff") === normalizeHex(b.reflectionTint, "#ffffff") &&
    isNearNumber(a.fresnelStrength ?? 1, Number(b.fresnelStrength ?? 1)) &&
    isNearNumber(a.clearcoat ?? 0, Number(b.clearcoat ?? 0)) &&
    isNearNumber(a.clearcoatRoughness ?? 0, Number(b.clearcoatRoughness ?? 0)) &&
    isNearNumber(a.normalScale ?? 1, Number(b.normalScale ?? 1)) &&
    isNearNumber(a.bumpScale ?? 1, Number(b.bumpScale ?? 1)) &&
    isNearNumber(a.bumpSoftness ?? 0, Number(b.bumpSoftness ?? 0)) &&
    textureTransformSig(a.baseColorMapTransform) ===
      textureTransformSig(b.baseColorMapTransform) &&
    textureTransformSig(a.metallicRoughnessMapTransform) ===
      textureTransformSig(b.metallicRoughnessMapTransform) &&
    textureTransformSig(a.normalMapTransform) === textureTransformSig(b.normalMapTransform) &&
    textureTransformSig(a.emissiveMapTransform) === textureTransformSig(b.emissiveMapTransform) &&
    textureTransformSig(a.occlusionMapTransform) ===
      textureTransformSig(b.occlusionMapTransform) &&
    textureTransformSig(a.bumpMapTransform) === textureTransformSig(b.bumpMapTransform) &&
    Boolean(a.doubleSided) === Boolean(b.doubleSided) &&
    (a.depthWrite !== false) === (b.depthWrite !== false) &&
    (a.depthTest !== false) === (b.depthTest !== false) &&
    (a.castShadow !== false) === (b.castShadow !== false) &&
    (a.receiveShadow !== false) === (b.receiveShadow !== false) &&
    isNearNumber(a.renderOrder ?? 0, Number(b.renderOrder ?? 0)) &&
    String(a.alphaMode || "OPAQUE").toUpperCase() ===
      String(b.alphaMode || "OPAQUE").toUpperCase() &&
    !hasCustomMaterialTextures(a) &&
    !hasCustomMaterialTextures(b)
  );
}

export function compactMaterialSettings(settings: Record<number, MaterialSetting>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([, setting]) => shouldApplyMaterialOverride(setting)),
  ) as Record<number, MaterialSetting>;
}

/** Deep-clone so variants never share the same material objects or nested maps. */
export function cloneMaterialSettings(
  settings?: Record<number, MaterialSetting> | null,
): Record<number, MaterialSetting> {
  if (!settings) return {};
  try {
    return JSON.parse(JSON.stringify(settings)) as Record<number, MaterialSetting>;
  } catch {
    return Object.fromEntries(
      Object.entries(settings).map(([key, value]) => [key, { ...value }]),
    ) as Record<number, MaterialSetting>;
  }
}

export function getRangeStyle(value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100;

  return {
    "--range-progress": `${Math.max(0, Math.min(100, progress))}%`,
  } as CSSProperties;
}

function clampZoomSlider(zoom: number) {
  const n = Number(zoom);
  const value = Number.isFinite(n) ? n : EDITOR_ZOOM_SLIDER_CENTER;
  return Math.round(
    Math.max(EDITOR_ZOOM_SLIDER_MIN, Math.min(EDITOR_ZOOM_SLIDER_MAX, value)),
  );
}

export { clampZoomSlider };

/** Distance multiplier for slider zoom (0 = far, 50 = comfortable, 100 = close). */
export function getZoomDistanceFactor(zoom: number): number {
  const t = clampZoomSlider(zoom);
  // Keep max-out framing usable (was 16× and made products a speck).
  const far = 6.5;
  const mid = 2.9;
  const near = 0.85;
  if (t <= EDITOR_ZOOM_SLIDER_CENTER) {
    return far - (far - mid) * (t / EDITOR_ZOOM_SLIDER_CENTER);
  }
  return (
    mid -
    (mid - near) *
      ((t - EDITOR_ZOOM_SLIDER_CENTER) /
        (EDITOR_ZOOM_SLIDER_MAX - EDITOR_ZOOM_SLIDER_CENTER))
  );
}

export function getZoomRadiusMeters(zoom: number, maxDim: number): number {
  const size = Math.max(0.01, Number(maxDim) || 0.01);
  return Number((size * getZoomDistanceFactor(zoom)).toFixed(4));
}

/** Map 0–100 slider → camera-orbit radius % (fallback when dims unknown). */
export function getCameraRadiusForZoom(zoom: number) {
  const t = clampZoomSlider(zoom);
  if (t <= EDITOR_ZOOM_SLIDER_CENTER) {
    const u = t / EDITOR_ZOOM_SLIDER_CENTER;
    return Math.round(
      EDITOR_CAMERA_RADIUS_AT_0 +
        (EDITOR_CAMERA_RADIUS_AT_50 - EDITOR_CAMERA_RADIUS_AT_0) * u,
    );
  }
  const u =
    (t - EDITOR_ZOOM_SLIDER_CENTER) /
    (EDITOR_ZOOM_SLIDER_MAX - EDITOR_ZOOM_SLIDER_CENTER);
  return Math.round(
    EDITOR_CAMERA_RADIUS_AT_50 +
      (EDITOR_CAMERA_RADIUS_AT_100 - EDITOR_CAMERA_RADIUS_AT_50) * u,
  );
}

/** Inverse of getCameraRadiusForZoom. */
export function getZoomFromCameraRadius(radiusPercent: number) {
  const r = Number(radiusPercent);
  if (!Number.isFinite(r) || r <= 0) return EDITOR_ZOOM_SLIDER_CENTER;

  if (r >= EDITOR_CAMERA_RADIUS_AT_50) {
    const span = EDITOR_CAMERA_RADIUS_AT_0 - EDITOR_CAMERA_RADIUS_AT_50;
    const u = span <= 0 ? 1 : (EDITOR_CAMERA_RADIUS_AT_0 - r) / span;
    return clampZoomSlider(u * EDITOR_ZOOM_SLIDER_CENTER);
  }

  const span = EDITOR_CAMERA_RADIUS_AT_50 - EDITOR_CAMERA_RADIUS_AT_100;
  const u = span <= 0 ? 0 : (EDITOR_CAMERA_RADIUS_AT_50 - r) / span;
  return clampZoomSlider(
    EDITOR_ZOOM_SLIDER_CENTER +
      u * (EDITOR_ZOOM_SLIDER_MAX - EDITOR_ZOOM_SLIDER_CENTER),
  );
}

export function getZoomFromCameraOrbit(
  orbit: string | null | undefined,
  dims?: { x: number; y: number; z: number } | null,
): number | null {
  const raw = String(orbit || "").trim();
  if (!raw) return null;

  const metersMatch = raw.match(/([\d.]+)\s*m\s*$/i);
  if (metersMatch && dims) {
    const meters = Number(metersMatch[1]);
    const maxDim = Math.max(
      Number(dims.x) || 0,
      Number(dims.y) || 0,
      Number(dims.z) || 0,
      0.01,
    );
    if (!Number.isFinite(meters) || meters <= 0) return null;
    const factor = meters / maxDim;
    if (factor >= 2.9) {
      const u = (16 - factor) / (16 - 2.9);
      return clampZoomSlider(u * EDITOR_ZOOM_SLIDER_CENTER);
    }
    const u = (2.9 - factor) / (2.9 - 0.65);
    return clampZoomSlider(
      EDITOR_ZOOM_SLIDER_CENTER +
        u * (EDITOR_ZOOM_SLIDER_MAX - EDITOR_ZOOM_SLIDER_CENTER),
    );
  }

  const match = raw.match(/([\d.]+)\s*%\s*$/);
  if (!match) return null;
  const radius = Number(match[1]);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  return getZoomFromCameraRadius(radius);
}

/**
 * Normalize stored zoom (legacy 20–500 or new 0–100) into the 0–100 slider.
 * Wheel/slider deltas must never wrap past 0/100 back to center (50).
 */
export function normalizeEditorZoom(rawZoom: unknown, orbit?: string | null): number {
  const fromOrbit = getZoomFromCameraOrbit(orbit);
  const n = Number(rawZoom);
  if (!Number.isFinite(n)) return fromOrbit ?? EDITOR_ZOOM_SLIDER_CENTER;
  // Hard-clamp edges — never fall back to 50 when underflow/overflow happens.
  if (n > EDITOR_ZOOM_SLIDER_MAX) return EDITOR_ZOOM_SLIDER_MAX;
  if (n < EDITOR_ZOOM_SLIDER_MIN) return EDITOR_ZOOM_SLIDER_MIN;
  return clampZoomSlider(n);
}

type OrbitReader = {
  getCameraOrbit?: () => { theta: number; phi: number; radius: number } | null | undefined;
  getDimensions?: () => { x: number; y: number; z: number } | null | undefined;
  cameraOrbit?: string;
};

/**
 * Change ONLY camera distance. Preserve live theta/phi from model-viewer
 * (numeric rad from getCameraOrbit — never re-parse lossy strings).
 */
export function applyZoomToCameraOrbit(
  zoom: number,
  previousOrbit?: string | null,
  dims?: { x: number; y: number; z: number } | null,
  viewer?: OrbitReader | null,
): string {
  const t = clampZoomSlider(zoom);
  const live = viewer?.getCameraOrbit?.();
  const liveDims = dims || viewer?.getDimensions?.() || null;
  const maxDim = liveDims
    ? Math.max(
        Number(liveDims.x) || 0,
        Number(liveDims.y) || 0,
        Number(liveDims.z) || 0,
        0.01,
      )
    : 1;

  if (
    live &&
    Number.isFinite(live.theta) &&
    Number.isFinite(live.phi)
  ) {
    const meters = getZoomRadiusMeters(t, maxDim);
    return `${live.theta}rad ${live.phi}rad ${meters}m`;
  }

  const parts = String(previousOrbit || viewer?.cameraOrbit || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const isAngle = (part?: string) =>
    Boolean(part && /\d/.test(part) && (part.includes("deg") || part.includes("rad")));
  const theta = isAngle(parts[0]) ? parts[0] : "35deg";
  const phi = isAngle(parts[1]) ? parts[1] : "58deg";

  if (liveDims) {
    return `${theta} ${phi} ${getZoomRadiusMeters(t, maxDim)}m`;
  }
  return `${theta} ${phi} ${getCameraRadiusForZoom(t)}%`;
}

export function getEditorCameraOrbit(zoom: number) {
  return `35deg 58deg ${getCameraRadiusForZoom(zoom)}%`;
}
