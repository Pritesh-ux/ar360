import type {
  GemstoneType,
  MaterialSetting,
} from "@/components/features/editor/types";

/** Same sentinel as diamond-look CLEAR_MATERIAL_TEXTURE (avoid circular import). */
const CLEAR_MATERIAL_TEXTURE = "__clear__";

/** Safe runtime / UI range for MeshPhysicalMaterial.dispersion. */
export const DISPERSION_MIN = 0;
export const DISPERSION_MAX = 0.5;

export const GEMSTONE_TYPES: readonly GemstoneType[] = [
  "diamond",
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "moissanite",
] as const;

export function isGemstoneType(value: unknown): value is GemstoneType {
  return (
    typeof value === "string" &&
    (GEMSTONE_TYPES as readonly string[]).includes(value)
  );
}

export function clampDispersion(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(DISPERSION_MAX, Math.max(DISPERSION_MIN, n));
}

export function resolveMaterialCategory(
  setting?: Partial<MaterialSetting> | null,
): "standard" | "gemstone" {
  return setting?.type === "gemstone" ? "gemstone" : "standard";
}

type GemstonePresetCore = MaterialSetting & {
  type: "gemstone";
  gemstoneType: GemstoneType;
  dispersion: number;
};

/**
 * Jewelry optical presets.
 *
 * attenuationDistance is authored relative to reference thickness 0.55 and is
 * scaled at apply-time to the real gem mesh optical thickness — so mm-scale
 * jewelry stones get real Beer–Lambert absorption (not pink plastic).
 *
 * Colored stones: mid surface tint + deep attenuationColor + short relative
 * attenuationDistance. Clear stones: cool near-white, attenuation off (0).
 */
const GEMSTONE_PRESETS: Record<GemstoneType, GemstonePresetCore> = {
  diamond: {
    type: "gemstone",
    gemstoneType: "diamond",
    baseColor: "#f4f8fc",
    metalness: 0,
    roughness: 0.004,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    transmission: 0.88,
    ior: 2.417,
    thickness: 0.55,
    attenuationColor: "#ffffff",
    attenuationDistance: 0,
    dispersion: 0.16,
    specularIntensity: 1,
    specularColor: "#ffffff",
    envMapIntensity: 1.55,
    reflectionIntensity: 1.18,
    reflectionBlur: 0,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.35,
    clearcoat: 0.1,
    clearcoatRoughness: 0.015,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
  ruby: {
    type: "gemstone",
    gemstoneType: "ruby",
    baseColor: "#7a0c22",
    metalness: 0,
    roughness: 0.025,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    // Dense — must not see prongs through the stone like tinted glass.
    transmission: 0.48,
    ior: 1.77,
    thickness: 0.55,
    attenuationColor: "#0a0001",
    attenuationDistance: 0.05,
    dispersion: 0.02,
    specularIntensity: 1,
    specularColor: "#ffffff",
    envMapIntensity: 1.15,
    reflectionIntensity: 1.05,
    reflectionBlur: 0,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.08,
    clearcoat: 0.15,
    clearcoatRoughness: 0.04,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
  sapphire: {
    type: "gemstone",
    gemstoneType: "sapphire",
    baseColor: "#0e2f8a",
    metalness: 0,
    roughness: 0.025,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    transmission: 0.48,
    ior: 1.77,
    thickness: 0.55,
    attenuationColor: "#00040e",
    attenuationDistance: 0.05,
    dispersion: 0.02,
    specularIntensity: 1,
    specularColor: "#ffffff",
    envMapIntensity: 1.15,
    reflectionIntensity: 1.05,
    reflectionBlur: 0,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.08,
    clearcoat: 0.15,
    clearcoatRoughness: 0.04,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
  emerald: {
    type: "gemstone",
    gemstoneType: "emerald",
    baseColor: "#0f6a38",
    metalness: 0,
    roughness: 0.03,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    transmission: 0.46,
    ior: 1.57,
    thickness: 0.55,
    attenuationColor: "#000a05",
    attenuationDistance: 0.045,
    dispersion: 0.02,
    specularIntensity: 0.98,
    specularColor: "#ffffff",
    envMapIntensity: 0.72,
    reflectionIntensity: 0.88,
    reflectionBlur: 0.01,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.05,
    clearcoat: 0.12,
    clearcoatRoughness: 0.05,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
  amethyst: {
    type: "gemstone",
    gemstoneType: "amethyst",
    baseColor: "#5a1fa0",
    metalness: 0,
    roughness: 0.03,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    transmission: 0.48,
    ior: 1.54,
    thickness: 0.55,
    attenuationColor: "#070112",
    attenuationDistance: 0.05,
    dispersion: 0.02,
    specularIntensity: 0.98,
    specularColor: "#ffffff",
    envMapIntensity: 0.72,
    reflectionIntensity: 0.88,
    reflectionBlur: 0.01,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.05,
    clearcoat: 0.12,
    clearcoatRoughness: 0.05,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
  moissanite: {
    type: "gemstone",
    gemstoneType: "moissanite",
    baseColor: "#eef5ff",
    metalness: 0,
    roughness: 0.01,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE",
    transmission: 0.88,
    ior: 2.65,
    thickness: 0.55,
    attenuationColor: "#ffffff",
    attenuationDistance: 0,
    dispersion: 0.22,
    specularIntensity: 1,
    specularColor: "#ffffff",
    envMapIntensity: 0.9,
    reflectionIntensity: 1.0,
    reflectionBlur: 0,
    reflectionTint: "#ffffff",
    fresnelStrength: 1.12,
    clearcoat: 0.1,
    clearcoatRoughness: 0.02,
    occlusionStrength: 1,
    doubleSided: false,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  },
};

const DROP_MAP_KEYS = new Set([
  "baseColorTexture",
  "metallicRoughnessTexture",
  "emissiveTexture",
  "occlusionTexture",
  "logoLayer",
  "type",
  "gemstoneType",
  "dispersion",
  "baseColor",
  "metalness",
  "roughness",
  "emissiveColor",
  "opacity",
  "alphaMode",
  "transmission",
  "ior",
  "thickness",
  "attenuationDistance",
  "attenuationColor",
  "specularIntensity",
  "specularColor",
  "envMapIntensity",
  "reflectionIntensity",
  "reflectionBlur",
  "reflectionTint",
  "fresnelStrength",
  "clearcoat",
  "clearcoatRoughness",
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

export function getGemstonePreset(type: GemstoneType): MaterialSetting {
  return cloneGemstonePreset(type);
}

/** Deep-enough clone so callers never mutate the canonical preset table. */
export function cloneGemstonePreset(type: GemstoneType): MaterialSetting {
  const preset = GEMSTONE_PRESETS[type];
  return {
    ...preset,
    dispersion: clampDispersion(preset.dispersion),
  };
}

/**
 * Apply a gemstone preset onto an existing slot setting.
 * Preserves bump/normal maps and non-PBR transform fields when present.
 */
export function applyGemstonePreset(
  existing: Partial<MaterialSetting> | null | undefined,
  type: GemstoneType,
): MaterialSetting {
  const preset = cloneGemstonePreset(type);
  return {
    ...preset,
    ...keepOptionalMaps(existing, { keepNormal: true }),
    ...preset,
    type: "gemstone",
    gemstoneType: type,
    dispersion: clampDispersion(preset.dispersion),
    metalness: 0,
    baseColorTexture: CLEAR_MATERIAL_TEXTURE,
    metallicRoughnessTexture: CLEAR_MATERIAL_TEXTURE,
  };
}

/** Switch a slot back to standard category without wiping authored PBR values. */
export function applyStandardMaterialCategory(
  existing: Partial<MaterialSetting> | null | undefined,
): MaterialSetting {
  const base: MaterialSetting = {
    baseColor: existing?.baseColor || "#ffffff",
    metalness: Number(existing?.metalness ?? 0),
    roughness: Number(existing?.roughness ?? 0.5),
    emissiveColor: existing?.emissiveColor || "#000000",
    ...existing,
    type: "standard",
    gemstoneType: undefined,
    dispersion: undefined,
  };
  return base;
}
