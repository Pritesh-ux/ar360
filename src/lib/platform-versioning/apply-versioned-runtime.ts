/**
 * Phase 4 — apply versioned config overlay for canary products only.
 * On any failure: return original legacy product + fallbackTriggered.
 * Never mutates DB / QR / subscriptions / product.json.
 *
 * Phase 5A repair: deserialize revision JSON strings to the LEGACY viewer
 * contract (materialSettings object, variants array, etc.) before overlay.
 */

import {
  validateVersionedRuntimeReady,
  type CompatibilityFailureCode,
} from "@/lib/platform-versioning/component-resolver";
import {
  resolveRuntimeModeForProduct,
  type RuntimeMode,
  type RuntimeSelection,
} from "@/lib/platform-versioning/runtime-selection";
import type { Ar360ProductConfigSnapshot } from "@/lib/platform-versioning/foundation";
import {
  parseRuntimeJsonArray,
  parseRuntimeJsonObject,
} from "@/lib/platform-versioning/runtime-json";

export type Ar360RuntimeDiagnostics = {
  mode: RuntimeMode;
  selectionReason: RuntimeSelection["reason"];
  fallbackTriggered: boolean;
  fallbackCode: CompatibilityFailureCode | null;
  fallbackMessage: string | null;
  revisionId: number | null;
  revisionNumber: number | null;
  components: {
    geometry: number | null;
    material: number | null;
    lighting: number | null;
    viewer: number | null;
    ar: number | null;
  } | null;
};

/** Runtime-shaped config after safe deserialization (matches LEGACY public contract). */
export type VersionedRuntimeConfigContract = {
  settings: Record<string, unknown>;
  materialSettings: Record<string, unknown>;
  variants: unknown[];
  hotspots: unknown[];
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Deserialize revision snapshot fields into the LEGACY viewer data contract.
 * Returns VERSIONED_CONFIG_ERROR details when structured fields are corrupt.
 */
export function deserializeVersionedConfigForRuntime(
  config: Ar360ProductConfigSnapshot,
):
  | { ok: true; contract: VersionedRuntimeConfigContract }
  | { ok: false; code: "VERSIONED_CONFIG_ERROR"; message: string } {
  // settings: required structured object when present; null/undefined → empty merge base
  let settings: Record<string, unknown> = {};
  if (config.settings != null) {
    const parsed = parseRuntimeJsonObject(config.settings, "settings");
    if (parsed.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: parsed.message };
    }
    settings = parsed.value;
  }

  // materialSettings: required object when present
  let materialSettings: Record<string, unknown> = {};
  if (config.materialSettings != null) {
    const parsed = parseRuntimeJsonObject(config.materialSettings, "materialSettings");
    if (parsed.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: parsed.message };
    }
    materialSettings = parsed.value;
  }

  // variants: required array when present
  let variants: unknown[] = [];
  if (config.variants != null) {
    const parsed = parseRuntimeJsonArray(config.variants, "variants");
    if (parsed.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: parsed.message };
    }
    variants = parsed.value;
  }

  // hotspots: required array when present
  let hotspots: unknown[] = [];
  if (config.hotspots != null) {
    const parsed = parseRuntimeJsonArray(config.hotspots, "hotspots");
    if (parsed.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: parsed.message };
    }
    hotspots = parsed.value;
  }

  // Nested materialSettings inside settings (legacy dual-write shape)
  if (settings.materialSettings != null) {
    const nested = parseRuntimeJsonObject(settings.materialSettings, "settings.materialSettings");
    if (nested.ok === false) {
      return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: nested.message };
    }
    settings = { ...settings, materialSettings: nested.value };
  }

  // Variant entries may carry materialSettings as JSON strings from revision storage
  const normalizedVariants: unknown[] = [];
  for (let i = 0; i < variants.length; i += 1) {
    const entry = variants[i];
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      normalizedVariants.push(entry);
      continue;
    }
    const variant = { ...(entry as Record<string, unknown>) };
    if (variant.materialSettings != null) {
      const vm = parseRuntimeJsonObject(
        variant.materialSettings,
        `variants[${i}].materialSettings`,
      );
      if (vm.ok === false) {
        return { ok: false, code: "VERSIONED_CONFIG_ERROR", message: vm.message };
      }
      variant.materialSettings = vm.value;
    }
    normalizedVariants.push(variant);
  }

  return {
    ok: true,
    contract: {
      settings,
      materialSettings,
      variants: normalizedVariants,
      hotspots,
    },
  };
}

export function assertVersionedRuntimeContract(contract: VersionedRuntimeConfigContract): void {
  if (
    contract.materialSettings == null ||
    typeof contract.materialSettings !== "object" ||
    Array.isArray(contract.materialSettings)
  ) {
    throw new Error("materialSettings must be object");
  }
  if (!Array.isArray(contract.variants)) {
    throw new Error("variants must be array");
  }
  if (!Array.isArray(contract.hotspots)) {
    throw new Error("hotspots must be array");
  }
  if (
    contract.settings == null ||
    typeof contract.settings !== "object" ||
    Array.isArray(contract.settings)
  ) {
    throw new Error("settings must be object");
  }
}

/**
 * Pure overlay: deserialize revision config then apply LEGACY-shaped fields onto product.
 * Does not touch DB. Failures return VERSIONED_CONFIG_ERROR (caller falls back to LEGACY).
 */
export function overlayFromConfig(
  product: Record<string, unknown>,
  config: Ar360ProductConfigSnapshot,
  assetRefs: { modelUrl?: string | null; fileName?: string | null } | null,
):
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; code: "VERSIONED_CONFIG_ERROR"; message: string } {
  const deserialized = deserializeVersionedConfigForRuntime(config);
  if (deserialized.ok === false) {
    return {
      ok: false,
      code: "VERSIONED_CONFIG_ERROR",
      message: deserialized.message,
    };
  }

  const { contract } = deserialized;
  assertVersionedRuntimeContract(contract);

  const next: Record<string, unknown> = { ...product };

  if (config.materialSettings != null) {
    next.materialSettings = contract.materialSettings;
  }
  if (config.variants != null) {
    next.variants = contract.variants;
  }
  if (config.hotspots != null) {
    next.hotspots = contract.hotspots;
  }

  const prevSettings = asRecord(product.settings);
  const mergedSettings = { ...prevSettings, ...contract.settings };
  next.settings = mergedSettings;

  for (const key of [...LIGHTING_KEYS, ...ENVIRONMENT_KEYS, ...VIEWER_KEYS, ...AR_KEYS]) {
    if (mergedSettings[key] !== undefined) {
      next[key] = mergedSettings[key];
    }
  }

  if (assetRefs?.modelUrl) next.modelUrl = assetRefs.modelUrl;
  if (assetRefs?.fileName) next.fileName = assetRefs.fileName;

  // Final public-contract assertions (viewer expectations)
  if (next.materialSettings != null) {
    if (typeof next.materialSettings !== "object" || Array.isArray(next.materialSettings)) {
      return {
        ok: false,
        code: "VERSIONED_CONFIG_ERROR",
        message: "materialSettings must be object after overlay",
      };
    }
  }
  if (next.variants != null && !Array.isArray(next.variants)) {
    return {
      ok: false,
      code: "VERSIONED_CONFIG_ERROR",
      message: "variants must be array after overlay",
    };
  }

  return { ok: true, product: next };
}

function logRuntimeEvent(payload: Record<string, unknown>) {
  try {
    console.info("[ar360-runtime]", JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/**
 * Apply controlled runtime selection to a public product payload.
 * Default path is identity (LEGACY) — no visual change for non-canary products.
 */
export async function applyControlledRuntimeToProduct(
  product: Record<string, unknown>,
): Promise<{ product: Record<string, unknown>; diagnostics: Ar360RuntimeDiagnostics }> {
  const productId = String(product.productUid || product.id || "").trim();
  const selection = productId
    ? await resolveRuntimeModeForProduct(productId)
    : {
        mode: "legacy" as const,
        reason: "default_legacy" as const,
        flagEnabled: false,
        targeting: { scope: "selected_products" as const, productIds: [] },
      };

  const baseDiagnostics: Ar360RuntimeDiagnostics = {
    mode: "legacy",
    selectionReason: selection.reason,
    fallbackTriggered: false,
    fallbackCode: null,
    fallbackMessage: null,
    revisionId: null,
    revisionNumber: null,
    components: null,
  };

  if (!productId || selection.mode !== "versioned") {
    return { product, diagnostics: baseDiagnostics };
  }

  try {
    const ready = await validateVersionedRuntimeReady(productId);
    if (!ready.ok || !ready.components?.config) {
      const diagnostics: Ar360RuntimeDiagnostics = {
        ...baseDiagnostics,
        mode: "legacy",
        fallbackTriggered: true,
        fallbackCode: ready.code,
        fallbackMessage: ready.message,
        components: ready.components
          ? {
              geometry: ready.components.geometry.revisionId,
              material: ready.components.material.revisionId,
              lighting: ready.components.lighting.revisionId,
              viewer: ready.components.viewer.revisionId,
              ar: ready.components.ar.revisionId,
            }
          : null,
      };
      logRuntimeEvent({
        productId,
        mode: "legacy",
        fallbackTriggered: true,
        code: ready.code,
      });
      return { product, diagnostics };
    }

    const overlaid = overlayFromConfig(
      product,
      ready.components.config,
      ready.components.assetRefs,
    );

    if (overlaid.ok === false) {
      const diagnostics: Ar360RuntimeDiagnostics = {
        ...baseDiagnostics,
        mode: "legacy",
        fallbackTriggered: true,
        fallbackCode: overlaid.code,
        fallbackMessage: overlaid.message,
        components: {
          geometry: ready.components.geometry.revisionId,
          material: ready.components.material.revisionId,
          lighting: ready.components.lighting.revisionId,
          viewer: ready.components.viewer.revisionId,
          ar: ready.components.ar.revisionId,
        },
      };
      logRuntimeEvent({
        productId,
        mode: "legacy",
        fallbackTriggered: true,
        code: overlaid.code,
      });
      return { product, diagnostics };
    }

    const diagnostics: Ar360RuntimeDiagnostics = {
      mode: "versioned",
      selectionReason: selection.reason,
      fallbackTriggered: false,
      fallbackCode: null,
      fallbackMessage: null,
      revisionId: ready.components.material.revisionId,
      revisionNumber: ready.components.material.revisionNumber,
      components: {
        geometry: ready.components.geometry.revisionId,
        material: ready.components.material.revisionId,
        lighting: ready.components.lighting.revisionId,
        viewer: ready.components.viewer.revisionId,
        ar: ready.components.ar.revisionId,
      },
    };

    logRuntimeEvent({
      productId,
      mode: "versioned",
      fallbackTriggered: false,
      revisionNumber: diagnostics.revisionNumber,
    });

    return {
      product: {
        ...overlaid.product,
        ar360Runtime: diagnostics,
      },
      diagnostics,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics: Ar360RuntimeDiagnostics = {
      ...baseDiagnostics,
      mode: "legacy",
      fallbackTriggered: true,
      fallbackCode: "VERSIONED_VIEWER_ERROR",
      fallbackMessage: message,
    };
    logRuntimeEvent({
      productId,
      mode: "legacy",
      fallbackTriggered: true,
      code: "VERSIONED_VIEWER_ERROR",
    });
    return { product, diagnostics };
  }
}
