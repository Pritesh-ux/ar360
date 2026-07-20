const CUSTOMER_STORAGE_PREFIX = "/Storage/Customers/";

/** Optional CDN or public asset base (e.g. https://cdn.example.com or CloudFront domain). */
export function getAssetCdnBase(): string {
  const base =
    process.env.ASSET_CDN_BASE?.trim() ||
    process.env.NEXT_PUBLIC_ASSET_CDN_BASE?.trim() ||
    "";
  return base.replace(/\/$/, "");
}

/** Build a public asset URL, optionally prefixed with CDN base. */
export function toCdnAssetUrl(relativePath: string, origin = ""): string {
  if (!relativePath) return relativePath;

  let path = relativePath;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const cdn = getAssetCdnBase();
    if (!cdn) return path;
    try {
      const url = new URL(path);
      return `${cdn}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return path;
    }
  }

  if (!path.startsWith("/")) path = `/${path}`;

  const cdn = getAssetCdnBase();
  if (cdn) return `${cdn}${path}`;

  return origin ? `${origin}${path}` : path;
}

/** Whether customer product assets should be served through the protected proxy. */
export function isAssetProxyEnabled(): boolean {
  const mode = String(process.env.ASSET_PROXY_ENFORCE || "auto").toLowerCase();
  if (mode === "true") return true;
  if (mode === "false") return false;
  // auto: files live under storage/Customers (outside public/), so always proxy
  return true;
}

export function isCustomerStoragePath(url: string): boolean {
  if (!url) return false;
  const normalized = url.replace(/\\/g, "/");
  return normalized.includes("/Storage/Customers/") || normalized.startsWith("Storage/Customers/");
}

/** URLs that must be fetched with session cookies (dashboard drafts, protected storage). */
export function isProtectedAssetUrl(url: string): boolean {
  if (!url) return false;
  const normalized = url.replace(/\\/g, "/");
  if (normalized.includes("/api/assets/")) return true;
  return isCustomerStoragePath(normalized) && isAssetProxyEnabled();
}

/** Rewrite a public storage URL to the protected asset proxy (when enabled). */
export function toProtectedAssetUrl(url: string, origin = ""): string {
  if (!url || !isAssetProxyEnabled()) return toCdnAssetUrl(url, origin);

  let path = url;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return url;
    }
  }

  if (!path.startsWith("/")) path = `/${path}`;

  if (!path.startsWith(CUSTOMER_STORAGE_PREFIX)) return url;

  const proxied = `/api/assets${path}`;
  return origin ? `${origin}${proxied}` : proxied;
}

/** Parse /Storage/Customers/{customerUid}/Products/{productUid}/{fileName} */
export function parseCustomerAssetPath(pathParts: string[]): {
  customerUid: string;
  productUid: string;
  fileName: string;
} | null {
  // Expected: Storage, Customers, {customerUid}, Products, {productUid}, {fileName...}
  if (pathParts.length < 6) return null;
  if (pathParts[0] !== "Storage" || pathParts[1] !== "Customers" || pathParts[3] !== "Products") {
    return null;
  }

  const customerUid = pathParts[2];
  const productUid = pathParts[4];
  const fileName = pathParts.slice(5).join("/");

  if (!customerUid || !productUid || !fileName) return null;

  return { customerUid, productUid, fileName };
}
