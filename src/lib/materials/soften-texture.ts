/**
 * Soften a bump/height map by blurring it in canvas.
 * softness: 0 = sharp, 1 = very soft.
 *
 * Loads via same-origin fetch → blob so iPhone Safari does not depend on
 * ACAO headers (crossOrigin=anonymous + missing CORS = black/failed bump).
 *
 * Softness is perceptual: low slider values (e.g. 0.18) must still visibly
 * soften on close mobile views, without crushing the map so hard that the
 * pattern turns into a different moiré/grid look.
 */
const softenCache = new Map<string, string>();

/** Reference width the softness curve is tuned against. */
const SOFTEN_REF_SIDE = 1024;
/** Bump cache version — bump when blur math changes. */
const SOFTEN_CACHE_VERSION = "v3";

function hashTextureKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export async function softenTextureUri(
  uri: string,
  softness: number,
): Promise<string> {
  const amount = Math.max(0, Math.min(1, Number(softness) || 0));
  if (amount < 0.01 || !uri?.trim()) return uri;

  const key = cacheKey(uri, amount);
  const cached = softenCache.get(key);
  if (cached) return cached;

  const img = await loadImage(uri);
  // Keep enough resolution to preserve ridge direction; soften via blur, not crush.
  const maxSide = amount >= 0.75 ? 768 : amount >= 0.45 ? 896 : 1024;
  const srcW = img.naturalWidth || img.width || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  // Perceptual curve: 0.18 → ~0.35 effective, 0.4 → ~0.55 — matches canvas intent
  // better on close phone views without needing device-specific hacks.
  const perceptual = Math.pow(amount, 0.62);
  const baseRadius = 2.4 + perceptual * 26;
  const radius = Math.max(1.2, baseRadius * (Math.max(w, h) / SOFTEN_REF_SIDE));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return uri;

  // Two-pass blur reads softer without aliasing into a fake grid.
  const pass = Math.max(0.8, radius * 0.62);
  ctx.filter = `blur(${pass.toFixed(2)}px)`;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";

  const pass2 = document.createElement("canvas");
  pass2.width = w;
  pass2.height = h;
  const ctx2 = pass2.getContext("2d");
  if (ctx2) {
    ctx2.filter = `blur(${(pass * 0.85).toFixed(2)}px)`;
    ctx2.drawImage(canvas, 0, 0);
    ctx2.filter = "none";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(pass2, 0, 0);
  }

  let out = uri;
  try {
    out = canvas.toDataURL("image/png");
  } catch {
    return uri;
  }

  if (softenCache.size > 24) {
    const first = softenCache.keys().next().value;
    if (first) softenCache.delete(first);
  }
  softenCache.set(key, out);
  return out;
}

function cacheKey(uri: string, softness: number) {
  return `${SOFTEN_CACHE_VERSION}:${hashTextureKey(uri)}:${softness.toFixed(3)}`;
}

async function resolveToObjectUrl(uri: string): Promise<{ src: string; revoke: boolean }> {
  if (uri.startsWith("data:") || uri.startsWith("blob:")) {
    return { src: uri, revoke: false };
  }

  let fetchUrl = uri;
  if (uri.startsWith("/") && typeof window !== "undefined") {
    fetchUrl = `${window.location.origin}${uri}`;
  }

  const response = await fetch(fetchUrl, {
    credentials: "include",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error("texture load failed");
  }
  return { src: URL.createObjectURL(await response.blob()), revoke: true };
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return (async () => {
    const { src, revoke } = await resolveToObjectUrl(uri);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("texture load failed"));
        img.src = src;
      });
    } finally {
      if (revoke) URL.revokeObjectURL(src);
    }
  })();
}
