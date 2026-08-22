"use client";

import { useEffect, useState } from "react";
import type { ViewerProduct } from "@/components/features/viewer/types";
import { normalizeProductForViewer } from "@/components/features/viewer/viewer-utils";
import { fetchPublicProduct } from "@/lib/public-product-client";
import { trackAnalyticsEvent } from "@/lib/analytics/track-event";
import { sanitizeOrigin } from "@/lib/url";
import { clearViewerPreview, readViewerPreview, viewerMaterialsFingerprint } from "@/lib/viewer/viewer-preview";

export type PublicViewerLoadOptions = {
  source?: string;
  trackEvent?: "viewer_open" | "open_embed" | false;
  retries?: number;
  allowPreview?: boolean;
  clientUid?: string | null;
};

export async function loadPublicViewerProduct(
  id: string,
  options: PublicViewerLoadOptions = {},
): Promise<{ product: ViewerProduct | null; error: string | null }> {
  const retries = options.retries ?? 2;

  if (options.allowPreview) {
    const preview = readViewerPreview(id);
    if (preview) {
      // Preview is editor sessionStorage — drop it when the saved product is newer
      // (e.g. server-side material restore), otherwise viewer/AR keep the bad look.
      const saved = await fetchPublicProduct<ViewerProduct>(id, {
        clientUid: options.clientUid,
      });
      const previewVersion = Number((preview as { version?: number }).version || 0);
      const savedVersion = Number((saved.product as { version?: number } | null)?.version || 0);
      const materialsDiffer =
        Boolean(saved.product) &&
        viewerMaterialsFingerprint(saved.product) !== viewerMaterialsFingerprint(preview);
      // Prefer server when it is newer, or when versions tie but materials differ
      // (restore without a clean version bump). Editor View AR bumps preview version.
      if (saved.product && (savedVersion > previewVersion || (savedVersion === previewVersion && materialsDiffer))) {
        clearViewerPreview(id);
      } else {
        const product = normalizeProductForViewer(preview);
        if (options.trackEvent) {
          const productUid = product.productUid || product.id || id;
          const trafficSource = options.source || "direct";
          trackAnalyticsEvent({
            event: options.trackEvent,
            productUid,
            meta: {
              source: trafficSource,
              trafficSource,
              route: options.trackEvent === "open_embed" ? "/embed/[id]" : "/viewer/[id]",
              preview: true,
            },
          });
          if (trafficSource === "share") {
            trackAnalyticsEvent({
              event: "share_view",
              productUid,
              meta: { trafficSource: "share" },
            });
          }
        }
        return { product, error: null };
      }
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await fetchPublicProduct<ViewerProduct>(id, {
      clientUid: options.clientUid,
    });
    if (result.product) {
      const product = normalizeProductForViewer(result.product);
      if (options.trackEvent) {
        const productUid = product.productUid || product.id || id;
        const trafficSource = options.source || "direct";
        trackAnalyticsEvent({
          event: options.trackEvent,
          productUid,
          meta: {
            source: trafficSource,
            trafficSource,
            route: options.trackEvent === "open_embed" ? "/embed/[id]" : "/viewer/[id]",
            client: options.clientUid || undefined,
          },
        });
        if (trafficSource === "share") {
          trackAnalyticsEvent({
            event: "share_view",
            productUid,
            meta: { trafficSource: "share" },
          });
        }
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

  const source = options.source;
  const trackEvent = options.trackEvent;
  const retries = options.retries;
  const allowPreview = options.allowPreview === true;
  const clientUid = options.clientUid || "";

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!id) {
        setProduct(null);
        setError("Product not found.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await loadPublicViewerProduct(id, {
        source,
        trackEvent,
        retries,
        allowPreview,
        clientUid: clientUid || null,
      });
      if (cancelled) return;
      setProduct(result.product);
      setError(result.error);
      setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id, source, trackEvent, retries, allowPreview, clientUid]);

  return { product, loading, error, setProduct };
}

export function getPublicViewerUrl(publicId: string, origin?: string) {
  const base = sanitizeOrigin(origin || (typeof window !== "undefined" ? window.location.origin : ""));
  return `${base}/viewer/${String(publicId || "").trim()}`;
}

/** Seller-facing production URL — always /viewer/{publicId}, never /qr/. */
export function getCanonicalPublicViewerUrl(publicId: string, origin?: string) {
  return getPublicViewerUrl(publicId, origin);
}

export function getEmbedViewerUrl(publicId: string, origin?: string) {
  const base = sanitizeOrigin(origin || (typeof window !== "undefined" ? window.location.origin : ""));
  return `${base}/embed/${publicId}`;
}

export function buildEmbedIframeCode(publicId: string, origin?: string) {
  const src = getEmbedViewerUrl(publicId, origin);
  return `<iframe src="${src}" width="100%" height="600" style="border:0;" allow="xr-spatial-tracking; fullscreen; camera; microphone" loading="lazy"></iframe>`;
}
