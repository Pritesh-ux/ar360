/**
 * Production-facing GemMaterial contracts (POC V5).
 * Physical parameters are separated from render-quality parameters.
 * Not wired into ModelViewer yet.
 */

import type { AccelMode, QualityTier, WavelengthMode } from "./types";

/** Gemstone identity + physical optics (independent of GPU budget). */
export type PhysicalGemParams = {
  gemstoneType: "diamond" | "moissanite" | "cubic-zirconia" | "custom";
  /** Absolute refractive index at green reference (~589 nm). */
  ior: number;
  /** Calibrated dispersion amount (0 = none). */
  dispersion: number;
  /** Beer–Lambert σ per channel (linear). */
  absorption: [number, number, number];
  /**
   * Relative optical path multiplier vs mesh characteristic length.
   * 1.0 = use AABB characteristic length as unit path.
   * Does NOT mean world metres — see scaleThickness docs.
   */
  thickness: number;
  /** Microfacet roughness proxy (env cone only in POC). */
  roughness: number;
};

/** GPU / quality budget only — must not change physical identity. */
export type RenderQualityParams = {
  samplesPerPixel: 1 | 2 | 3;
  wavelengthMode: WavelengthMode;
  internalBounces: number;
  internalResolutionScale: number;
  accelMode: AccelMode;
  earlyTermination: boolean;
  qualityTier: QualityTier;
};

/** Environment coupling (HDRI). */
export type GemEnvironmentParams = {
  /** Equirect HDR URL (e.g. AR360 /hdr/studio.hdr). */
  environmentUrl: string;
  environmentIntensity: number;
  /** Radians about Y. */
  environmentRotation: number;
  exposure: number;
};

/** Full production-facing input object for a future ModelViewer bridge. */
export type GemMaterialInput = {
  physical: PhysicalGemParams;
  quality: RenderQualityParams;
  environment: GemEnvironmentParams;
};

export const DIAMOND_PHYSICAL_DEFAULTS: PhysicalGemParams = {
  gemstoneType: "diamond",
  ior: 2.417,
  dispersion: 0.25,
  absorption: [0.002, 0.002, 0.002],
  thickness: 1,
  roughness: 0.01,
};

export const QUALITY_DESKTOP_MEDIUM: RenderQualityParams = {
  samplesPerPixel: 1,
  wavelengthMode: "rgb3",
  internalBounces: 6,
  internalResolutionScale: 0.75,
  accelMode: "auto",
  earlyTermination: true,
  qualityTier: "medium",
};

export const QUALITY_MOBILE_LOW: RenderQualityParams = {
  samplesPerPixel: 1,
  wavelengthMode: "rgb3",
  internalBounces: 4,
  internalResolutionScale: 0.5,
  accelMode: "auto",
  earlyTermination: true,
  qualityTier: "low",
};

export const QUALITY_REFERENCE: RenderQualityParams = {
  samplesPerPixel: 3,
  wavelengthMode: "rgb3",
  internalBounces: 12,
  internalResolutionScale: 1,
  accelMode: "auto",
  earlyTermination: true,
  qualityTier: "reference",
};

export function splitContractsFromLegacy(params: {
  ior: number;
  dispersion: number;
  absorption: [number, number, number];
  thickness: number;
  roughness: number;
  samplesPerPixel: number;
  wavelengthMode: WavelengthMode;
  internalBounces: number;
  internalResolutionScale: number;
  accelMode: AccelMode;
  earlyTermination: boolean;
  qualityTier: QualityTier;
  environmentIntensity: number;
  environmentRotation: number;
  exposure: number;
  environmentUrl?: string;
}): GemMaterialInput {
  return {
    physical: {
      gemstoneType: "diamond",
      ior: params.ior,
      dispersion: params.dispersion,
      absorption: [...params.absorption] as [number, number, number],
      thickness: params.thickness,
      roughness: params.roughness,
    },
    quality: {
      samplesPerPixel: Math.max(1, Math.min(3, Math.round(params.samplesPerPixel))) as
        | 1
        | 2
        | 3,
      wavelengthMode: params.wavelengthMode,
      internalBounces: params.internalBounces,
      internalResolutionScale: params.internalResolutionScale,
      accelMode: params.accelMode,
      earlyTermination: params.earlyTermination,
      qualityTier: params.qualityTier,
    },
    environment: {
      environmentUrl: params.environmentUrl || "/hdr/studio.hdr",
      environmentIntensity: params.environmentIntensity,
      environmentRotation: params.environmentRotation,
      exposure: params.exposure,
    },
  };
}
