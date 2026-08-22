import { isCustomerStoragePath, toProtectedAssetUrl } from "@/lib/billing/asset-url";
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
  const raw = String(value).trim();
  // Cleared texture sentinel must stay a sentinel (not a fetchable URL, and
  // not dropped — dropping it would restore the baked GLB map).
  if (raw === "__clear__" || raw === "/__clear__") return "__clear__";
  const withOrigin = toCurrentOriginUrl(value) || value;
  if (isCustomerStoragePath(withOrigin)) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return toProtectedAssetUrl(withOrigin, origin) || withOrigin;
  }
  return withOrigin;
}

function normalizeMaterialSettingAssets(setting: MaterialSetting): MaterialSetting {
  return {
    ...setting,
    baseColorTexture: normalizeViewerAssetUrl(setting.baseColorTexture),
    metallicRoughnessTexture: normalizeViewerAssetUrl(setting.metallicRoughnessTexture),
    normalTexture: normalizeViewerAssetUrl(setting.normalTexture),
    emissiveTexture: normalizeViewerAssetUrl(setting.emissiveTexture),
    occlusionTexture: normalizeViewerAssetUrl(setting.occlusionTexture),
    bumpTexture: normalizeViewerAssetUrl(setting.bumpTexture),
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

export function getActiveVariant(product: ViewerProduct | null, variantId?: string | null) {
  if (!product) return null;
  if (variantId) {
    const selected = product.variants?.find((variant) => variant.id === variantId);
    if (selected) return selected;
  }
  return (
    product.variants?.find((variant) => variant.id === product.activeVariantId) ||
    product.variants?.[0] ||
    null
  );
}

/** Swatch color for a variant chip (first material baseColor, else neutral). */
export function getVariantSwatchColor(variant: { materialSettings?: Record<number, MaterialSetting> } | null | undefined) {
  const materials = variant?.materialSettings;
  if (!materials) return "#D1D5DB";
  const first = Object.values(materials)[0];
  return first?.baseColor || "#D1D5DB";
}

export function getViewerSettings(product: ViewerProduct | null, variantId?: string | null) {
  const variant = getActiveVariant(product, variantId);
  const savedSettings = product?.settings || {};
  const variantMaterials = variant?.materialSettings || {};
  const productMaterials =
    product?.materialSettings ||
    (savedSettings?.materialSettings as Record<number, MaterialSetting>) ||
    {};

  // When a variant row exists, never fall back to product-level materials.
  // Product.materialSettings mirrors the *last edited* variant and would bleed
  // across Default / Lock 02 / etc. Empty variant materials = native GLB look.
  const materialSettings = variant ? variantMaterials : productMaterials;
  const primaryMaterial = Object.values(materialSettings)[0];

  // Lighting tab is product-level UI; variants may hold a stale default white bg.
  // Prefer an explicit custom product/settings color over a default-looking variant bg.
  const variantBg = variant?.backgroundColor;
  const productBg =
    product?.backgroundColor || (savedSettings?.backgroundColor as string) || undefined;
  const isDefaultBg = (c?: string | null) => {
    if (!c) return true;
    const n = c.trim().toLowerCase();
    return n === "#ffffff" || n === "#fff" || n === "#f0f2f5" || n === "#fbfcfb" || n === "#f8fafc";
  };
  const backgroundColor = !isDefaultBg(productBg)
    ? productBg!
    : !isDefaultBg(variantBg)
      ? variantBg!
      : productBg || variantBg || "#ffffff";

  return {
    materialSettings,
    environmentImage: variant?.environmentImage || product?.environmentImage || (savedSettings?.environmentImage as string) || "neutral",
    exposure: variant?.exposure ?? product?.exposure ?? (savedSettings?.exposure as number) ?? 1,
    environmentTint: "#ffffff",
    environmentSaturation:
      Number.isFinite(Number(variant?.environmentSaturation))
        ? Number(variant?.environmentSaturation)
        : (product as { environmentSaturation?: number })?.environmentSaturation ??
          (savedSettings?.environmentSaturation as number) ??
          1,
    backgroundColor,
    transparent: product?.transparent ?? variant?.transparent ?? (savedSettings?.transparent as boolean) ?? false,
    shadowIntensity: variant?.shadowIntensity ?? product?.shadowIntensity ?? (savedSettings?.shadowIntensity as number) ?? 1,
    shadowSoftness: variant?.shadowSoftness ?? product?.shadowSoftness ?? (savedSettings?.shadowSoftness as number) ?? 1,
    autoRotate: variant?.autoRotate ?? product?.autoRotate ?? (savedSettings?.autoRotate as boolean) ?? true,
    cameraControls: variant?.cameraControls ?? product?.cameraControls ?? (savedSettings?.cameraControls as boolean) ?? true,
    interactionPrompt: variant?.interactionPrompt ?? product?.interactionPrompt ?? (savedSettings?.interactionPrompt as boolean) ?? true,
    autoPlay: variant?.autoPlay ?? product?.autoPlay ?? (savedSettings?.autoPlay as boolean) ?? true,
    showArButton:
      (variant as { showArButton?: boolean } | null)?.showArButton ??
      product?.showArButton ??
      (savedSettings?.showArButton as boolean) ??
      true,
    fov: variant?.fov ?? product?.fov ?? (savedSettings?.fov as number) ?? 38,
    poster: normalizeViewerAssetUrl(variant?.poster || product?.poster || (savedSettings?.poster as string)),
    // Prefer the active variant's first material; do not use product-level last-save.
    baseColor: primaryMaterial?.baseColor || "#ffffff",
    metalness: primaryMaterial?.metalness ?? 0,
    roughness: primaryMaterial?.roughness ?? 0.5,
    emissiveColor: primaryMaterial?.emissiveColor || "#000000",
    baseColorTexture: normalizeViewerAssetUrl(primaryMaterial?.baseColorTexture),
    initialZoom: product?.initialZoom ?? variant?.initialZoom ?? (savedSettings?.initialZoom as number) ?? 50,
    cameraOrbit:
      product?.cameraOrbit ||
      (variant as { cameraOrbit?: string })?.cameraOrbit ||
      (savedSettings?.cameraOrbit as string) ||
      undefined,
    cameraTarget:
      product?.cameraTarget ||
      (variant as { cameraTarget?: string })?.cameraTarget ||
      (savedSettings?.cameraTarget as string) ||
      undefined,
    backgroundType:
      product?.backgroundType || (savedSettings?.backgroundType as ViewerProduct["backgroundType"]) || "solid",
    backgroundGradientEnd:
      product?.backgroundGradientEnd || (savedSettings?.backgroundGradientEnd as string) || "#e5e7eb",
    environmentRotation:
      product?.environmentRotation ?? (savedSettings?.environmentRotation as number) ?? 0,
    useSkybox:
      Boolean(
        (product as { useSkybox?: boolean })?.useSkybox ??
          (savedSettings?.useSkybox as boolean | undefined) ??
          false,
      ),
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
