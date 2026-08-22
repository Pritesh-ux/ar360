import { hexToRgb01 } from "@/lib/materials/inspector-apply";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type WhiteDepthInput = {
  baseColor?: string;
  metalness: number;
  roughness: number;
  opacity?: number;
  transmission?: number;
  hasBaseColorMap?: boolean;
  specularIntensity?: number;
  specularColor?: string;
};

export type WhiteDepthPlan = {
  metalness: number;
  roughness: number;
  albedoScale: number;
  specularIntensity: number;
  specularColor: string;
  specularScale: number;
  clearcoat: number | null;
  clearcoatRoughness: number | null;
  envMapScale: number;
  rescuedCeramic: boolean;
};

/** Headroom so commerce tonemap does not clip white form. */
const WHITE_ALBEDO_TARGET_LUM = 0.84;
/** Extra headroom once we treat the slot as sanitary ceramic. */
const CERAMIC_ALBEDO_TARGET_LUM = 0.78;

/**
 * Pure-white sanitary / ceramic GLBs often ship as metalness 1 + roughness 1 +
 * specular 0. That reads as chalk with no bowl depth. Treat that combo as a
 * glossy porcelain without changing inspector-owned textured / metal looks.
 */
export function planWhiteProductDepth(input: WhiteDepthInput): WhiteDepthPlan {
  const metalness = clamp01(input.metalness);
  const roughness = clamp01(input.roughness);
  const specularIntensity = clamp01(input.specularIntensity ?? 1);
  const specularColor = input.specularColor || "#ffffff";
  const identity: WhiteDepthPlan = {
    metalness,
    roughness,
    albedoScale: 1,
    specularIntensity,
    specularColor,
    specularScale: 1,
    clearcoat: null,
    clearcoatRoughness: null,
    envMapScale: 1,
    rescuedCeramic: false,
  };

  if (input.hasBaseColorMap) return identity;
  if ((input.transmission ?? 0) > 0.02) return identity;
  if ((input.opacity ?? 1) < 0.95) return identity;

  const [r, g, b] = hexToRgb01(input.baseColor || "#ffffff");
  const lum = luminance(r, g, b);
  if (lum < 0.82) return identity;

  const looksFalseMetal = metalness >= 0.9 && roughness >= 0.42;
  const looksMatteWhite = metalness < 0.35 && roughness >= 0.55;

  const next: WhiteDepthPlan = { ...identity };
  if (lum > WHITE_ALBEDO_TARGET_LUM) {
    next.albedoScale = WHITE_ALBEDO_TARGET_LUM / lum;
  }

  if (looksFalseMetal || looksMatteWhite) {
    next.rescuedCeramic = true;
    next.metalness = Math.min(next.metalness, 0.03);
    next.roughness = Math.min(next.roughness, 0.36);
    next.specularIntensity = Math.max(next.specularIntensity, 0.78);
    next.clearcoat = 0.38;
    next.clearcoatRoughness = 0.18;
    next.envMapScale = 0.55;
    if (lum > CERAMIC_ALBEDO_TARGET_LUM) {
      next.albedoScale = CERAMIC_ALBEDO_TARGET_LUM / lum;
    }
    const [sr, sg, sb] = hexToRgb01(specularColor);
    if (luminance(sr, sg, sb) < 0.2) next.specularColor = "#ffffff";
  }

  return next;
}
