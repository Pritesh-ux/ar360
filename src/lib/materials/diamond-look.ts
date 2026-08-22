import type { MaterialSetting } from "@/components/features/editor/types";
import {
  applyGemstonePreset,
  cloneGemstonePreset,
} from "@/lib/materials/gemstone-presets";

/**
 * Sentinel written into MaterialSetting texture fields when the Inspector must
 * unpin a baked GLB map (e.g. diamond look). Empty string still means "leave
 * baked map alone" so selecting a material never wipes textures.
 */
export const CLEAR_MATERIAL_TEXTURE = "__clear__";

/** True for the unpin sentinel in any form (`__clear__`, `/__clear__`, absolute URL). */
export function isClearedMaterialTexture(value?: string | null): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (raw === CLEAR_MATERIAL_TEXTURE) return true;
  try {
    const path = raw.includes("://") ? new URL(raw).pathname : raw.startsWith("/") ? raw : `/${raw}`;
    return (
      path === `/${CLEAR_MATERIAL_TEXTURE}` ||
      path.endsWith(`/${CLEAR_MATERIAL_TEXTURE}`)
    );
  } catch {
    return raw === `/${CLEAR_MATERIAL_TEXTURE}`;
  }
}

/**
 * Legacy jewelry diamond look — now backed by the canonical gemstone diamond
 * preset, with thin-wall overrides that existing tests and jewelry GLBs expect.
 */
export const DIAMOND_LOOK_PRESET: MaterialSetting = {
  ...cloneGemstonePreset("diamond"),
  baseColor: "#f7fbff",
  roughness: 0,
  transmission: 0.95,
  ior: 2.42,
  // Thin-walled gems (jewelry facets). Non-zero volume thickness on mm-scale
  // stone meshes punches black holes in model-viewer refraction.
  thickness: 0,
  // Inspector uses 0 = "off". ModelViewer maps this to Infinity (no absorb).
  attenuationDistance: 0,
  attenuationColor: "#ffffff",
  doubleSided: false,
  baseColorTexture: CLEAR_MATERIAL_TEXTURE,
  metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
};

/** Canary / PVD gold — warm honey midtones, bronze cavities (not mustard, not chrome). */
export const YELLOW_GOLD_LOOK_PRESET: MaterialSetting = {
  type: "standard",
  baseColor: "#e2b43a",
  metalness: 1,
  roughness: 0.16,
  emissiveColor: "#000000",
  opacity: 1,
  alphaMode: "OPAQUE",
  transmission: 0,
  ior: 1.5,
  thickness: 0,
  attenuationDistance: 0,
  attenuationColor: "#ffffff",
  specularIntensity: 0.92,
  specularColor: "#ffe3a0",
  envMapIntensity: 1.15,
  reflectionIntensity: 1.12,
  reflectionBlur: 0.04,
  reflectionTint: "#ffd27a",
  fresnelStrength: 0.9,
  clearcoat: 0.12,
  clearcoatRoughness: 0.14,
  occlusionStrength: 1,
  baseColorTexture: CLEAR_MATERIAL_TEXTURE,
  metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
};

/** Mild glass bottle style (kept for contrast / future presets). */
export const CLEAR_GLASS_PRESET: MaterialSetting = {
  type: "standard",
  baseColor: "#eef8ff",
  metalness: 0,
  roughness: 0.08,
  emissiveColor: "#000000",
  opacity: 1,
  alphaMode: "OPAQUE",
  transmission: 0.72,
  ior: 1.5,
  thickness: 0.22,
  attenuationDistance: 1.2,
  attenuationColor: "#f2fbff",
  occlusionStrength: 1,
  baseColorTexture: CLEAR_MATERIAL_TEXTURE,
  metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
};

const DROP_MAP_KEYS = new Set([
  "baseColorTexture",
  "metallicRoughnessTexture",
  "emissiveTexture",
  "occlusionTexture",
  "logoLayer",
]);

function keepOptionalMaps(
  base?: Partial<MaterialSetting> | null,
  options?: { keepNormal?: boolean },
): Partial<MaterialSetting> {
  return Object.fromEntries(
    Object.entries(base || {}).filter(([key, value]) => {
      if (value === undefined) return false;
      if (DROP_MAP_KEYS.has(key)) return false;
      if (!options?.keepNormal && key === "normalTexture") return false;
      return true;
    }),
  );
}

export function withDiamondLook(
  base?: Partial<MaterialSetting> | null,
): MaterialSetting {
  const gem = applyGemstonePreset(base, "diamond");
  return {
    ...gem,
    ...DIAMOND_LOOK_PRESET,
    ...keepOptionalMaps(base, { keepNormal: true }),
    ...DIAMOND_LOOK_PRESET,
    type: "gemstone",
    gemstoneType: "diamond",
    dispersion: gem.dispersion ?? DIAMOND_LOOK_PRESET.dispersion ?? 0.16,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  };
}

export function withYellowGoldLook(
  base?: Partial<MaterialSetting> | null,
): MaterialSetting {
  return {
    ...YELLOW_GOLD_LOOK_PRESET,
    ...keepOptionalMaps(base, { keepNormal: true }),
    ...YELLOW_GOLD_LOOK_PRESET,
    type: "standard",
    transmission: 0,
    ior: 1.5,
    thickness: 0,
    attenuationDistance: 0,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  };
}

export function isLikelyGemMaterialName(name?: string | null): boolean {
  return /diamond|gem|jewel|crystal|stone|zircon|sapphire|ruby|emerald|brilliant|facet|solitaire|pav[eé]|cubic/i.test(
    String(name || ""),
  );
}

export function isLikelyMetalBandName(name?: string | null): boolean {
  // Do NOT match "fallback" — many jewelry GLBs use that name for the whole
  // ring (metal + stones). Treating it as metal blocked gem transmission.
  return /gold|silver|platinum|steel|iron|copper|brass|bronze|metal|chrome|aluminium|aluminum|titanium|band|shank|prong|bezel|ring[\s_-]?body/i.test(
    String(name || ""),
  );
}

/** True when this native PBR slot should receive yellow-gold polish (not a gem). */
export function isLikelyJewelryMetalSlot(input: {
  name?: string | null;
  relatedNames?: Array<string | null | undefined> | null;
  isTransparentPart?: boolean;
  metalness?: number | null;
}): boolean {
  if (input.isTransparentPart) return false;
  if (isLikelyGemMaterialName(input.name)) return false;
  for (const related of input.relatedNames || []) {
    if (isLikelyGemMaterialName(related)) return false;
  }
  if (isLikelyMetalBandName(input.name)) return true;
  for (const related of input.relatedNames || []) {
    if (isLikelyMetalBandName(related)) return true;
  }
  const metalness =
    input.metalness != null && Number.isFinite(Number(input.metalness))
      ? Number(input.metalness)
      : null;
  return metalness != null && metalness >= 0.45;
}

/**
 * Jewelry CAD assigns a diamond shader by material name. AR360 only did that
 * after Gemstone → Diamond in the inspector — unnamed gem slots stayed plastic.
 *
 * Explicit Standard stays Standard. Explicit gemstone stays as authored.
 * Unset type + gem-like name → diamond look (clear maps, transmission, fire).
 */
export function resolveRuntimeGemstoneSetting(
  setting: MaterialSetting,
  materialName?: string | null,
): MaterialSetting {
  if (setting.type === "gemstone") return setting;
  if (setting.type === "standard") return setting;
  if (isLikelyMetalBandName(materialName)) return setting;
  if (!isLikelyGemMaterialName(materialName)) return setting;
  return withDiamondLook(setting);
}
