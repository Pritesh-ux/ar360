/**
 * Phase 3 — normalize product config snapshots for shadow comparison.
 * Pure helpers (no DB). Does not mutate inputs.
 */

export type ConfigDiffCategory =
  | "geometry"
  | "material"
  | "lighting"
  | "viewer"
  | "ar"
  | "environment"
  | "other";

export type ConfigFieldDifference = {
  category: ConfigDiffCategory;
  field: string;
  legacy: unknown;
  versioned: unknown;
};

export type ConfigComparisonResult = {
  match: boolean;
  differences: ConfigFieldDifference[];
};

const LIGHTING_KEYS = [
  "exposure",
  "shadowIntensity",
  "shadowSoftness",
  "environmentTint",
  "environmentSaturation",
  "environmentRotation",
] as const;

const ENVIRONMENT_KEYS = ["environmentImage", "useSkybox", "skyboxImage"] as const;

const VIEWER_KEYS = [
  "cameraOrbit",
  "cameraTarget",
  "fov",
  "initialZoom",
  "autoRotate",
  "backgroundColor",
  "backgroundType",
  "transparent",
] as const;

const AR_KEYS = [
  "showArButton",
  "realScale",
  "arPlacement",
  "arModelUnit",
  "arModelScale",
  "arModelUrl",
  "usdzUrl",
] as const;

export type NormalizedRenderConfig = {
  materialSettings: unknown;
  variants: unknown;
  hotspots: unknown;
  lighting: Record<string, unknown>;
  environment: Record<string, unknown>;
  viewer: Record<string, unknown>;
  ar: Record<string, unknown>;
  geometry: {
    modelUrl: string | null;
    fileName: string | null;
  };
  otherSettings: Record<string, unknown>;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** Stable JSON for deep equality (sorts object keys). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object") {
    if (typeof value === "number" && Number.isFinite(value)) {
      // Avoid 1 vs 1.0 noise
      return value;
    }
    return value;
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = sortValue(v);
  }
  return out;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function asRecord(value: unknown): Record<string, unknown> {
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const KNOWN_SETTING_KEYS = new Set<string>([
  ...LIGHTING_KEYS,
  ...ENVIRONMENT_KEYS,
  ...VIEWER_KEYS,
  ...AR_KEYS,
  "materialSettings",
  "ctaEnabled",
  "ctaType",
  "ctaLabel",
  "ctaUrl",
]);

/**
 * Normalize a Phase-1-style snapshot OR a raw MySQL-shaped config into
 * comparable render-relevant buckets.
 */
export function normalizeRenderConfig(input: {
  settings?: unknown;
  materialSettings?: unknown;
  variants?: unknown;
  hotspots?: unknown;
  modelUrl?: string | null;
  fileName?: string | null;
  /** Optional top-level AR/env fields (disk-only); ignored when absent. */
  extras?: Record<string, unknown> | null;
}): NormalizedRenderConfig {
  const settings = asRecord(input.settings);
  const extras = input.extras || {};
  const merged: Record<string, unknown> = { ...settings, ...extras };

  const materialFromSettings = merged.materialSettings;
  const materialSettings =
    input.materialSettings != null &&
    !(
      typeof input.materialSettings === "object" &&
      !Array.isArray(input.materialSettings) &&
      Object.keys(input.materialSettings as object).length === 0
    )
      ? parseMaybeJson(input.materialSettings)
      : materialFromSettings != null
        ? parseMaybeJson(materialFromSettings)
        : {};

  const otherSettings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (KNOWN_SETTING_KEYS.has(key)) continue;
    otherSettings[key] = value;
  }

  return {
    materialSettings,
    variants: parseMaybeJson(input.variants) ?? [],
    hotspots: parseMaybeJson(input.hotspots) ?? [],
    lighting: pickKeys(merged, LIGHTING_KEYS),
    environment: pickKeys(merged, ENVIRONMENT_KEYS),
    viewer: pickKeys(merged, VIEWER_KEYS),
    ar: pickKeys(merged, AR_KEYS),
    geometry: {
      modelUrl: input.modelUrl ? String(input.modelUrl) : null,
      fileName: input.fileName ? String(input.fileName) : null,
    },
    otherSettings,
  };
}

function pushDiff(
  diffs: ConfigFieldDifference[],
  category: ConfigDiffCategory,
  field: string,
  legacy: unknown,
  versioned: unknown,
) {
  if (valuesEqual(legacy, versioned)) return;
  diffs.push({ category, field, legacy, versioned });
}

function compareRecordFields(
  diffs: ConfigFieldDifference[],
  category: ConfigDiffCategory,
  legacy: Record<string, unknown>,
  versioned: Record<string, unknown>,
) {
  const keys = new Set([...Object.keys(legacy), ...Object.keys(versioned)]);
  for (const key of [...keys].sort()) {
    pushDiff(diffs, category, key, legacy[key] ?? null, versioned[key] ?? null);
  }
}

/** Shadow compare two normalized configs. Never mutates inputs. */
export function compareNormalizedConfigs(
  legacy: NormalizedRenderConfig,
  versioned: NormalizedRenderConfig,
): ConfigComparisonResult {
  const differences: ConfigFieldDifference[] = [];

  pushDiff(
    differences,
    "geometry",
    "modelUrl",
    legacy.geometry.modelUrl,
    versioned.geometry.modelUrl,
  );
  pushDiff(
    differences,
    "geometry",
    "fileName",
    legacy.geometry.fileName,
    versioned.geometry.fileName,
  );
  pushDiff(differences, "material", "materialSettings", legacy.materialSettings, versioned.materialSettings);
  pushDiff(differences, "material", "variants", legacy.variants, versioned.variants);
  pushDiff(differences, "viewer", "hotspots", legacy.hotspots, versioned.hotspots);

  compareRecordFields(differences, "lighting", legacy.lighting, versioned.lighting);
  compareRecordFields(differences, "environment", legacy.environment, versioned.environment);
  compareRecordFields(differences, "viewer", legacy.viewer, versioned.viewer);
  compareRecordFields(differences, "ar", legacy.ar, versioned.ar);
  compareRecordFields(differences, "other", legacy.otherSettings, versioned.otherSettings);

  return {
    match: differences.length === 0,
    differences,
  };
}

export function summarizeDifferencesByCategory(differences: ConfigFieldDifference[]) {
  const counts: Record<ConfigDiffCategory, number> = {
    geometry: 0,
    material: 0,
    lighting: 0,
    viewer: 0,
    ar: 0,
    environment: 0,
    other: 0,
  };
  for (const d of differences) counts[d.category] += 1;
  return counts;
}
