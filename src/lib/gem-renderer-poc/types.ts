/**
 * Isolated Gem Renderer POC types — V4 (performance / quality tradeoff).
 * Not wired into ModelViewer / production materials.
 */

export type GemQualityMode = "low" | "medium" | "high";

/** User-facing quality selector (V4). */
export type QualityTier = "auto" | "low" | "medium" | "high" | "reference";

/** Acceleration mode — AUTO prefers direct for tiny gems. */
export type AccelMode = "auto" | "direct" | "bvh";

/**
 * Dispersion path:
 * - off: no chromatic split (1× trace, base IOR)
 * - single: single-IOR path (same cost as off; labeled for A/B study)
 * - rgb3: 3λ Cauchy dispersion
 */
export type WavelengthMode = "off" | "single" | "rgb3";

/** Development-only visualization modes. */
export type GemDebugMode =
  | "beauty"
  | "normals"
  | "fresnel"
  | "bounces"
  | "tir"
  | "envdir"
  | "energy"
  | "wireframe"
  | "facetNormals"
  | "backface"
  | "triangleId"
  | "insideOutside"
  | "degenerates";

export type DispersionModeLabel =
  | "off"
  | "single-IOR"
  | "rgb-spectral-approx (3 λ, Cauchy IOR · calibrated scale)";

export type GemPocParams = {
  ior: number;
  dispersion: number;
  absorption: [number, number, number];
  thickness: number;
  internalBounces: number;
  environmentIntensity: number;
  environmentRotation: number;
  exposure: number;
  roughness: number;
  /** Legacy spp mapping helper — prefer samplesPerPixel. */
  quality: GemQualityMode;
  /** Explicit spp (1–3). */
  samplesPerPixel: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  debugMode: GemDebugMode;
  enableDispersion: boolean;
  enableAbsorption: boolean;
  enableRefraction: boolean;
  /**
   * @deprecated Derived from accelMode — kept for V2/V3 UI compat.
   * Prefer accelMode.
   */
  enableBvh: boolean;
  accelMode: AccelMode;
  /** AUTO uses BVH only when triangleCount > this (default 128). */
  bvhTriangleThreshold: number;
  /** 0.5 | ~0.66 | 0.75 | 1.0 — gem internal render scale vs canvas. */
  internalResolutionScale: number;
  wavelengthMode: WavelengthMode;
  /** Physically justified throughput cut-off (no arbitrary darkening). */
  earlyTermination: boolean;
  qualityTier: QualityTier;
};

export type GemPocDiagnostics = {
  renderer: string;
  backend: "WebGL2" | "WebGL1" | "unavailable";
  fps: number;
  frameTimeMs: number;
  fpsMin: number;
  fpsAvg: number;
  renderWidth: number;
  renderHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  internalResolutionScale: number;
  samplesPerPixel: number;
  wavelengths: number;
  internalBounces: number;
  dispersionMode: DispersionModeLabel;
  triangleCount: number;
  techniqueLabel: string;
  approximations: string[];
  characteristicLength: number;
  debugMode: GemDebugMode;
  bvhEnabled: boolean;
  accelMode: AccelMode;
  accelEffective: "direct" | "bvh";
  triangleTestsPerRay: number;
  bvhNodeCount: number;
  qualityTier: QualityTier;
  /** WEBGL_debug_renderer_info when available */
  gpuRenderer: string;
  gpuVendor: string;
  suitabilityStatus: "SUPPORTED" | "SUPPORTED_WITH_WARNING" | "UNSUPPORTED" | "n/a";
  suitabilitySummary: string;
  fallbackActive: boolean;
  fallbackReason: string | null;
};

/** Default BVH auto threshold — below this, direct is typically faster. */
export const DEFAULT_BVH_TRIANGLE_THRESHOLD = 128;

/**
 * REFERENCE DIAMOND optics (locked physical params).
 * V4 may vary spp/bounces/ires for perf studies — optics stay locked unless unlocked.
 */
export const REFERENCE_DIAMOND_PARAMS: GemPocParams = {
  ior: 2.417,
  dispersion: 0.25,
  absorption: [0.002, 0.002, 0.002],
  thickness: 1,
  internalBounces: 12,
  environmentIntensity: 1,
  environmentRotation: 0,
  exposure: 1,
  roughness: 0.01,
  quality: "medium",
  samplesPerPixel: 2,
  autoRotate: false,
  autoRotateSpeed: 0.25,
  debugMode: "beauty",
  enableDispersion: true,
  enableAbsorption: true,
  enableRefraction: true,
  enableBvh: false,
  accelMode: "auto",
  bvhTriangleThreshold: DEFAULT_BVH_TRIANGLE_THRESHOLD,
  internalResolutionScale: 1,
  wavelengthMode: "rgb3",
  earlyTermination: true,
  qualityTier: "reference",
};

export const DEFAULT_GEM_POC_PARAMS: GemPocParams = {
  ...REFERENCE_DIAMOND_PARAMS,
  qualityTier: "medium",
  samplesPerPixel: 1,
  internalBounces: 6,
  internalResolutionScale: 0.75,
};

export function qualityToSamples(quality: GemQualityMode): number {
  if (quality === "high") return 3;
  if (quality === "low") return 1;
  return 2;
}

export function samplesForParams(params: GemPocParams): number {
  const n = Number.isFinite(params.samplesPerPixel)
    ? params.samplesPerPixel
    : qualityToSamples(params.quality);
  return Math.max(1, Math.min(3, Math.round(n)));
}

export function qualityToMaxBounces(
  _quality: GemQualityMode,
  requested: number,
): number {
  return Math.max(1, Math.min(16, Math.round(requested)));
}

export function wavelengthsForParams(params: GemPocParams): number {
  if (params.wavelengthMode === "rgb3") return 3;
  if (params.wavelengthMode === "single" || params.wavelengthMode === "off") {
    return 1;
  }
  // Legacy fallback
  return params.enableDispersion && params.dispersion > 1e-4 ? 3 : 1;
}

export function dispersionModeLabel(params: GemPocParams): DispersionModeLabel {
  if (params.wavelengthMode === "rgb3") {
    return "rgb-spectral-approx (3 λ, Cauchy IOR · calibrated scale)";
  }
  if (params.wavelengthMode === "single") return "single-IOR";
  if (params.wavelengthMode === "off") return "off";
  if (!params.enableDispersion || params.dispersion <= 0.001) return "off";
  return "rgb-spectral-approx (3 λ, Cauchy IOR · calibrated scale)";
}

/** Resolve effective accel given mode + triangle count + BVH availability. */
export function resolveAccelEffective(
  accelMode: AccelMode,
  triangleCount: number,
  threshold: number,
  hasBvh: boolean,
): "direct" | "bvh" {
  if (accelMode === "direct") return "direct";
  if (accelMode === "bvh") return hasBvh ? "bvh" : "direct";
  // AUTO
  if (!hasBvh) return "direct";
  return triangleCount > threshold ? "bvh" : "direct";
}

/**
 * AUTO quality heuristic — no device-model blacklist.
 * Uses coarse capability proxies: pixel budget + cores + memory (when available).
 */
export function pickAutoQualityTier(input: {
  canvasPixels: number;
  triangleCount: number;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
}): Exclude<QualityTier, "auto"> {
  const cores = input.hardwareConcurrency ?? 4;
  const mem = input.deviceMemoryGb ?? 4;
  const pixels = input.canvasPixels;
  const tris = input.triangleCount;

  // Weak / mobile-ish: low pixel budget or few cores / little RAM
  if (pixels > 1_200_000 || cores <= 4 || mem <= 4) {
    if (tris > 512) return "low";
    return pixels > 900_000 ? "low" : "medium";
  }
  // Strong desktop
  if (pixels < 700_000 && cores >= 8 && mem >= 8) return "high";
  return "medium";
}
