/**
 * Bump feel helpers.
 *
 * Softness / scale stay at authored canvas values on every device. High-DPR
 * phones still get a tiny scale trim so close-up retina views don't read
 * sharper than the desktop editor canvas — without changing the bump pattern.
 */
export function isMobileViewerViewport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function devicePixelRatioSafe(): number {
  if (typeof window === "undefined") return 1;
  const dpr = Number(window.devicePixelRatio);
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/** True when the display tends to exaggerate bump detail vs desktop canvas. */
export function needsBumpDisplayMatch(): boolean {
  if (typeof window === "undefined") return false;
  return isMobileViewerViewport() || devicePixelRatioSafe() >= 2;
}

export function resolveViewerBumpSoftness(softness?: number | null): number {
  // Always honor the canvas slider exactly — soften-texture handles perception.
  return Math.max(0, Math.min(1, Number(softness) || 0));
}

export function resolveViewerBumpScale(scale?: number | null): number {
  const base =
    scale != null && Number.isFinite(Number(scale)) ? Math.max(0, Number(scale)) : 1;
  if (!needsBumpDisplayMatch()) return base;
  // Mild only — keep the same ridge pattern, just less "etched" on retina close-ups.
  const dpr = devicePixelRatioSafe();
  const trim = dpr >= 3 ? 0.82 : dpr >= 2 ? 0.88 : 0.92;
  return Math.max(0, base * trim);
}
