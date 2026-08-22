export type ARDevice = "ios" | "android" | "desktop" | "unknown";

export type ARExperienceProduct = {
  id?: string;
  productUid?: string;
  title?: string;
  modelUrl?: string;
  /** Smaller GLB for Scene Viewer / mobile AR when the main model is huge. */
  arModelUrl?: string;
  usdzUrl?: string;
  poster?: string;
  /** Full-quality model size in bytes (for mobile AR safety gate). */
  modelBytes?: number | null;
  realScale?: boolean;
  /** floor (default) or wall — drives WebXR / Scene Viewer vertical placement. */
  arPlacement?: "floor" | "wall";
  /**
   * Uniform meters-per-authored-unit factor for Scene Viewer
   * (e.g. 0.01 when the GLB was exported in centimeters).
   */
  arModelScale?: number | null;
};

export type ARExperienceEvent =
  | "ar_open_requested"
  | "ar_onboarding_open"
  | "ar_launch_attempt"
  | "ar_launch_success"
  | "ar_launch_failed"
  | "ar_fallback"
  | "ar_return_to_viewer"
  | "ar_unsupported"
  | "ar_mobile_share"
  | "ar_link_copy";

export function detectARDevice(userAgent?: string): ARDevice {
  const ua = (userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();

  // iPadOS 13+ can report as Macintosh while touch is available.
  const isAppleTouchDesktop =
    typeof navigator !== "undefined" &&
    /macintosh/.test(ua) &&
    "maxTouchPoints" in navigator &&
    navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(ua) || isAppleTouchDesktop) return "ios";
  if (/android/.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/.test(ua)) return "desktop";
  return "unknown";
}

export function getAbsoluteUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("blob:") || pathOrUrl.startsWith("data:")) return pathOrUrl;

  try {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      const url = new URL(pathOrUrl);
      if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) {
        const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://ar360studio.com");
        return `${base.replace(/\/$/, "")}${url.pathname}${url.search}${url.hash}`;
      }
      return pathOrUrl;
    }

    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://ar360studio.com");
    return new URL(pathOrUrl, base.replace(/\/$/, "")).toString();
  } catch {
    return pathOrUrl;
  }
}

export function getProductKey(product: ARExperienceProduct, fallback = "") {
  return product.productUid || product.id || fallback;
}

export function getCleanViewerUrl(fallbackUrl?: string) {
  if (fallbackUrl) {
    try {
      const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://ar360studio.com");
      const url = new URL(
        fallbackUrl,
        base.replace(/\/$/, ""),
      );
      url.searchParams.delete("openAR");
      url.searchParams.delete("ar");
      url.searchParams.delete("mode");
      url.searchParams.delete("source");
      return url.toString();
    } catch {
      return fallbackUrl;
    }
  }
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  url.searchParams.delete("openAR");
  url.searchParams.delete("ar");
  url.searchParams.delete("mode");
  url.searchParams.delete("source");
  return url.toString();
}

/** Viewer link for phone QR / share — opens AR sheet on mobile. */
export function getPhoneShareViewerUrl(fallbackUrl?: string) {
  const clean = getCleanViewerUrl(fallbackUrl);
  if (!clean) return "";

  try {
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://ar360studio.com");
    const url = new URL(
      clean,
      base.replace(/\/$/, ""),
    );
    url.searchParams.set("openAR", "1");
    return url.toString();
  } catch {
    return clean;
  }
}

export function buildSceneViewerIntent(product: ARExperienceProduct, fallbackUrl?: string) {
  // Prefer AR-lite when present — Scene Viewer downloads this URL outside the Safari tab.
  let file = getAbsoluteUrl(product.arModelUrl || product.modelUrl);
  const fallback = getCleanViewerUrl(fallbackUrl);

  if (!file) return fallback;

  // Scene Viewer loads the file URL directly and ignores <model-viewer scale>.
  const arScale = Number(product.arModelScale);
  if (Number.isFinite(arScale) && arScale > 0 && Math.abs(arScale - 1) >= 1e-9) {
    try {
      const scaled = new URL(file);
      scaled.searchParams.set("arScale", String(Number(arScale.toPrecision(6))));
      file = scaled.toString();
    } catch {
      // keep original file URL
    }
  }

  const params = new URLSearchParams({
    file,
    mode: "ar_preferred",
    title: product.title || "AR Product",
    // Resizing is the default; only an explicit 1:1 lock pins the AR scale.
    resizable: product.realScale === true ? "false" : "true",
    // Wall products (mirrors, fixtures) need vertical surface placement on Android.
    enable_vertical_placement: product.arPlacement === "wall" ? "true" : "false",
    disable_occlusion: "false",
    link: fallback,
  });

  return `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
}

export function buildQuickLookUrl(product: ARExperienceProduct, canonicalUrl?: string) {
  const usdz = getAbsoluteUrl(product.usdzUrl);
  if (!usdz) return "";

  const params = new URLSearchParams();
  // Resizing is the default; only an explicit 1:1 lock pins the AR scale.
  params.set("allowsContentScaling", product.realScale === true ? "0" : "1");

  const canonical = getCleanViewerUrl(canonicalUrl);
  if (canonical) params.set("canonicalWebPageURL", canonical);

  return `${usdz}#${params.toString()}`;
}

/** Open Apple Quick Look via a temporary rel="ar" anchor (Safari requirement). */
export function openQuickLookAr(product: ARExperienceProduct, canonicalUrl?: string) {
  const href = buildQuickLookUrl(product, canonicalUrl);
  if (!href || typeof document === "undefined") return false;

  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = href;
  const img = document.createElement("img");
  img.alt = product.title || "AR";
  img.src = getAbsoluteUrl(product.poster) || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  anchor.appendChild(img);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

export function getARInstruction(
  device = detectARDevice(),
  arPlacement: "floor" | "wall" = "floor",
) {
  const surface =
    arPlacement === "wall"
      ? "a wall or vertical surface"
      : "the floor or a flat surface";

  if (device === "ios") {
    return {
      title: "Open in iPhone AR",
      description: `Quick Look will open when USDZ is available. Move your phone slowly, find ${surface}, then place the product.`,
      primary: "Open iPhone AR",
      deviceLabel: "iPhone / iPad",
    };
  }

  if (device === "android") {
    return {
      title: "Open in Android AR",
      description:
        arPlacement === "wall"
          ? "Scene Viewer will open using your GLB model. Move your phone slowly, point at a wall, then tap to place."
          : "Scene Viewer will open using your GLB model. Move your phone slowly, find the floor, then tap to place.",
      primary: "Open Android AR",
      deviceLabel: "Android",
    };
  }

  return {
    title: "Open AR on mobile",
    description:
      "AR works best on Android Chrome or iPhone Safari. Share or copy this viewer link and open it on your phone.",
    primary: "Open on supported mobile",
    deviceLabel: "Desktop",
  };
}

export function saveARReturnState(productId: string, viewerUrl?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    "ar360_ar_return_state",
    JSON.stringify({
      productId,
      viewerUrl: getCleanViewerUrl(viewerUrl),
      createdAt: new Date().toISOString(),
    }),
  );
}

export function readARReturnState() {
  if (typeof window === "undefined") return null;
  return safeJsonParse<{ productId?: string; viewerUrl?: string; createdAt?: string } | null>(
    sessionStorage.getItem("ar360_ar_return_state"),
    null,
  );
}

export function clearARReturnState() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("ar360_ar_return_state");
}

import {
  mapARExperienceEventToAnalytics,
  trackAnalyticsEvent,
} from "@/lib/analytics/track-event";

export function trackARExperienceEvent(
  productId: string,
  event: ARExperienceEvent,
  meta: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;

  const analyticsEvent = mapARExperienceEventToAnalytics(event, meta);
  if (analyticsEvent) {
    trackAnalyticsEvent({ event: analyticsEvent, productUid: productId, meta });
  }

  const key = "ar_analytics_events";
  const current = safeJsonParse<Array<Record<string, unknown>>>(localStorage.getItem(key), []);

  current.unshift({
    id: `ar-pro-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId,
    event,
    meta,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });

  localStorage.setItem(key, JSON.stringify(current.slice(0, 1000)));

  const summaryKey = "ar_analytics";
  const summary = safeJsonParse<Record<string, any>>(localStorage.getItem(summaryKey), {});
  summary[productId] ??= {
    views: 0,
    embedViews: 0,
    qrScans: 0,
    arOpens: 0,
    screenshots: 0,
    shares: 0,
  };

  if (event === "ar_launch_success") summary[productId].arOpens = (summary[productId].arOpens || 0) + 1;
  if (event === "ar_mobile_share" || event === "ar_link_copy") {
    summary[productId].shares = (summary[productId].shares || 0) + 1;
  }

  localStorage.setItem(summaryKey, JSON.stringify(summary));
}

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
