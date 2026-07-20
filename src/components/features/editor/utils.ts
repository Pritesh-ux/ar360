import type { CSSProperties } from "react";
import { EDITOR_CAMERA_BASE_RADIUS } from "./constants";
import type { MaterialSetting } from "./types";

function normalizeHex(value: unknown, fallback: string) {
  return String(value || fallback).trim().toLowerCase();
}

function isNearNumber(value: unknown, target: number, epsilon = 0.001) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed - target) <= epsilon;
}

function hasTextureUrl(value?: string | null) {
  return Boolean(String(value || "").trim());
}

export function isDefaultMaterialSetting(setting?: Partial<MaterialSetting>) {
  if (!setting) return true;

  return (
    normalizeHex(setting.baseColor, "#ffffff") === "#ffffff" &&
    isNearNumber(setting.metalness, 0) &&
    isNearNumber(setting.roughness, 0.5) &&
    normalizeHex(setting.emissiveColor, "#000000") === "#000000" &&
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
    hasTextureUrl(setting.occlusionTexture)
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

  return (
    normalizeHex(a.baseColor, "#ffffff") === normalizeHex(b.baseColor, "#ffffff") &&
    isNearNumber(a.metalness, Number(b.metalness ?? 0)) &&
    isNearNumber(a.roughness, Number(b.roughness ?? 0.5)) &&
    normalizeHex(a.emissiveColor, "#000000") === normalizeHex(b.emissiveColor, "#000000") &&
    !hasCustomMaterialTextures(a) &&
    !hasCustomMaterialTextures(b)
  );
}

export function compactMaterialSettings(settings: Record<number, MaterialSetting>) {
  return Object.fromEntries(
    Object.entries(settings).filter(([, setting]) => shouldApplyMaterialOverride(setting)),
  ) as Record<number, MaterialSetting>;
}

export function getRangeStyle(value: number, min: number, max: number) {
  const progress = ((value - min) / (max - min)) * 100;

  return {
    "--range-progress": `${Math.max(0, Math.min(100, progress))}%`,
  } as CSSProperties;
}

export function getCameraRadiusForZoom(zoom: number) {
  return Math.round(
    Math.max(10, Math.min(1000, (EDITOR_CAMERA_BASE_RADIUS * 100) / zoom)),
  );
}

export function getEditorCameraOrbit(zoom: number) {
  return `35deg 58deg ${getCameraRadiusForZoom(zoom)}%`;
}
