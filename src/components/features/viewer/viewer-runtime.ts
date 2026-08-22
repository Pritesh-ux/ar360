/**
 * Canonical viewer settings + ModelViewer props shared by /viewer and /embed.
 */
import type { ViewerProduct } from "./types";
import { getViewerSettings, resolveEnvironmentImage } from "./viewer-utils";
import { getProductModelSrc } from "@/lib/modelSource";

export type ViewerRuntimeMode = "viewer" | "embed";

export function resolveViewerRuntimeSettings(
  product: ViewerProduct | null,
  variantId?: string | null,
) {
  return getViewerSettings(product, variantId);
}

export function buildViewerRuntimeModelProps(
  product: ViewerProduct,
  options?: {
    variantId?: string | null;
    mode?: ViewerRuntimeMode;
    autoRotateOverride?: boolean | null;
    preferArLite?: boolean;
  },
) {
  const settings = getViewerSettings(product, options?.variantId);
  const env = resolveEnvironmentImage(settings.environmentImage);
  const useSkybox = Boolean((settings as { useSkybox?: boolean }).useSkybox);

  const bg =
    !settings.backgroundColor || settings.backgroundColor === "#ffffff"
      ? options?.mode === "embed"
        ? "#ffffff"
        : "#F0F2F5"
      : settings.backgroundColor;

  const arLite = String(product.arModelUrl || "").trim();
  const srcProduct =
    options?.preferArLite && arLite
      ? { ...product, modelUrl: arLite, fileName: "model.ar.glb" }
      : product;

  return {
    src: getProductModelSrc(srcProduct),
    poster: settings.poster || product.poster,
    exposure: settings.exposure,
    environmentTint: settings.environmentTint,
    environmentSaturation: settings.environmentSaturation,
    toneMapping: "commerce" as const,
    environmentImage: env,
    skyboxImage:
      useSkybox &&
      settings.environmentImage &&
      settings.environmentImage !== "default" &&
      !String(settings.environmentImage).startsWith("blob:")
        ? settings.environmentImage
        : undefined,
    backgroundColor: bg,
    transparent: settings.transparent,
    shadowIntensity: settings.shadowIntensity,
    shadowSoftness: settings.shadowSoftness,
    autoRotate:
      options?.autoRotateOverride != null
        ? options.autoRotateOverride
        : settings.autoRotate,
    cameraControls: settings.cameraControls,
    // Embed uses Studio Look AR launcher instead of native model-viewer AR.
    showArButton: options?.mode === "embed" ? false : settings.showArButton,
    interactionPrompt: settings.interactionPrompt,
    autoPlay: settings.autoPlay,
    fov: settings.fov,
    cameraOrbit: settings.cameraOrbit || undefined,
    cameraTarget: settings.cameraTarget || undefined,
    arPlacement:
      (settings as { arPlacement?: string }).arPlacement === "wall" ? ("wall" as const) : ("floor" as const),
    allMaterialSettings: settings.materialSettings,
    logoDecals: product.logoDecals || [],
    hotspots: (product.hotspots || []).map((h) => ({
      id: h.id,
      title: h.title || "",
      description: h.description || "",
      position: h.position,
      normal: h.normal,
      actionType: h.actionType,
      actionValue: h.actionValue,
    })),
    ctaEnabled: Boolean(settings.ctaEnabled && settings.ctaUrl),
    ctaLabel: settings.ctaLabel || "Learn more",
    ctaUrl: settings.ctaUrl || "",
    ctaType: settings.ctaType || "url",
  };
}
