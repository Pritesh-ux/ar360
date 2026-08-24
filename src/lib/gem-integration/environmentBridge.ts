import type { Ar360EnvironmentSource } from "@/lib/gem-renderer-poc/gemHdriContract";
import { JEWELRY_STUDIO_LIGHTING } from "@/lib/render/jewelry-studio-lighting";

const LEGACY_PACKED = new Set([
  "sunset",
  "studio",
  "city",
  "warehouse",
  "forest",
  "apartment",
  "default",
  "neutral",
]);

/** Resolve model-viewer / editor environment-image → raw HDR URL for GemRenderer. */
export function resolveGemEnvironmentUrl(
  environmentImage?: string,
  origin?: string,
): string {
  const value = String(environmentImage || "default").trim();
  if (!value || LEGACY_PACKED.has(value)) {
    return JEWELRY_STUDIO_LIGHTING.environmentImage;
  }
  if (value.startsWith("blob:") || value.startsWith("data:") || value.length > 2048) {
    return JEWELRY_STUDIO_LIGHTING.environmentImage;
  }
  if (value.startsWith("/") && origin) {
    return `${origin.replace(/\/$/, "")}${value}`;
  }
  if (value.startsWith("/")) return value;
  return JEWELRY_STUDIO_LIGHTING.environmentImage;
}

export function buildAr360EnvironmentSource(input: {
  environmentImage?: string;
  exposure?: number;
  environmentRotation?: number;
  origin?: string;
  intensity?: number;
  /** Use jewelry studio exposure when editor still on default-ish values. */
  preferJewelryStudioExposure?: boolean;
}): Ar360EnvironmentSource {
  const editorDefault = 0.9;
  let exposure =
    typeof input.exposure === "number" && Number.isFinite(input.exposure)
      ? input.exposure
      : editorDefault;

  if (
    input.preferJewelryStudioExposure !== false &&
    Math.abs(exposure - editorDefault) <= 0.051
  ) {
    exposure = JEWELRY_STUDIO_LIGHTING.exposure;
  }

  return {
    url: resolveGemEnvironmentUrl(input.environmentImage, input.origin),
    intensity:
      typeof input.intensity === "number" && Number.isFinite(input.intensity)
        ? Math.min(3, Math.max(0.1, input.intensity))
        : 1,
    rotationRadians: ((input.environmentRotation ?? 0) * Math.PI) / 180,
    exposure,
  };
}
