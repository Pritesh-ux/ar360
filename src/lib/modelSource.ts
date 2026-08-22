import { isCustomerStoragePath, toProtectedAssetUrl } from "@/lib/billing/asset-url";
import { sanitizeOrigin } from "@/lib/url";

type ProductModelSource = {
  modelUrl?: string;
  fileName?: string;
  publicFolder?: string;
  productUid?: string;
  id?: string;
  updatedAt?: string | number | null;
};

function normalizePublicPath(value?: string) {
  if (!value) return "";

  const normalized = value
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");

  const publicIndex = normalized.toLowerCase().lastIndexOf("/public/");
  if (publicIndex >= 0) {
    return normalized.slice(publicIndex + "/public".length) || "";
  }

  const storageIndex = normalized.toLowerCase().lastIndexOf("/storage/");
  if (storageIndex >= 0) {
    return normalized.slice(storageIndex) || "";
  }

  return normalized;
}

function isBrowserOnlyUrl(value: string) {
  return value.startsWith("blob:") || value.startsWith("data:");
}

function isAbsoluteHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function toCurrentOriginUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isBrowserOnlyUrl(raw)) return raw;
  // Material Inspector unpin sentinel — never rewrite into `/__clear__` (404).
  if (raw === "__clear__" || raw === "/__clear__") return "";

  // LAN/mobile fix: product files must be loaded from the same origin that
  // opened the viewer. A URL saved while developing on localhost will not load
  // from a phone, so rewrite localhost/127.0.0.1 URLs to the current browser
  // origin. Keep external CDN URLs unchanged.
  if (typeof window !== "undefined") {
    try {
      if (isAbsoluteHttpUrl(raw)) {
        const url = new URL(raw);
        const isLocalDevHost =
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1" ||
          url.hostname === "0.0.0.0";

        if (isLocalDevHost) {
          return `${sanitizeOrigin(window.location.origin)}${url.pathname}${url.search}${url.hash}`;
        }

        if (url.origin === window.location.origin) return url.href;
        return raw;
      }

      const normalized = normalizePublicPath(raw);
      const pathOnly = normalized.startsWith("/") ? normalized : `/${normalized}`;
      return `${sanitizeOrigin(window.location.origin)}${pathOnly}`;
    } catch {
      // Fall back to relative normalization below.
    }
  }

  if (isAbsoluteHttpUrl(raw)) return raw;
  const normalized = normalizePublicPath(raw);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function encodeFileName(fileName: string) {
  if (!fileName) return "";
  if (fileName.includes("%")) return fileName;
  return encodeURIComponent(fileName);
}

/**
 * Product uploads always persist bytes as `model.glb`. Older records may still
 * store the original client filename in modelUrl/fileName — rewrite those to
 * the canonical on-disk name so Canvas/viewer never 404 on Chair.glb etc.
 */
export function canonicalizeProductGlbPath(url: string): string {
  const raw = String(url || "").trim();
  if (!raw || isBrowserOnlyUrl(raw)) return raw;

  try {
    const abs = isAbsoluteHttpUrl(raw)
      ? new URL(raw)
      : new URL(raw, "https://ar360.local");
    const pathOnly = abs.pathname.replace(/\\/g, "/");
    const rewritten = pathOnly.replace(
      /(\/Products\/[^/]+)\/(?!model\.glb$)[^/]+\.gl(?:b|tf)$/i,
      "$1/model.glb",
    );
    if (rewritten === pathOnly) return raw;

    if (isAbsoluteHttpUrl(raw)) {
      abs.pathname = rewritten;
      return abs.toString();
    }
    return `${rewritten}${abs.search}${abs.hash}`;
  } catch {
    return raw.replace(
      /(\/Products\/[^/]+)\/(?!model\.glb$)[^/]+\.gl(?:b|tf)(?=$|\?|#)/i,
      "$1/model.glb",
    );
  }
}

function normalizeModelViewerSrc(src: string) {
  if (typeof window === "undefined") return src;

  try {
    const cleanOrigin = sanitizeOrigin(window.location.origin);
    const url = new URL(src, cleanOrigin);

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0") {
      const cleanUrl = new URL(cleanOrigin);
      url.host = cleanUrl.host;
      url.protocol = cleanUrl.protocol;
    }

    if (url.origin !== window.location.origin) return src;

    if (url.pathname.startsWith("/api/assets/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    const storageIndex = url.pathname.indexOf("/Storage/Customers/");
    if (storageIndex >= 0) {
      return `/api/assets${url.pathname.slice(storageIndex)}${url.search}${url.hash}`;
    }

    if (url.pathname.startsWith("/")) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Fall through to legacy normalization below.
  }

  return toCurrentOriginUrl(src) || src;
}

function resolveModelSrc(src: string) {
  const canonical = canonicalizeProductGlbPath(src);
  const withOrigin = toCurrentOriginUrl(canonical) || canonical;
  if (isCustomerStoragePath(withOrigin)) {
    const origin = typeof window !== "undefined" ? sanitizeOrigin(window.location.origin) : "";
    return toProtectedAssetUrl(withOrigin, origin);
  }
  return withOrigin;
}

export function getProductModelSrc(product?: ProductModelSource | null) {
  if (!product) return undefined;

  const modelUrl = product.modelUrl?.trim() || "";
  const fileName = product.fileName?.trim() || "";
  const publicFolder = normalizePublicPath(product.publicFolder);

  let src: string | undefined;

  if (modelUrl && !isBrowserOnlyUrl(modelUrl)) {
    src = resolveModelSrc(modelUrl);
  } else if (publicFolder) {
    const safeFolder = publicFolder.startsWith("/") ? publicFolder : `/${publicFolder}`;
    // Uploads always write `model.glb` on disk. `fileName` may still be the
    // original client name (e.g. Chair.glb) for display — never use it here.
    src = resolveModelSrc(`${safeFolder}/model.glb`);
  } else if (fileName) {
    // Public `/models/*` demos keep their real filenames.
    src = resolveModelSrc(`/models/${encodeFileName(fileName)}`);
  } else {
    src = modelUrl || undefined;
  }

  if (!src) return src;

  // Bust browser cache when the same storage path is overwritten (sample chair replace).
  const stamp = product.updatedAt ? Date.parse(String(product.updatedAt)) : NaN;
  if (Number.isFinite(stamp) && stamp > 0) {
    const joiner = src.includes("?") ? "&" : "?";
    src = `${src}${joiner}v=${Math.floor(stamp / 1000)}`;
  }

  if (typeof window === "undefined") return src;
  return normalizeModelViewerSrc(src);
}
