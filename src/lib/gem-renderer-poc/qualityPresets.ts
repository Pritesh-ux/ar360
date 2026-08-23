/**
 * V4 quality presets — performance / quality candidates (measured, adjustable).
 */
import type { GemPocParams, QualityTier } from "./types";
import { REFERENCE_DIAMOND_PARAMS } from "./types";

export type ProductionPresetId =
  | "mobile"
  | "desktop"
  | "desktop-high"
  | "reference";

export type ProductionPreset = {
  id: ProductionPresetId;
  label: string;
  description: string;
  /** Partial applied on top of locked REFERENCE optics. */
  params: Partial<GemPocParams>;
};

const OPTICS_LOCK: Partial<GemPocParams> = {
  ior: 2.417,
  dispersion: 0.25,
  absorption: [0.002, 0.002, 0.002],
  thickness: 1,
  roughness: 0.01,
  environmentIntensity: 1,
  exposure: 1,
  enableAbsorption: true,
  enableRefraction: true,
  wavelengthMode: "rgb3",
  enableDispersion: true,
  earlyTermination: true,
  accelMode: "auto",
  debugMode: "beauty",
  autoRotate: false,
};

/** Starting candidates — adjust after V4 measurement suite. */
export const PRODUCTION_PRESETS: Record<ProductionPresetId, ProductionPreset> = {
  mobile: {
    id: "mobile",
    label: "MOBILE",
    description: "1 spp · 3λ · 4 bounces · 50% internal res · AUTO accel",
    params: {
      ...OPTICS_LOCK,
      samplesPerPixel: 1,
      quality: "low",
      internalBounces: 4,
      internalResolutionScale: 0.5,
      qualityTier: "low",
    },
  },
  desktop: {
    id: "desktop",
    label: "DESKTOP",
    description: "1 spp · 3λ · 6 bounces · 75% internal res · AUTO accel",
    params: {
      ...OPTICS_LOCK,
      samplesPerPixel: 1,
      quality: "low",
      internalBounces: 6,
      internalResolutionScale: 0.75,
      qualityTier: "medium",
    },
  },
  "desktop-high": {
    id: "desktop-high",
    label: "DESKTOP HIGH",
    description: "2 spp · 3λ · 8 bounces · 100% internal res · AUTO accel",
    params: {
      ...OPTICS_LOCK,
      samplesPerPixel: 2,
      quality: "medium",
      internalBounces: 8,
      internalResolutionScale: 1,
      qualityTier: "high",
    },
  },
  reference: {
    id: "reference",
    label: "REFERENCE",
    description: "3 spp · 3λ · 12 bounces · 100% · debug / sign-off",
    params: {
      ...OPTICS_LOCK,
      samplesPerPixel: 3,
      quality: "high",
      internalBounces: 12,
      internalResolutionScale: 1,
      qualityTier: "reference",
    },
  },
};

export function paramsForQualityTier(
  tier: Exclude<QualityTier, "auto">,
): Partial<GemPocParams> {
  if (tier === "low") return { ...PRODUCTION_PRESETS.mobile.params };
  if (tier === "medium") return { ...PRODUCTION_PRESETS.desktop.params };
  if (tier === "high") return { ...PRODUCTION_PRESETS["desktop-high"].params };
  return { ...PRODUCTION_PRESETS.reference.params };
}

export function lockedOpticsBase(): GemPocParams {
  return {
    ...REFERENCE_DIAMOND_PARAMS,
    absorption: [...REFERENCE_DIAMOND_PARAMS.absorption] as [
      number,
      number,
      number,
    ],
  };
}

export const BOUNCE_STUDY_COUNTS = [2, 3, 4, 5, 6, 8, 12] as const;
export const SPP_STUDY_COUNTS = [1, 2, 3] as const;
export const INTERNAL_RES_SCALES = [1, 0.75, 0.66, 0.5] as const;
