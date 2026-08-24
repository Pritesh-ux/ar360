/**
 * Jewelry / gemstone studio presentation — lighting & tone only.
 * Never writes materialSettings or native GLB PBR values.
 */
export const JEWELRY_STUDIO_PROFILE_ID = "JEWELRY_STUDIO" as const;

export type JewelryStudioLighting = {
  id: typeof JEWELRY_STUDIO_PROFILE_ID;
  /** High-contrast product studio HDR (IBL only — not the visible background). */
  environmentImage: string;
  environmentSaturation: number;
  environmentTint: string;
  exposure: number;
  toneMapping: "auto" | "aces" | "agx" | "commerce" | "neutral";
  /** Keep visible canvas background separate from IBL. */
  useSkybox: false;
  shadowIntensity: number;
  shadowSoftness: number;
};

/**
 * KeyShot-leaning jewelry IBL: bright + dark reflection sources for facet fire
 * and polished metal, without flat white ambient wash.
 */
export const JEWELRY_STUDIO_LIGHTING: JewelryStudioLighting = {
  id: JEWELRY_STUDIO_PROFILE_ID,
  environmentImage: "/hdr/studio.hdr",
  environmentSaturation: 1.04,
  environmentTint: "#ffffff",
  // Slightly brighter than editor default (0.9) so facets catch IBL,
  // but below levels that clip chrome / rose-gold to white.
  exposure: 1.05,
  // AgX rolls off highlights softer than commerce — better for gem fire + metal.
  toneMapping: "agx",
  useSkybox: false,
  shadowIntensity: 0.7,
  shadowSoftness: 1,
};

const JEWELRY_CATEGORY_RE =
  /jewel|jewellery|gem|diamond|ruby|emerald|sapphire|ring|bracelet|necklace|pendant|earring/i;

const DEFAULTISH_ENV = new Set(["", "default", "neutral"]);

export function isDefaultishEnvironmentImage(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return true;
  if (DEFAULTISH_ENV.has(raw)) return true;
  if (raw === "/hdr/neutral.hdr") return true;
  return false;
}

export function isNearEditorDefaultExposure(value: unknown, defaultExposure = 0.9) {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n - defaultExposure) <= 0.051;
}

export function shouldUseJewelryStudioLighting(input: {
  category?: string | null;
  title?: string | null;
  gemMeshHints?: string[] | null;
  /** Native or saved slots — transmission > 0 signals gem/glass glTF extensions. */
  materials?: Array<{ transmission?: number; name?: string } | null | undefined> | null;
  nativeMaterials?: Record<number, { transmission?: number; name?: string } | null | undefined> | null;
}): boolean {
  if (JEWELRY_CATEGORY_RE.test(String(input.category || ""))) return true;
  if (JEWELRY_CATEGORY_RE.test(String(input.title || ""))) return true;
  if ((input.gemMeshHints || []).length > 0) return true;

  const fromList = (input.materials || []).some(
    (m) => Number(m?.transmission ?? 0) > 0.02,
  );
  if (fromList) return true;

  const natives = input.nativeMaterials || {};
  for (const setting of Object.values(natives)) {
    if (Number(setting?.transmission ?? 0) > 0.02) return true;
  }
  return false;
}

/**
 * Merge JEWELRY_STUDIO into current lighting only where the user is still on
 * editor defaults — never clobber a custom HDR / exposure / skybox choice.
 */
export function resolveJewelryStudioPresentation(input: {
  enabled: boolean;
  environmentImage?: string | null;
  exposure?: number | null;
  environmentSaturation?: number | null;
  environmentTint?: string | null;
  shadowIntensity?: number | null;
  shadowSoftness?: number | null;
  toneMapping?: JewelryStudioLighting["toneMapping"] | null;
  useSkybox?: boolean | null;
  editorDefaultExposure?: number;
}): {
  environmentImage: string;
  exposure: number;
  environmentSaturation: number;
  environmentTint: string;
  shadowIntensity: number;
  shadowSoftness: number;
  toneMapping: JewelryStudioLighting["toneMapping"];
  useSkybox: boolean;
  profileId: typeof JEWELRY_STUDIO_PROFILE_ID | null;
} {
  const profile = JEWELRY_STUDIO_LIGHTING;
  const defaultExposure = input.editorDefaultExposure ?? 0.9;
  const currentEnv = String(input.environmentImage || "default");
  const currentExposure =
    input.exposure != null && Number.isFinite(Number(input.exposure))
      ? Number(input.exposure)
      : defaultExposure;
  const currentSat =
    input.environmentSaturation != null && Number.isFinite(Number(input.environmentSaturation))
      ? Number(input.environmentSaturation)
      : 1;
  const currentTint = String(input.environmentTint || "#ffffff");
  const currentShadow =
    input.shadowIntensity != null && Number.isFinite(Number(input.shadowIntensity))
      ? Number(input.shadowIntensity)
      : 1.25;
  const currentSoft =
    input.shadowSoftness != null && Number.isFinite(Number(input.shadowSoftness))
      ? Number(input.shadowSoftness)
      : 0.7;
  const currentTone = input.toneMapping || "commerce";
  const currentSkybox = Boolean(input.useSkybox);

  if (!input.enabled) {
    return {
      environmentImage: currentEnv,
      exposure: currentExposure,
      environmentSaturation: currentSat,
      environmentTint: currentTint,
      shadowIntensity: currentShadow,
      shadowSoftness: currentSoft,
      toneMapping: currentTone,
      useSkybox: currentSkybox,
      profileId: null,
    };
  }

  return {
    environmentImage: isDefaultishEnvironmentImage(currentEnv)
      ? profile.environmentImage
      : currentEnv,
    exposure: isNearEditorDefaultExposure(currentExposure, defaultExposure)
      ? profile.exposure
      : currentExposure,
    environmentSaturation:
      Math.abs(currentSat - 1) <= 0.001 ? profile.environmentSaturation : currentSat,
    environmentTint:
      currentTint.trim().toLowerCase() === "#ffffff" ? profile.environmentTint : currentTint,
    shadowIntensity:
      Math.abs(currentShadow - 1.25) <= 0.05 ? profile.shadowIntensity : currentShadow,
    shadowSoftness: Math.abs(currentSoft - 0.7) <= 0.05 ? profile.shadowSoftness : currentSoft,
    toneMapping: currentTone === "commerce" ? profile.toneMapping : currentTone,
    // Jewelry IBL must not replace the visible studio background with an HDR skybox.
    useSkybox: false,
    profileId: JEWELRY_STUDIO_PROFILE_ID,
  };
}

/** True when a native slot already carries glTF transmission (needs Physical backend). */
export function nativeSlotNeedsPhysicalTransmission(
  setting?: { transmission?: number } | null,
) {
  return Number(setting?.transmission ?? 0) > 0.02;
}
