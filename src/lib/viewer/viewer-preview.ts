import type { ViewerProduct } from "@/components/features/viewer/types";

const PREFIX = "ar360:viewer-preview:";
/** Keep editor preview short so restored server materials win sooner. */
const MAX_AGE_MS = 10 * 60 * 1000;

export type ViewerPreviewPayload = ViewerProduct & {
  __previewAt?: number;
};

export function viewerPreviewStorageKey(productId: string) {
  return `${PREFIX}${String(productId || "").trim()}`;
}

export function writeViewerPreview(productId: string, product: ViewerProduct) {
  if (typeof window === "undefined" || !productId) return;
  const payload: ViewerPreviewPayload = {
    ...product,
    __previewAt: Date.now(),
  };
  try {
    sessionStorage.setItem(viewerPreviewStorageKey(productId), JSON.stringify(payload));
  } catch {
    // quota / private mode — preview still best-effort
  }
}

export function readViewerPreview(productId: string): ViewerProduct | null {
  if (typeof window === "undefined" || !productId) return null;
  try {
    const raw = sessionStorage.getItem(viewerPreviewStorageKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewerPreviewPayload;
    const at = Number(parsed.__previewAt || 0);
    if (!at || Date.now() - at > MAX_AGE_MS) {
      sessionStorage.removeItem(viewerPreviewStorageKey(productId));
      return null;
    }
    const { __previewAt: _drop, ...product } = parsed;
    return product as ViewerProduct;
  } catch {
    return null;
  }
}

export function clearViewerPreview(productId: string) {
  if (typeof window === "undefined" || !productId) return;
  try {
    sessionStorage.removeItem(viewerPreviewStorageKey(productId));
  } catch {
    // ignore
  }
}

/** Stable-ish fingerprint so tied versions prefer server when materials differ. */
export function viewerMaterialsFingerprint(product: ViewerProduct | null | undefined): string {
  if (!product) return "";
  try {
    return JSON.stringify({
      materialSettings: product.materialSettings || null,
      variants: (product.variants || []).map((v) => ({
        id: v.id,
        materialSettings: v.materialSettings || null,
      })),
      logoDecals: product.logoDecals || null,
      activeVariantId: product.activeVariantId || null,
    });
  } catch {
    return "";
  }
}
