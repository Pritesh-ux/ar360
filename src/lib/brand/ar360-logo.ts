/** Canonical AR360 brand — keep in sync with `BrandLogo` / public/brand assets. */

import fs from "fs";
import path from "path";
import { absoluteUrl } from "@/lib/url";

export const BRAND_LIME = "#B9FF2C";
export const BRAND_INK = "#0A0B14";
export const BRAND_INK_ON_DARK = "#FAFAFA";

/** Legacy geometry kept for any remaining SVG callers. */
export const BRAND_SQUIRCLE_PATH =
  "M14 2.4 C19.6 2.4 22.4 3.4 24 5 C25.6 6.6 26.6 9.4 26.6 14 C26.6 18.6 25.6 21.4 24 23 C22.4 24.6 19.6 25.6 14 25.6 C8.4 25.6 5.6 24.6 4 23 C2.4 21.4 1.4 18.6 1.4 14 C1.4 9.4 2.4 6.6 4 5 C5.6 3.4 8.4 2.4 14 2.4Z";

export const BRAND_WORDMARK_VIEWBOX = { width: 1024, height: 267 } as const;

export const BRAND_ASSET_PATHS = {
  wordmarkOnLight: "/brand/ar360-wordmark-on-light.png",
  wordmarkOnDark: "/brand/ar360-wordmark-on-dark.png",
  markOnLight: "/brand/ui-mark.png",
  markOnDark: "/brand/ui-mark-on-dark.png",
} as const;

type Tone = "light" | "dark";

export function brandInk(tone: Tone = "light") {
  return tone === "dark" ? BRAND_INK_ON_DARK : BRAND_INK;
}

/** Content-ID for inline (CID) logos — preferred so Gmail does not depend on remote fetch. */
export const AR360_EMAIL_LOGO_CID = "ar360-wordmark@ar360studio";

export function emailWordmarkPublicPath(tone: Tone = "dark") {
  return tone === "dark"
    ? "/brand/ar360-wordmark-email-on-dark.png"
    : "/brand/ar360-wordmark-email-on-light.png";
}

/** Hosted PNG — Gmail and most clients block data: SVG/data URIs in email. */
export function getAr360EmailWordmarkUrl(tone: Tone = "dark") {
  return absoluteUrl(emailWordmarkPublicPath(tone));
}

export function getAr360EmailMarkUrl() {
  return absoluteUrl("/brand/ar360-mark-email.png");
}

export function getAr360EmailLogoHtml(input: {
  height?: number;
  href?: string;
  /** dark = white AR (for dark email header); light = ink AR */
  tone?: Tone;
  /** Prefer CID attachment (default). Set false for hosted absolute URL only. */
  inlineCid?: boolean;
} = {}) {
  const height = input.height ?? 32;
  const width = Math.round(height * (BRAND_WORDMARK_VIEWBOX.width / BRAND_WORDMARK_VIEWBOX.height));
  const tone = input.tone || "dark";
  const useCid = input.inlineCid !== false;
  const src = useCid ? `cid:${AR360_EMAIL_LOGO_CID}` : getAr360EmailWordmarkUrl(tone);
  const img = `<img src="${src}" width="${width}" height="${height}" alt="AR360 Studio" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;" />`;
  if (!input.href) return img;
  return `<a href="${input.href}" style="text-decoration:none;display:inline-block;line-height:0;">${img}</a>`;
}

/** Prefer hosted PNG wordmark for invoice / print HTML. */
export function getAr360WordmarkHtml(input: { tone?: Tone; height?: number; emailSafe?: boolean } = {}) {
  if (input.emailSafe) {
    return getAr360EmailLogoHtml({ height: input.height ?? 28, tone: input.tone || "dark" });
  }
  const height = input.height ?? 28;
  const width = Math.round(height * (BRAND_WORDMARK_VIEWBOX.width / BRAND_WORDMARK_VIEWBOX.height));
  const tone = input.tone || "light";
  const src =
    tone === "dark" ? BRAND_ASSET_PATHS.wordmarkOnDark : BRAND_ASSET_PATHS.wordmarkOnLight;
  return `<img src="${src}" width="${width}" height="${height}" alt="AR360 Studio" style="display:block;width:${width}px;height:${height}px;border:0;" />`;
}

function resolveBrandFile(relPublicPath: string) {
  const file = path.join(process.cwd(), "public", relPublicPath.replace(/^\//, ""));
  if (fs.existsSync(file)) return file;
  const alt = path.join(process.cwd(), relPublicPath.replace(/^\//, ""));
  return fs.existsSync(alt) ? alt : null;
}

/** Draw the AR360 Studio wordmark onto a PDFKit document. Returns occupied size. */
export function drawAr360WordmarkOnPdf(
  // PDFKit document — typed loosely to avoid hard dependency in shared brand module.
  doc: any,
  x: number,
  y: number,
  height = 22,
) {
  const width = Math.round(height * (BRAND_WORDMARK_VIEWBOX.width / BRAND_WORDMARK_VIEWBOX.height));
  const file = resolveBrandFile(BRAND_ASSET_PATHS.wordmarkOnLight);
  if (file) {
    try {
      doc.image(file, x, y, { height, width });
      return { width, height };
    } catch {
      // fall through to text fallback
    }
  }

  doc.fillColor(BRAND_INK).font("Helvetica-Bold").fontSize(Math.max(11, height * 0.55)).text("AR", x, y, {
    continued: true,
    lineBreak: false,
  });
  doc.fillColor(BRAND_LIME).text("360", { continued: true, lineBreak: false });
  doc.fillColor(BRAND_INK).font("Helvetica").fontSize(Math.max(7, height * 0.28)).text("  STUDIO", {
    lineBreak: false,
  });
  return { width, height };
}
