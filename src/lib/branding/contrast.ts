import type { CSSProperties } from "react";

const DEFAULT_PRIMARY = "#B8FF3C";
const DARK_INK = "#102000";
const LIGHT_INK = "#FFFFFF";

export function parseHexRgb(input: string | null | undefined): { r: number; g: number; b: number } | null {
  const raw = String(input || "").trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function srgbToLin(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance 0–1. */
export function hexLuminance(hex: string | null | undefined): number | null {
  const rgb = parseHexRgb(hex);
  if (!rgb) return null;
  return 0.2126 * srgbToLin(rgb.r) + 0.7152 * srgbToLin(rgb.g) + 0.0722 * srgbToLin(rgb.b);
}

export function normalizeHex(hex: string | null | undefined, fallback = DEFAULT_PRIMARY): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return fallback;
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/** Text that stays readable on a filled brand-color button. */
export function onBrandForeground(hex: string | null | undefined): typeof DARK_INK | typeof LIGHT_INK {
  const luminance = hexLuminance(hex);
  if (luminance == null) return DARK_INK;
  return luminance < 0.45 ? LIGHT_INK : DARK_INK;
}

export function mixHex(hex: string, other: string, amount: number): string {
  const a = parseHexRgb(hex);
  const b = parseHexRgb(other);
  if (!a || !b) return normalizeHex(hex);
  const t = Math.min(1, Math.max(0, amount));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return normalizeHex(`#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`);
}

/** CSS variables for public viewer / embed branded chrome. */
export function viewerBrandStyle(
  primary?: string | null,
  accent?: string | null,
): CSSProperties {
  const p = normalizeHex(primary, DEFAULT_PRIMARY);
  const luminance = hexLuminance(p) ?? 0.8;
  const hover = parseHexRgb(accent)
    ? normalizeHex(accent)
    : mixHex(p, luminance < 0.45 ? "#FFFFFF" : "#000000", 0.14);
  const onPrimary = onBrandForeground(p);
  const outlineFg = luminance < 0.45 ? p : DARK_INK;
  return {
    "--ar-primary": p,
    "--ar-primary-hover": hover,
    "--ar-primary-soft": `color-mix(in srgb, ${p} 16%, white)`,
    "--ar-on-primary": onPrimary,
    "--ar-on-soft": DARK_INK,
    "--ar-outline-fg": outlineFg,
    "--ar-text": onPrimary,
  } as CSSProperties;
}
