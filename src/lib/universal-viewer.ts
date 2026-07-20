import type { LogoDecal } from "@/components/shared/ModelViewer";
import { mapViewerEventToAnalytics, trackAnalyticsEvent } from "@/lib/analytics/track-event";

export type ViewerAnalyticsEvent = {
  id: string;
  productId: string;
  publicId: string;
  type:
    | "viewer_open"
    | "embed_open"
    | "qr_scan"
    | "ar_open"
    | "share_copy"
    | "embed_copy"
    | "variant_change"
    | "password_unlock";
  createdAt: string;
  userAgent?: string;
  referrer?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type MaterialSetting = {
  baseColor: string;
  metalness: number;
  roughness: number;
  emissiveColor: string;
  baseColorTexture?: string;
  metallicRoughnessTexture?: string;
  normalTexture?: string;
  emissiveTexture?: string;
  occlusionTexture?: string;
};

export type VariantConfig = {
  id: string;
  name: string;
  materialSettings: Record<number, MaterialSetting>;
  environmentImage: string;
  exposure: number;
  backgroundColor: string;
  transparent: boolean;
  shadowIntensity: number;
  shadowSoftness: number;
  autoRotate: boolean;
  cameraControls: boolean;
  showArButton: boolean;
  interactionPrompt: boolean;
  autoPlay: boolean;
  fov: number;
  poster?: string;
};

export type ViewerProduct = {
  id: string;
  title: string;
  category?: string;
  modelUrl?: string;
  fileName?: string;
  poster?: string;
  status?: string;
  views?: number;
  viewerSlug?: string;
  publicId?: string;
  version?: number;
  publishedAt?: string;
  updatedAt?: string;
  environmentImage?: string;
  exposure?: number;
  backgroundColor?: string;
  transparent?: boolean;
  shadowIntensity?: number;
  shadowSoftness?: number;
  autoRotate?: boolean;
  cameraControls?: boolean;
  showArButton?: boolean;
  interactionPrompt?: boolean;
  autoPlay?: boolean;
  fov?: number;
  materialSettings?: Record<number, MaterialSetting>;
  variants?: VariantConfig[];
  activeVariantId?: string;
  logoDecals?: LogoDecal[];

  brandLogo?: string;
  brandName?: string;
  brandColor?: string;
  isPasswordProtected?: boolean;
  sharePassword?: string;
  shareExpiry?: string;
  allowEmbed?: boolean;
};

export type ViewerAccessState =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: "not-found" | "unpublished" | "expired" | "password" };

export function safeParse<T>(value: string | null, fallback: T): T {
  try {
    if (!value) return fallback;
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

import { isLocalProductCacheEnabled } from "@/lib/clientProducts";

export function getProductsFromStorage(): ViewerProduct[] {
  if (!isLocalProductCacheEnabled()) return [];
  if (typeof window === "undefined") return [];
  return safeParse<ViewerProduct[]>(localStorage.getItem("ar_products"), []);
}

export function saveProductsToStorage(products: ViewerProduct[]) {
  if (!isLocalProductCacheEnabled()) return;
  if (typeof window === "undefined") return;
  localStorage.setItem("ar_products", JSON.stringify(products));
}

export function makeSafeSlug(title?: string, fallback?: string) {
  const base = (title || fallback || "product")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || fallback || "product";
}

export function findViewerProduct(id: string, products?: ViewerProduct[]) {
  if (!isLocalProductCacheEnabled()) return null;
  const list = products ?? getProductsFromStorage();
  return list.find((p) => p.id === id || p.publicId === id || p.viewerSlug === id) || null;
}

export function isPublished(product?: ViewerProduct | null) {
  return String(product?.status || "").toLowerCase() === "published";
}

export function isExpired(product?: ViewerProduct | null) {
  if (!product?.shareExpiry) return false;
  const expiry = new Date(product.shareExpiry).getTime();
  if (!Number.isFinite(expiry)) return false;
  return Date.now() > expiry;
}

export function needsPassword(product?: ViewerProduct | null) {
  return Boolean(product?.isPasswordProtected && product?.sharePassword);
}

export function checkViewerAccess(
  product: ViewerProduct | null,
  opts?: { allowUnpublished?: boolean; passwordUnlocked?: boolean }
): ViewerAccessState {
  if (!product) return { ok: false, reason: "not-found" };
  if (!opts?.allowUnpublished && !isPublished(product)) return { ok: false, reason: "unpublished" };
  if (isExpired(product)) return { ok: false, reason: "expired" };
  if (needsPassword(product) && !opts?.passwordUnlocked) return { ok: false, reason: "password" };
  return { ok: true };
}

export function getPermanentViewerId(product: ViewerProduct) {
  return product.publicId || product.viewerSlug || product.id;
}

export function getViewerPath(product: ViewerProduct) {
  return `/viewer/${getPermanentViewerId(product)}`;
}

export function getEmbedPath(product: ViewerProduct) {
  return `/embed/${getPermanentViewerId(product)}`;
}

export function getQrPath(product: ViewerProduct) {
  return `/qr/${getPermanentViewerId(product)}`;
}

export function resolveEnvironmentImage(value?: string) {
  if (!value || value === "default") return "neutral";
  if (value.startsWith("blob:")) return "neutral";
  const legacyPacked = new Set(["sunset", "studio", "city", "warehouse", "forest", "apartment"]);
  if (legacyPacked.has(value)) return "neutral";
  return value;
}

export function getActiveViewerSettings(product: ViewerProduct, activeVariant?: VariantConfig | null): VariantConfig {
  return (
    activeVariant || {
      id: "default",
      name: "Default",
      materialSettings: product.materialSettings || {},
      environmentImage: product.environmentImage || "neutral",
      exposure: product.exposure ?? 1,
      backgroundColor: product.backgroundColor || "#ffffff",
      transparent: product.transparent ?? false,
      shadowIntensity: product.shadowIntensity ?? 1,
      shadowSoftness: product.shadowSoftness ?? 1,
      autoRotate: product.autoRotate ?? true,
      cameraControls: product.cameraControls ?? true,
      showArButton: product.showArButton ?? true,
      interactionPrompt: product.interactionPrompt ?? true,
      autoPlay: product.autoPlay ?? true,
      fov: product.fov ?? 45,
      poster: product.poster,
    }
  );
}

export function ensurePublishedProductMetadata(product: ViewerProduct) {
  const publicId = product.publicId || product.viewerSlug || product.id;
  return {
    ...product,
    publicId,
    viewerSlug: product.viewerSlug || makeSafeSlug(product.title, product.id),
    publishedAt: product.publishedAt || product.updatedAt || new Date().toISOString(),
    version: product.version || 1,
  };
}

export function incrementProductViews(productId: string) {
  if (!isLocalProductCacheEnabled()) return;
  const products = getProductsFromStorage();
  const next = products.map((p) =>
    p.id === productId ? { ...p, views: (p.views || 0) + 1 } : p
  );
  saveProductsToStorage(next);
}

export function recordViewerEvent(
  product: ViewerProduct,
  type: ViewerAnalyticsEvent["type"],
  meta?: ViewerAnalyticsEvent["meta"]
) {
  if (typeof window === "undefined") return;

  const analyticsEvent = mapViewerEventToAnalytics(type);
  if (analyticsEvent) {
    trackAnalyticsEvent({
      event: analyticsEvent,
      productUid: getPermanentViewerId(product),
      meta,
    });
  }
}
