import path from "path";
import fs from "fs/promises";
import { absoluteUrl } from "@/lib/url";
import { assertCan } from "@/lib/billing/permissions";
import {
  AR360_QR_CENTER_LOGO_PATH,
  AR360_QR_CENTER_LOGO_SIZE,
  CUSTOM_QR_CENTER_LOGO_SIZE,
  isAr360QrLogoUrl,
  resolveQrCenterLogo,
} from "@/lib/growth/qr-logo-shared";

export {
  AR360_QR_CENTER_LOGO_PATH,
  AR360_QR_CENTER_LOGO_SIZE,
  CUSTOM_QR_CENTER_LOGO_SIZE,
  isAr360QrLogoUrl,
  resolveQrCenterLogo,
} from "@/lib/growth/qr-logo-shared";

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

async function loadLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  const trimmed = logoUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const match = /^data:[^;]+;base64,(.+)$/i.exec(trimmed);
    if (!match) return null;
    return Buffer.from(match[1], "base64");
  }

  if (isAr360QrLogoUrl(trimmed) || trimmed.startsWith("/brand/")) {
    const rel = trimmed.includes("/brand/")
      ? trimmed.slice(trimmed.indexOf("/brand/") + 1)
      : "brand/qr-center-logo.png";
    try {
      return await fs.readFile(path.join(process.cwd(), "public", rel.replace(/^\//, "")));
    } catch {
      return fs.readFile(ar360QrCenterLogoDiskPath()).catch(() => null);
    }
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      return await fs.readFile(path.join(process.cwd(), "public", trimmed.replace(/^\//, "")));
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const response = await fetch(trimmed, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  return null;
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
 * Persist data-URL / oversized logos to disk so MySQL only stores a short path
 * (avoids max_allowed_packet failures on large base64 payloads).
 */
export async function persistQrLogoAsset(input: {
  customerUid: string;
  qrId: number;
  logoUrl: string;
}): Promise<string | null> {
  const raw = String(input.logoUrl || "").trim();
  if (!raw) return null;

  // Short path / platform logo — keep as-is.
  if (isAr360QrLogoUrl(raw)) return raw;
  if (raw.startsWith("/") && !raw.startsWith("//") && raw.length < 2048 && !raw.startsWith("/data:")) {
    return raw;
  }
  if (/^https?:\/\//i.test(raw) && raw.length < 2048 && !raw.includes(";base64,")) {
    return raw;
  }

  const buffer = await loadLogoBuffer(raw);
  if (!buffer) return null;

  try {
    const sharp = (await import("sharp")).default;
    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const safeCustomer = input.customerUid.replace(/[^a-zA-Z0-9_-]/g, "");
    const filename = `qr-logo-${input.qrId}-${Date.now()}.png`;
    const relativeDirectory = path.join("uploads", "qr-logos", safeCustomer);
    const roots = new Set(
      ["./", process.env.AR360_PROJECT_ROOT].filter(
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

    return `/${relativeDirectory.replace(/\\/g, "/")}/${filename}`;
  } catch (error) {
    console.warn("[qr-logo] persist failed", error);
    return null;
  }
}
