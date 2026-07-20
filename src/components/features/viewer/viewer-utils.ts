import { toCurrentOriginUrl } from "@/lib/modelSource";
import type { MaterialSetting, ViewerProduct } from "./types";

export function resolveEnvironmentImage(value?: string) {
  if (!value || value === "default") return "neutral";
  if (value.startsWith("blob:")) return "neutral";
  // Legacy packed names are not real URLs — model-viewer would fetch "/sunset" etc. and 404.
  const legacyPacked = new Set(["sunset", "studio", "city", "warehouse", "forest", "apartment"]);
  if (legacyPacked.has(value)) return "neutral";
  return value;
}

export function getLogo(product: ViewerProduct | null) {
  if (!product) return "";
  return toCurrentOriginUrl(
    product.brandLogoUrl ||
      product.companyLogoUrl ||
      product.brandLogo ||
      product.companyLogo ||
      product.logoUrl ||
      "",
  );
}

export function normalizeViewerAssetUrl(value?: string) {
  if (!value) return value;
  return toCurrentOriginUrl(value) || value;
}

function normalizeMaterialSettingAssets(setting: MaterialSetting): MaterialSetting {
  return {
    ...setting,
    baseColorTexture: normalizeViewerAssetUrl(setting.baseColorTexture),
    metallicRoughnessTexture: normalizeViewerAssetUrl(setting.metallicRoughnessTexture),
    normalTexture: normalizeViewerAssetUrl(setting.normalTexture),
    emissiveTexture: normalizeViewerAssetUrl(setting.emissiveTexture),
    occlusionTexture: normalizeViewerAssetUrl(setting.occlusionTexture),
    logoLayer: setting.logoLayer
      ? { ...setting.logoLayer, image: normalizeViewerAssetUrl(setting.logoLayer.image) || setting.logoLayer.image }
      : setting.logoLayer,
  };
}

function normalizeMaterialSettings(settings?: Record<number, MaterialSetting>) {
  if (!settings) return {};
  return Object.fromEntries(
    Object.entries(settings).map(([key, setting]) => [key, normalizeMaterialSettingAssets(setting)]),
  ) as Record<number, MaterialSetting>;
}

export function normalizeProductForViewer(product: ViewerProduct): ViewerProduct {
  const variants = product.variants?.map((variant) => ({
    ...variant,
    poster: normalizeViewerAssetUrl(variant.poster),
    materialSettings: normalizeMaterialSettings(variant.materialSettings),
  }));

  return {
    ...product,
    modelUrl: normalizeViewerAssetUrl(product.modelUrl),
    usdzUrl: normalizeViewerAssetUrl(product.usdzUrl),
    poster: normalizeViewerAssetUrl(product.poster),
    thumbnailUrl: normalizeViewerAssetUrl(product.thumbnailUrl),
    brandLogo: normalizeViewerAssetUrl(product.brandLogo),
    brandLogoUrl: normalizeViewerAssetUrl(product.brandLogoUrl),
    companyLogo: normalizeViewerAssetUrl(product.companyLogo),
    companyLogoUrl: normalizeViewerAssetUrl(product.companyLogoUrl),
    logoUrl: normalizeViewerAssetUrl(product.logoUrl),
    materialSettings: normalizeMaterialSettings(product.materialSettings),
    logoDecals: product.logoDecals?.map((decal) => ({
      ...decal,
      image: normalizeViewerAssetUrl(decal.image) || decal.image,
    })),
    variants,
  };
}

export function getActiveVariant(product: ViewerProduct | null) {
  if (!product) return null;
  return (
    product.variants?.find((variant) => variant.id === product.activeVariantId) ||
    product.variants?.[0] ||
    null
  );
}

export function getViewerSettings(product: ViewerProduct | null) {
  const variant = getActiveVariant(product);
  const savedSettings = product?.settings || {};
  const variantMaterials = variant?.materialSettings || {};
  const productMaterials = product?.materialSettings || (savedSettings?.materialSettings as Record<number, MaterialSetting>) || {};

  return {
    materialSettings:
      Object.keys(variantMaterials).length > 0 ? variantMaterials : productMaterials,
    environmentImage: variant?.environmentImage || product?.environmentImage || (savedSettings?.environmentImage as string) || "neutral",
    exposure: variant?.exposure ?? product?.exposure ?? (savedSettings?.exposure as number) ?? 1,
    backgroundColor: variant?.backgroundColor || product?.backgroundColor || (savedSettings?.backgroundColor as string) || "#ffffff",
    transparent: variant?.transparent ?? product?.transparent ?? (savedSettings?.transparent as boolean) ?? false,
    shadowIntensity: variant?.shadowIntensity ?? product?.shadowIntensity ?? (savedSettings?.shadowIntensity as number) ?? 1,
    shadowSoftness: variant?.shadowSoftness ?? product?.shadowSoftness ?? (savedSettings?.shadowSoftness as number) ?? 1,
    autoRotate: variant?.autoRotate ?? product?.autoRotate ?? (savedSettings?.autoRotate as boolean) ?? true,
    cameraControls: variant?.cameraControls ?? product?.cameraControls ?? (savedSettings?.cameraControls as boolean) ?? true,
    interactionPrompt: variant?.interactionPrompt ?? product?.interactionPrompt ?? (savedSettings?.interactionPrompt as boolean) ?? true,
    autoPlay: variant?.autoPlay ?? product?.autoPlay ?? (savedSettings?.autoPlay as boolean) ?? true,
    fov: variant?.fov ?? product?.fov ?? (savedSettings?.fov as number) ?? 38,
    poster: normalizeViewerAssetUrl(variant?.poster || product?.poster || (savedSettings?.poster as string)),
    baseColor: product?.baseColor || (savedSettings?.baseColor as string) || "#ffffff",
    metalness: product?.metalness ?? (savedSettings?.metalness as number) ?? 0,
    roughness: product?.roughness ?? (savedSettings?.roughness as number) ?? 0.5,
    emissiveColor: product?.emissiveColor || (savedSettings?.emissiveColor as string) || "#000000",
    baseColorTexture: normalizeViewerAssetUrl(product?.baseColorTexture || (savedSettings?.baseColorTexture as string)),
    initialZoom: variant?.initialZoom ?? product?.initialZoom ?? (savedSettings?.initialZoom as number) ?? 100,
    cameraOrbit:
      (variant as { cameraOrbit?: string })?.cameraOrbit ||
      product?.cameraOrbit ||
      (savedSettings?.cameraOrbit as string) ||
      undefined,
    cameraTarget:
      (variant as { cameraTarget?: string })?.cameraTarget ||
      product?.cameraTarget ||
      (savedSettings?.cameraTarget as string) ||
      undefined,
    backgroundType:
      product?.backgroundType || (savedSettings?.backgroundType as ViewerProduct["backgroundType"]) || "solid",
    backgroundGradientEnd:
      product?.backgroundGradientEnd || (savedSettings?.backgroundGradientEnd as string) || "#e5e7eb",
    environmentRotation:
      product?.environmentRotation ?? (savedSettings?.environmentRotation as number) ?? 0,
    ctaEnabled: product?.ctaEnabled ?? (savedSettings?.ctaEnabled as boolean) ?? false,
    ctaType: product?.ctaType || (savedSettings?.ctaType as ViewerProduct["ctaType"]) || "visit_website",
    ctaLabel: product?.ctaLabel || (savedSettings?.ctaLabel as string) || "",
    ctaUrl: product?.ctaUrl || (savedSettings?.ctaUrl as string) || "",
    arPlacement:
      product?.arPlacement === "wall" || (savedSettings?.arPlacement as string) === "wall"
        ? "wall"
        : "floor",
  };
}

export async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
