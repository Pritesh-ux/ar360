import path from "path";
import fs from "fs/promises";
import { absoluteUrl } from "@/lib/url";
import { assertCan } from "@/lib/billing/permissions";
import {
  AR360_QR_CENTER_LOGO_PATH,
  isAr360QrLogoUrl,
  resolveQrCenterLogo,
} from "@/lib/growth/qr-logo-shared";
import {
  isSafeStoredQrLogoPath,
  normalizeQrLogoPublicPath,
  resolveContainedQrLogoFile,
} from "@/lib/growth/qr-logo-path";
import {
  SAFE_IMAGE_MAX_BYTES,
  bufferLooksLikeAllowedImage,
  fetchSafeOutboundImage,
  isAllowedImageContentType,
  type DnsLookupFn,
  type FetchFn,
} from "@/lib/security/ssrf";

export {
  AR360_QR_CENTER_LOGO_PATH,
  AR360_QR_CENTER_LOGO_SIZE,
  CUSTOM_QR_CENTER_LOGO_SIZE,
  isAr360QrLogoUrl,
  resolveQrCenterLogo,
} from "@/lib/growth/qr-logo-shared";

export {
  isSafeStoredQrLogoPath,
  normalizeQrLogoPublicPath,
  resolveContainedQrLogoFile,
} from "@/lib/growth/qr-logo-path";

export function ar360QrCenterLogoUrl(origin?: string) {
  if (origin) {
    try {
      return new URL(AR360_QR_CENTER_LOGO_PATH, origin).toString();
    } catch {
      // fall through
    }
  }
  return absoluteUrl(AR360_QR_CENTER_LOGO_PATH);
}

export function ar360QrCenterLogoDiskPath() {
  return path.join(process.cwd(), "public", "brand", "qr-center-logo.png");
}

export async function resolveQrCenterLogoForCustomer(input: {
  customerUid: string;
  customLogoUrl?: string | null;
  customLogoSize?: number | null;
  origin?: string;
}) {
  const gate = await assertCan(input.customerUid, "custom_branding").catch(() => ({
    allowed: false as const,
  }));
  return resolveQrCenterLogo({
    customLogoUrl: input.customLogoUrl,
    allowCustomBranding: Boolean(gate.allowed),
    customLogoSize: input.customLogoSize,
    brandLogoUrl: ar360QrCenterLogoUrl(input.origin),
  });
}

const DATA_URL_RE =
  /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i;

export type LoadQrLogoOptions = {
  /** Test seam for SSRF DNS checks. */
  lookupFn?: DnsLookupFn;
  /** Test seam for outbound fetch. */
  fetchFn?: FetchFn;
};

function decodeDataUrlLogo(trimmed: string): Buffer | null {
  const match = DATA_URL_RE.exec(trimmed);
  if (!match) return null;
  const mime = match[1]!.toLowerCase().replace("image/jpg", "image/jpeg");
  if (!isAllowedImageContentType(mime)) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2]!, "base64");
  } catch {
    return null;
  }
  if (!buffer.length || buffer.length > SAFE_IMAGE_MAX_BYTES) return null;
  if (!bufferLooksLikeAllowedImage(buffer)) return null;
  return buffer;
}

/**
 * Load QR center-logo bytes. Fail closed (null) on unsafe input.
 * Allowed: validated data URLs, contained public brand/upload paths, SSRF-safe remote images.
 */
export async function loadQrLogoBuffer(
  logoUrl: string,
  options?: LoadQrLogoOptions,
): Promise<Buffer | null> {
  const trimmed = String(logoUrl || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    return decodeDataUrlLogo(trimmed);
  }

  // Prefer local public files (brand + persisted uploads) over network fetch.
  const localPath = normalizeQrLogoPublicPath(trimmed);
  if (localPath) {
    const resolved = await resolveContainedQrLogoFile(localPath);
    if (resolved.ok === false) {
      // Known AR360 brand URL may be missing on disk in some checkouts — soft-fallback.
      if (isAr360QrLogoUrl(trimmed)) {
        try {
          const fallback = await fs.readFile(ar360QrCenterLogoDiskPath());
          if (fallback.length && fallback.length <= SAFE_IMAGE_MAX_BYTES) return fallback;
        } catch {
          return null;
        }
      }
      return null;
    }
    try {
      const buf = await fs.readFile(resolved.absolutePath);
      if (!buf.length || buf.length > SAFE_IMAGE_MAX_BYTES) return null;
      const ext = path.extname(resolved.absolutePath).toLowerCase();
      // SVG brand marks are allowed on disk; raster custom uploads must sniff as images.
      if (ext !== ".svg" && !bufferLooksLikeAllowedImage(buf)) return null;
      return buf;
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const fetched = await fetchSafeOutboundImage(trimmed, {
      lookupFn: options?.lookupFn,
      fetchFn: options?.fetchFn,
      maxBytes: SAFE_IMAGE_MAX_BYTES,
      timeoutMs: 8_000,
      maxRedirects: 3,
    });
    if (fetched.ok === false) return null;
    return fetched.buffer;
  }

  // Absolute / relative paths outside allowlist — reject (closes prior public/ LFI).
  return null;
}

/** @deprecated internal alias — use loadQrLogoBuffer */
async function loadLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  return loadQrLogoBuffer(logoUrl);
}

/**
 * Composite a center logo (with white quiet pad) onto a raw QR PNG buffer.
 */
export async function stampQrCenterLogo(input: {
  qrPng: Buffer;
  logoUrl: string;
  logoSizePercent: number;
}): Promise<Buffer> {
  const logoBytes = await loadLogoBuffer(input.logoUrl);
  if (!logoBytes) return input.qrPng;

  try {
    const sharp = (await import("sharp")).default;
    const qrMeta = await sharp(input.qrPng).metadata();
    const canvas = qrMeta.width || 1024;
    const targetWidth = Math.max(
      48,
      Math.round(canvas * (Math.min(40, Math.max(12, input.logoSizePercent)) / 100)),
    );

    const resizedLogo = await sharp(logoBytes)
      .ensureAlpha()
      .trim({ threshold: 24 })
      .resize({ width: targetWidth, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });

    const padX = Math.max(6, Math.round(canvas * 0.012));
    const padY = Math.max(4, Math.round(canvas * 0.008));
    const plateW = resizedLogo.info.width + padX * 2;
    const plateH = resizedLogo.info.height + padY * 2;

    const plate = await sharp({
      create: {
        width: plateW,
        height: plateH,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .composite([{ input: resizedLogo.data, left: padX, top: padY }])
      .toBuffer();

    const left = Math.max(0, Math.round((canvas - plateW) / 2));
    const top = Math.max(0, Math.round(((qrMeta.height || canvas) - plateH) / 2));

    return sharp(input.qrPng)
      .composite([{ input: plate, left, top }])
      .png()
      .toBuffer();
  } catch (error) {
    console.warn("[qr-logo] stamp failed; keeping plain QR", error);
    return input.qrPng;
  }
}

/**
 * Persist data-URL / remote logos to disk under public/uploads/qr-logos/{customer}/.
 * Unsafe remote URLs and path traversal inputs fail closed (null) — callers must not
 * fall back to storing the raw attacker-controlled URL.
 */
export async function persistQrLogoAsset(input: {
  customerUid: string;
  qrId: number;
  logoUrl: string;
}): Promise<string | null> {
  const raw = String(input.logoUrl || "").trim();
  if (!raw) return null;

  // Canonical platform logo — keep short path.
  if (isAr360QrLogoUrl(raw)) return AR360_QR_CENTER_LOGO_PATH;

  // Already a contained public path — keep as-is after normalization.
  if (isSafeStoredQrLogoPath(raw)) {
    const normalized = normalizeQrLogoPublicPath(raw);
    if (!normalized) return null;
    const resolved = await resolveContainedQrLogoFile(normalized);
    // Allow storing the normalized path even if the file is about to be written elsewhere;
    // if it claims to exist under allowlist but is missing, still accept normalized path
    // only when it already resolves, otherwise re-load via buffer path.
    if (resolved.ok) return resolved.publicUrlPath;
  }

  const buffer = await loadQrLogoBuffer(raw);
  if (!buffer) return null;

  try {
    const sharp = (await import("sharp")).default;
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (optimized.length > SAFE_IMAGE_MAX_BYTES) return null;

    const safeCustomer = input.customerUid.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeCustomer) return null;
    const filename = `qr-logo-${input.qrId}-${Date.now()}.png`;
    const relativeDirectory = path.posix.join("uploads", "qr-logos", safeCustomer);
    const roots = new Set(
      ["./", process.env["AR360_PROJECT_ROOT"]].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
    );

    await Promise.all(
      [...roots].map(async (root) => {
        const dir = path.join(root, "public", relativeDirectory);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, filename), optimized);
      }),
    );

    return `/${relativeDirectory}/${filename}`;
  } catch (error) {
    console.warn("[qr-logo] persist failed", error);
    return null;
  }
}
