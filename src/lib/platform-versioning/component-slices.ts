/**
 * Phase 5B — component config slices.
 * Extract / apply only the fields belonging to one component kind.
 * Never copies unrelated component settings into another revision.
 */

import type { Ar360AssetRefsSnapshot, Ar360ProductConfigSnapshot } from "@/lib/platform-versioning/foundation";
import { parseRuntimeJsonArray, parseRuntimeJsonObject } from "@/lib/platform-versioning/runtime-json";

export type ComponentKind = "geometry" | "material" | "lighting" | "viewer" | "ar";

export const COMPONENT_KINDS: ComponentKind[] = [
  "geometry",
  "material",
  "lighting",
  "viewer",
  "ar",
];

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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseSettings(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  const parsed = parseRuntimeJsonObject(value, "settings");
  return parsed.ok ? parsed.value : asRecord(value);
}

function parseMaterialSettings(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  const parsed = parseRuntimeJsonObject(value, "materialSettings");
  return parsed.ok ? parsed.value : asRecord(value);
}

function parseVariants(value: unknown): unknown[] {
  if (value == null) return [];
  const parsed = parseRuntimeJsonArray(value, "variants");
  return parsed.ok ? parsed.value : Array.isArray(value) ? value : [];
}

/** Slice stored inside a component-specific revision's config_json. */
export type ComponentConfigSlice = {
  kind: ComponentKind;
  /** Material / lighting / viewer / ar settings fragment */
  settings?: Record<string, unknown>;
  materialSettings?: Record<string, unknown>;
  variants?: unknown[];
  /** Geometry asset references (referenced, not copied). */
  assetRefs?: Partial<Ar360AssetRefsSnapshot> | null;
};

export function extractComponentSlice(
  kind: ComponentKind,
  config: Ar360ProductConfigSnapshot,
  assetRefs?: Ar360AssetRefsSnapshot | null,
): ComponentConfigSlice {
  const settings = parseSettings(config.settings);

  if (kind === "material") {
    const materialSettings = parseMaterialSettings(config.materialSettings);
    const variants = parseVariants(config.variants).map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const v = entry as Record<string, unknown>;
      const out: Record<string, unknown> = { id: v.id, name: v.name };
      if (v.materialSettings != null) {
        out.materialSettings = parseMaterialSettings(v.materialSettings);
      }
      return out;
    });
    const settingsMaterial = settings.materialSettings
      ? parseMaterialSettings(settings.materialSettings)
      : undefined;
    return {
      kind,
      materialSettings,
      variants,
      settings: settingsMaterial ? { materialSettings: settingsMaterial } : {},
    };
  }

  if (kind === "lighting") {
    const sliceSettings: Record<string, unknown> = {};
    for (const key of [...LIGHTING_KEYS, ...ENVIRONMENT_KEYS]) {
      if (settings[key] !== undefined) sliceSettings[key] = settings[key];
    }
    return { kind, settings: sliceSettings };
  }

  if (kind === "viewer") {
    const sliceSettings: Record<string, unknown> = {};
    for (const key of VIEWER_KEYS) {
      if (settings[key] !== undefined) sliceSettings[key] = settings[key];
    }
    return { kind, settings: sliceSettings };
  }

  if (kind === "ar") {
    const sliceSettings: Record<string, unknown> = {};
    for (const key of AR_KEYS) {
      if (settings[key] !== undefined) sliceSettings[key] = settings[key];
    }
    return { kind, settings: sliceSettings };
  }

  // geometry
  return {
    kind,
    assetRefs: assetRefs
      ? {
          modelUrl: assetRefs.modelUrl ?? null,
          fileName: assetRefs.fileName ?? null,
          productFolder: assetRefs.productFolder ?? null,
          files: assetRefs.files ?? [],
          note: assetRefs.note,
        }
      : null,
  };
}

/**
 * Apply a component slice onto a full config snapshot (immutable — returns new object).
 */
export function applyComponentSlice(
  base: Ar360ProductConfigSnapshot,
  slice: ComponentConfigSlice,
): Ar360ProductConfigSnapshot {
  const settings = { ...parseSettings(base.settings) };

  if (slice.kind === "material") {
    if (slice.settings?.materialSettings != null) {
      settings.materialSettings = slice.settings.materialSettings;
    }
    return {
      ...base,
      settings,
      materialSettings: slice.materialSettings ?? base.materialSettings,
      variants: mergeVariantMaterials(base.variants, slice.variants),
    };
  }

  if (slice.kind === "lighting" || slice.kind === "viewer" || slice.kind === "ar") {
    const patch = slice.settings || {};
    return {
      ...base,
      settings: { ...settings, ...patch },
    };
  }

  // geometry does not alter config_json body beyond identity; asset refs handled separately
  return { ...base, settings };
}

function mergeVariantMaterials(baseVariants: unknown, sliceVariants: unknown[] | undefined): unknown {
  if (!sliceVariants) return baseVariants;
  const base = parseVariants(baseVariants);
  if (base.length === 0) return sliceVariants;

  return base.map((entry, index) => {
    const patch = sliceVariants[index];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return entry;
    const e = entry as Record<string, unknown>;
    const p = patch as Record<string, unknown>;
    return {
      ...e,
      ...(p.materialSettings != null ? { materialSettings: p.materialSettings } : {}),
    };
  });
}

export function applyAssetRefsSlice(
  base: Ar360AssetRefsSnapshot | null,
  slice: ComponentConfigSlice,
): Ar360AssetRefsSnapshot | null {
  if (slice.kind !== "geometry" || !slice.assetRefs) return base;
  return {
    files: slice.assetRefs.files ?? base?.files ?? [],
    ...base,
    ...slice.assetRefs,
  };
}

/** Allowed draft patch fields per component (whitelist). */
export function assertDraftPatchAllowed(
  kind: ComponentKind,
  patch: Record<string, unknown>,
): { ok: true } | { ok: false; message: string } {
  const keys = Object.keys(patch);
  if (keys.length === 0) return { ok: false, message: "Empty patch" };

  if (kind === "material") {
    const allowed = new Set(["materialSettings", "variants", "settings"]);
    for (const key of keys) {
      if (!allowed.has(key)) {
        return { ok: false, message: `material draft cannot set '${key}'` };
      }
    }
    if (patch.settings != null) {
      const s = asRecord(patch.settings);
      for (const key of Object.keys(s)) {
        if (key !== "materialSettings") {
          return { ok: false, message: `material settings may only include materialSettings, not '${key}'` };
        }
      }
    }
    return { ok: true };
  }

  if (kind === "lighting") {
    if (keys.some((k) => k !== "settings")) {
      return { ok: false, message: "lighting draft may only set settings" };
    }
    const s = asRecord(patch.settings);
    const allowed = new Set<string>([...LIGHTING_KEYS, ...ENVIRONMENT_KEYS]);
    for (const key of Object.keys(s)) {
      if (!allowed.has(key)) {
        return { ok: false, message: `lighting settings cannot include '${key}'` };
      }
    }
    return { ok: true };
  }

  if (kind === "viewer") {
    if (keys.some((k) => k !== "settings")) {
      return { ok: false, message: "viewer draft may only set settings" };
    }
    const s = asRecord(patch.settings);
    const allowed = new Set<string>([...VIEWER_KEYS]);
    for (const key of Object.keys(s)) {
      if (!allowed.has(key)) {
        return { ok: false, message: `viewer settings cannot include '${key}'` };
      }
    }
    return { ok: true };
  }

  if (kind === "ar") {
    if (keys.some((k) => k !== "settings")) {
      return { ok: false, message: "ar draft may only set settings" };
    }
    const s = asRecord(patch.settings);
    const allowed = new Set<string>([...AR_KEYS]);
    for (const key of Object.keys(s)) {
      if (!allowed.has(key)) {
        return { ok: false, message: `ar settings cannot include '${key}'` };
      }
    }
    return { ok: true };
  }

  // geometry
  if (keys.some((k) => k !== "assetRefs")) {
    return { ok: false, message: "geometry draft may only set assetRefs references" };
  }
  return { ok: true };
}

export function buildComponentRevisionConfig(
  kind: ComponentKind,
  slice: ComponentConfigSlice,
  identity: Ar360ProductConfigSnapshot["productIdentity"],
  alignedTo: number,
): Ar360ProductConfigSnapshot {
  const components = {
    material: { alignedToRevision: alignedTo },
    lighting: { alignedToRevision: alignedTo },
    viewer: { alignedToRevision: alignedTo },
    ar: { alignedToRevision: alignedTo },
    geometry: { alignedToRevision: alignedTo },
  };

  return {
    schemaVersion: 1,
    source: "manual",
    productIdentity: identity,
    settings: slice.settings ?? {},
    materialSettings: slice.materialSettings ?? {},
    variants: slice.variants ?? [],
    hotspots: [],
    components,
  };
}
