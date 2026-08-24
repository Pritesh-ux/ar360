/**
 * Material UI → GemRenderer optical contract (single source of truth mapping).
 */
import type { GemstoneType, MaterialSetting } from "@/components/features/editor/types";
import {
  clampDispersion,
  getGemstonePreset,
  isGemstoneType,
} from "@/lib/materials/gemstone-presets";
import {
  DIAMOND_PHYSICAL_DEFAULTS,
  type PhysicalGemParams,
} from "@/lib/gem-renderer-poc/gemMaterialContract";
import type { GemCandidateMesh } from "./types";
import { resolveIntegrationEnvironmentIntensity } from "./integrationPipeline";

export function isGemRendererEligibleGemstone(gemstoneType: unknown): gemstoneType is GemstoneType {
  return isGemstoneType(gemstoneType);
}

/** Any authored gemstone slot on a supported mesh may drive GemRenderer. */
export function shouldUseGemRendererForSetting(
  setting: Partial<MaterialSetting> | null | undefined,
): boolean {
  return Boolean(
    setting &&
      setting.type === "gemstone" &&
      isGemRendererEligibleGemstone(setting.gemstoneType),
  );
}

function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function parseHexRgb(hex: string): [number, number, number] {
  const raw = String(hex || "#ffffff").replace("#", "").trim();
  if (raw.length < 6) return [1, 1, 1];
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 1,
    Number.isFinite(g) ? g : 1,
    Number.isFinite(b) ? b : 1,
  ];
}

function mapGemstoneTypeToContract(type: GemstoneType): PhysicalGemParams["gemstoneType"] {
  if (type === "diamond") return "diamond";
  if (type === "moissanite") return "moissanite";
  return "custom";
}

/** Beer–Lambert σ RGB from Material UI. */
export function resolveGemAbsorptionFromSetting(
  setting: Partial<MaterialSetting>,
): [number, number, number] {
  const scalar = Number(setting.gemAbsorption);
  if (Number.isFinite(scalar) && scalar >= 0) {
    return [scalar, scalar, scalar];
  }

  const dist = Number(setting.attenuationDistance);
  if (Number.isFinite(dist) && dist > 0) {
    const rgb = parseHexRgb(setting.attenuationColor || "#ffffff");
    const sigma = 0.01 / Math.max(dist, 0.001);
    return [rgb[0] * sigma, rgb[1] * sigma, rgb[2] * sigma];
  }

  if (setting.gemstoneType === "diamond" || setting.gemstoneType === "moissanite") {
    return [...DIAMOND_PHYSICAL_DEFAULTS.absorption] as [number, number, number];
  }

  return [0.008, 0.008, 0.008];
}

/** Map UI thickness — diamond uses GemRenderer relative scale; colored gems keep preset path. */
function resolveGemThickness(setting: Partial<MaterialSetting>): number {
  const thickness = Number(setting.thickness);
  if (!Number.isFinite(thickness)) {
    return setting.gemstoneType === "diamond"
      ? DIAMOND_PHYSICAL_DEFAULTS.thickness
      : 1;
  }
  if (setting.gemstoneType === "diamond") return Math.max(0, thickness);
  // Colored gem UI uses KHR-style values (~0.55) — normalize to relative path.
  return Math.max(0.15, thickness / 0.55);
}

/** Map editor MaterialSetting → GemRenderer physical contract. */
export function mapMaterialSettingToGemPhysicalParams(
  setting: Partial<MaterialSetting>,
): PhysicalGemParams {
  const type = isGemstoneType(setting.gemstoneType) ? setting.gemstoneType : "diamond";
  const preset = getGemstonePreset(type);
  const d = DIAMOND_PHYSICAL_DEFAULTS;
  const ior = Number(setting.ior);
  const roughness = Number(setting.roughness);

  return {
    gemstoneType: mapGemstoneTypeToContract(type),
    ior: Number.isFinite(ior) ? ior : Number(preset.ior ?? d.ior),
    dispersion: clampDispersion(setting.dispersion ?? preset.dispersion ?? d.dispersion),
    absorption: resolveGemAbsorptionFromSetting(setting),
    thickness: resolveGemThickness(setting),
    roughness: clamp01(roughness, Number(preset.roughness ?? d.roughness)),
  };
}

/** Environment intensity from Material UI reflection/env controls (POC-normalized). */
export function resolveGemEnvironmentIntensity(
  setting: Partial<MaterialSetting> | null | undefined,
): number {
  return resolveIntegrationEnvironmentIntensity(setting);
}

/** Stable signature for live param sync (no GLB re-fetch). */
export function materialSettingGemSignature(
  setting: Partial<MaterialSetting> | null | undefined,
): string {
  if (!shouldUseGemRendererForSetting(setting)) return "pbr";
  const p = mapMaterialSettingToGemPhysicalParams(setting!);
  return [
    setting!.gemstoneType,
    p.ior.toFixed(4),
    p.dispersion.toFixed(4),
    p.absorption.map((v) => v.toFixed(5)).join(","),
    p.thickness.toFixed(4),
    p.roughness.toFixed(4),
    Number(setting!.transmission ?? -1).toFixed(4),
    resolveGemEnvironmentIntensity(setting).toFixed(3),
  ].join("|");
}

export function resolvePrimaryGemMaterialSetting(
  allMaterialSettings: Record<number, MaterialSetting> | undefined,
  candidates: GemCandidateMesh[],
  primaryKey: string,
): MaterialSetting | null {
  const primary = candidates.find((c) => c.meshKey === primaryKey);
  if (!primary) return null;

  const idx = primary.materialIndex;
  if (idx != null && allMaterialSettings?.[idx]) {
    return allMaterialSettings[idx];
  }

  for (const setting of Object.values(allMaterialSettings || {})) {
    if (setting?.type === "gemstone") return setting;
  }
  return null;
}

export type GemUiRendererMode = "gem-renderer" | "pbr" | "idle";

export function resolveGemUiRendererMode(
  setting: Partial<MaterialSetting> | null | undefined,
  overlayReady: boolean,
  gemRendererActive: boolean,
): GemUiRendererMode {
  if (!shouldUseGemRendererForSetting(setting)) return "pbr";
  if (!gemRendererActive) return "pbr";
  if (overlayReady) return "gem-renderer";
  return "pbr";
}

export function formatGemContractSummary(
  setting: Partial<MaterialSetting> | null | undefined,
): string {
  if (!shouldUseGemRendererForSetting(setting)) return "—";
  const p = mapMaterialSettingToGemPhysicalParams(setting!);
  return `ior=${p.ior.toFixed(3)} disp=${p.dispersion.toFixed(3)} abs=${p.absorption[0].toFixed(4)} thick=${p.thickness.toFixed(2)} rough=${p.roughness.toFixed(3)}`;
}

/** Dev-only diagnostic payload: GEM UI → RENDERER */
export function buildGemUiRendererDiagnostic(
  setting: Partial<MaterialSetting> | null | undefined,
  overlayReady: boolean,
  gemRendererActive = false,
) {
  const mode = resolveGemUiRendererMode(setting, overlayReady, gemRendererActive);
  if (!shouldUseGemRendererForSetting(setting)) {
    return {
      gemstoneType: setting?.gemstoneType ?? null,
      ior: null,
      dispersion: null,
      absorption: null,
      thickness: null,
      roughness: null,
      transmission: null,
      rendererMode: mode,
    };
  }
  const p = mapMaterialSettingToGemPhysicalParams(setting!);
  return {
    gemstoneType: setting?.gemstoneType ?? "diamond",
    ior: p.ior,
    dispersion: p.dispersion,
    absorption: p.absorption[0],
    thickness: p.thickness,
    roughness: p.roughness,
    transmission: setting?.transmission ?? null,
    rendererMode: mode,
  };
}
