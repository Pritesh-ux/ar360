import type { Ar360EnvironmentSource } from "@/lib/gem-renderer-poc/gemHdriContract";

const LEGACY_PACKED = new Set([
  "sunset",
  "studio",
  "city",
  "warehouse",
  "forest",
  "apartment",
  "default",
]);

/** Resolve model-viewer environment-image prop → raw HDR URL for GemRenderer. */
export function resolveGemEnvironmentUrl(
  environmentImage?: string,
  origin?: string,
): string {
  const value = String(environmentImage || "neutral").trim();
  if (!value || value === "default" || LEGACY_PACKED.has(value)) {
    return "/hdr/neutral.hdr";
  }
  if (value === "neutral") return "/hdr/neutral.hdr";
  if (value.startsWith("blob:") || value.startsWith("data:") || value.length > 2048) {
    return "/hdr/neutral.hdr";
  }
  if (value.startsWith("/") && origin) {
    return `${origin.replace(/\/$/, "")}${value}`;
  }
  return value;
}

export function buildAr360EnvironmentSource(input: {
  environmentImage?: string;
  exposure?: number;
  environmentRotation?: number;
  origin?: string;
}): Ar360EnvironmentSource {
  return {
    url: resolveGemEnvironmentUrl(input.environmentImage, input.origin),
    intensity: 1,
    rotationRadians: ((input.environmentRotation ?? 0) * Math.PI) / 180,
    exposure: input.exposure,
  };
}
