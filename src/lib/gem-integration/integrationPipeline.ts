/**
 * Dashboard GemRenderer — reuses POC REFERENCE DIAMOND pipeline.
 * Physical params come from gemMaterialContract (single source of truth).
 */
import type { MaterialSetting } from "@/components/features/editor/types";
import type { GemRenderer } from "@/lib/gem-renderer-poc/GemRenderer";
import type { Ar360EnvironmentSource } from "@/lib/gem-renderer-poc/gemHdriContract";
import { DIAMOND_PHYSICAL_DEFAULTS } from "@/lib/gem-renderer-poc/gemMaterialContract";
import { CALIBRATION_PRESETS } from "@/lib/gem-renderer-poc/presets";
import { paramsForQualityTier } from "@/lib/gem-renderer-poc/qualityPresets";
import type { QualityTier } from "@/lib/gem-renderer-poc/types";
import { mapMaterialSettingToGemPhysicalParams } from "./gemMaterialSync";

/** POC sign-off preset — REFERENCE DIAMOND (locked V2). */
export const INTEGRATION_REFERENCE_CALIBRATION = CALIBRATION_PRESETS.reference;

/** POC reference environment intensity at diamond preset reflection anchor. */
const REFERENCE_ENV_INTENSITY =
  INTEGRATION_REFERENCE_CALIBRATION.params.environmentIntensity;

/** Desktop/editor uses interactive medium tier; mobile stays on bounded low tier. */
export function pickIntegrationQualityTier(
  userAgent?: string,
): Exclude<QualityTier, "auto"> {
  if (typeof window === "undefined" && userAgent == null) return "medium";
  const ua =
    userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (mobile) return "low";
  return "medium";
}

/** Map Material UI reflection controls → GemRenderer intensity (POC baseline). */
export function resolveIntegrationEnvironmentIntensity(
  setting: Partial<MaterialSetting> | null | undefined,
): number {
  if (!setting) return REFERENCE_ENV_INTENSITY;

  const refl = Number(setting.reflectionIntensity);
  if (Number.isFinite(refl) && refl > 0) {
    const anchor = Number(setting.gemstoneType === "diamond" ? 1.18 : 1.05);
    return Math.min(2.5, Math.max(0.25, (refl / anchor) * REFERENCE_ENV_INTENSITY));
  }

  const env = Number(setting.envMapIntensity);
  if (Number.isFinite(env) && env > 0) {
    const anchor = Number(setting.gemstoneType === "diamond" ? 1.55 : 1.15);
    return Math.min(2.5, Math.max(0.25, (env / anchor) * REFERENCE_ENV_INTENSITY));
  }

  return REFERENCE_ENV_INTENSITY;
}

export function resolveIntegrationExposure(env: Ar360EnvironmentSource): number {
  const pocExposure = INTEGRATION_REFERENCE_CALIBRATION.params.exposure;
  const fromEnv = env.exposure ?? pocExposure;
  if (Math.abs(fromEnv - 1.05) <= 0.02) return pocExposure;
  return fromEnv;
}

export function applyIntegrationQualityShell(gem: GemRenderer) {
  const tier = pickIntegrationQualityTier();
  gem.applyQualityTier(tier);
  const ref = INTEGRATION_REFERENCE_CALIBRATION.params;
  gem.setParams({
    ...paramsForQualityTier(tier),
    ...(tier === "reference"
      ? {
          samplesPerPixel: ref.samplesPerPixel,
          internalBounces: ref.internalBounces,
          internalResolutionScale: ref.internalResolutionScale,
          roughness: ref.roughness,
        }
      : {}),
    qualityTier: tier,
    autoRotate: false,
    debugMode: "beauty",
    enableDispersion: true,
    enableRefraction: true,
    enableAbsorption: true,
  });
}

/** Single canonical Material UI → GemRenderer.setParams mapping. */
export function applyIntegrationMaterialParams(
  gem: GemRenderer,
  setting: Partial<MaterialSetting>,
  env: Ar360EnvironmentSource,
) {
  const physical = mapMaterialSettingToGemPhysicalParams(setting);
  gem.setParams({
    ior: physical.ior,
    dispersion: physical.dispersion,
    absorption: physical.absorption,
    thickness: physical.thickness,
    roughness: physical.roughness,
    environmentIntensity: resolveIntegrationEnvironmentIntensity(setting),
    environmentRotation: env.rotationRadians,
    exposure: resolveIntegrationExposure(env),
  });
}

/** Canonical diamond physical defaults for tests / docs. */
export const CANONICAL_DIAMOND_PHYSICAL = DIAMOND_PHYSICAL_DEFAULTS;
