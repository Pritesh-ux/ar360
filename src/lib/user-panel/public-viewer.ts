"use client";

import { useEffect, useState } from "react";
import type { ViewerProduct } from "@/components/features/viewer/types";
import { normalizeProductForViewer } from "@/components/features/viewer/viewer-utils";
import { fetchPublicProduct } from "@/lib/public-product-client";
import { trackAnalyticsEvent } from "@/lib/analytics/track-event";

export type PublicViewerLoadOptions = {
  source?: string;
  trackEvent?: "viewer_open" | "open_embed" | false;
  retries?: number;
};

export async function loadPublicViewerProduct(
  id: string,
  options: PublicViewerLoadOptions = {},
): Promise<{ product: ViewerProduct | null; error: string | null }> {
  const retries = options.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await fetchPublicProduct<ViewerProduct>(id);
    if (result.product) {
      const product = normalizeProductForViewer(result.product);
      if (options.trackEvent) {
        trackAnalyticsEvent({
          event: options.trackEvent,
          productUid: product.productUid || product.id || id,
          meta: { source: options.source || "direct", route: options.trackEvent === "open_embed" ? "/embed/[id]" : "/viewer/[id]" },
        });
      }
      return { product, error: null };
    }
    if (attempt < retries) {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      continue;
    }
    return { product: null, error: result.error || "Product not found." };
  }

  return { product: null, error: "Product not found." };
}

export function usePublicViewerProduct(id: string, options: PublicViewerLoadOptions = {}) {
  const [product, setProduct] = useState<ViewerProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      const result = await loadPublicViewerProduct(id, options);
      if (cancelled) return;
      setProduct(result.product);
      setError(result.error);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id, options.source, options.trackEvent, options.retries]);

  return { product, loading, error, setProduct };
}

export function getPublicViewerUrl(publicId: string, origin?: string) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/viewer/${publicId}`;
}

export function getEmbedViewerUrl(publicId: string, origin?: string) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/embed/${publicId}`;
}

export function buildEmbedIframeCode(publicId: string, origin?: string) {
  const src = getEmbedViewerUrl(publicId, origin);
  return `<iframe src="${src}" title="AR360 3D Viewer" width="100%" height="480" style="border:0;border-radius:16px;" allow="xr-spatial-tracking; gyroscope; accelerometer; magnetometer; camera; fullscreen"></iframe>`;
}
