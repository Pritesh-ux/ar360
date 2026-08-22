import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRuntimeJsonArray,
  parseRuntimeJsonObject,
} from "@/lib/platform-versioning/runtime-json";
import {
  deserializeVersionedConfigForRuntime,
  overlayFromConfig,
} from "@/lib/platform-versioning/apply-versioned-runtime";
import type { Ar360ProductConfigSnapshot } from "@/lib/platform-versioning/foundation";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
} from "@/lib/platform-versioning/config-compare";

function baseConfig(
  overrides: Partial<Ar360ProductConfigSnapshot> = {},
): Ar360ProductConfigSnapshot {
  return {
    schemaVersion: 1,
    source: "legacy_backfill",
    productIdentity: {
      id: "PRD_TEST",
      publicId: null,
      viewerSlug: null,
      status: "published",
      title: "Test",
      editVersion: 1,
    },
    settings: { exposure: 1.4, environmentImage: "/hdr/night.hdr" },
    materialSettings: { "0": { metalness: 0, roughness: 1, baseColor: "#ffffff" } },
    variants: [{ id: "default", name: "Default" }],
    hotspots: [],
    components: {
      material: { alignedToRevision: 1 },
      lighting: { alignedToRevision: 1 },
      viewer: { alignedToRevision: 1 },
      ar: { alignedToRevision: 1 },
      geometry: { alignedToRevision: 1 },
    },
    ...overrides,
  };
}

describe("AR360 Phase 5A runtime-json parsers", () => {
  it("parseRuntimeJsonObject keeps object", () => {
    const result = parseRuntimeJsonObject({ a: 1 }, "materialSettings");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value, { a: 1 });
  });

  it("parseRuntimeJsonObject parses JSON object string", () => {
    const result = parseRuntimeJsonObject('{"0":{"metalness":1}}', "materialSettings");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value, { "0": { metalness: 1 } });
  });

  it("parseRuntimeJsonObject rejects invalid JSON", () => {
    const result = parseRuntimeJsonObject("{not-json", "materialSettings");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /materialSettings/);
  });

  it("parseRuntimeJsonObject rejects JSON array string", () => {
    const result = parseRuntimeJsonObject("[1,2]", "materialSettings");
    assert.equal(result.ok, false);
  });

  it("parseRuntimeJsonArray keeps array", () => {
    const result = parseRuntimeJsonArray([{ id: "v1" }], "variants");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.length, 1);
  });

  it("parseRuntimeJsonArray parses JSON array string", () => {
    const result = parseRuntimeJsonArray('[{"id":"default"}]', "variants");
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.value, [{ id: "default" }]);
  });

  it("parseRuntimeJsonArray rejects invalid JSON", () => {
    const result = parseRuntimeJsonArray("[broken", "variants");
    assert.equal(result.ok, false);
  });

  it("parseRuntimeJsonArray rejects JSON object string", () => {
    const result = parseRuntimeJsonArray('{"id":"x"}', "variants");
    assert.equal(result.ok, false);
  });

  it("does not silently convert invalid JSON to empty object/array", () => {
    const obj = parseRuntimeJsonObject("{", "materialSettings");
    const arr = parseRuntimeJsonArray("[", "variants");
    assert.equal(obj.ok, false);
    assert.equal(arr.ok, false);
  });
});

describe("AR360 Phase 5A versioned overlay type contract", () => {
  const legacyProduct: Record<string, unknown> = {
    id: "PRD_TEST",
    productUid: "PRD_TEST",
    settings: { exposure: 1.2 },
    materialSettings: { "0": { metalness: 0, roughness: 0.5 } },
    variants: [{ id: "legacy" }],
    hotspots: [],
    modelUrl: "/model.glb",
  };

  it("materialSettings already object remains object", () => {
    const result = overlayFromConfig(legacyProduct, baseConfig(), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(typeof result.product.materialSettings, "object");
    assert.equal(Array.isArray(result.product.materialSettings), false);
  });

  it("materialSettings JSON string becomes object", () => {
    const result = overlayFromConfig(
      legacyProduct,
      baseConfig({
        materialSettings: JSON.stringify({ "0": { metalness: 1, roughness: 0.1 } }),
      }),
      null,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(typeof result.product.materialSettings, "object");
    assert.equal(Array.isArray(result.product.materialSettings), false);
    const mats = result.product.materialSettings as Record<string, { metalness: number }>;
    assert.equal(mats["0"].metalness, 1);
  });

  it("variants already array remains array", () => {
    const result = overlayFromConfig(legacyProduct, baseConfig(), null);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(Array.isArray(result.product.variants), true);
  });

  it("variants JSON string becomes array", () => {
    const result = overlayFromConfig(
      legacyProduct,
      baseConfig({
        variants: JSON.stringify([{ id: "default", name: "Default" }]),
      }),
      null,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(Array.isArray(result.product.variants), true);
    const variants = result.product.variants as Array<{ id: string }>;
    assert.equal(variants[0].id, "default");
  });

  it("invalid materialSettings JSON → VERSIONED_CONFIG_ERROR", () => {
    const result = overlayFromConfig(
      legacyProduct,
      baseConfig({ materialSettings: "{bad" }),
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "VERSIONED_CONFIG_ERROR");
      assert.match(result.message, /materialSettings/);
    }
  });

  it("invalid variants JSON → VERSIONED_CONFIG_ERROR", () => {
    const result = overlayFromConfig(
      legacyProduct,
      baseConfig({ variants: "[bad" }),
      null,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "VERSIONED_CONFIG_ERROR");
      assert.match(result.message, /variants/);
    }
  });

  it("legacy product identity path unchanged when overlay fails", () => {
    const result = overlayFromConfig(
      legacyProduct,
      baseConfig({ materialSettings: "{bad" }),
      null,
    );
    assert.equal(result.ok, false);
    // Caller must keep original product — overlay did not mutate input
    assert.deepEqual(legacyProduct.materialSettings, { "0": { metalness: 0, roughness: 0.5 } });
    assert.equal(Array.isArray(legacyProduct.variants), true);
  });

  it("stringified revision settings deserialize without inventing defaults", () => {
    const result = deserializeVersionedConfigForRuntime(
      baseConfig({
        settings: JSON.stringify({ exposure: 1.4, environmentImage: "/hdr/night.hdr" }),
        materialSettings: JSON.stringify({ "0": { metalness: 0, roughness: 1 } }),
        variants: JSON.stringify([{ id: "default" }]),
        hotspots: "[]",
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.contract.settings.exposure, 1.4);
    assert.equal(typeof result.contract.materialSettings, "object");
    assert.equal(Array.isArray(result.contract.variants), true);
  });

  it("versioned overlay types match legacy runtime types for CHROMA-like stringified revision", () => {
    const mats = {
      "0": {
        baseColor: "#ffffff",
        metalness: 0,
        roughness: 1,
        transmission: 0,
        ior: 1.5,
        clearcoat: 1,
      },
    };
    const variants = [
      {
        id: "default",
        name: "Default",
        materialSettings: mats,
        exposure: 1.4,
        environmentImage: "/hdr/night.hdr",
      },
    ];
    const settings = {
      exposure: 1.4,
      environmentImage: "/hdr/night.hdr",
      useSkybox: false,
      shadowIntensity: 1.25,
    };

    const legacyLike: Record<string, unknown> = {
      id: "PRD_3XTVLF8X",
      settings,
      materialSettings: mats,
      variants,
      hotspots: [],
      exposure: 1.4,
      environmentImage: "/hdr/night.hdr",
    };

    const versioned = overlayFromConfig(
      legacyLike,
      baseConfig({
        settings: JSON.stringify(settings),
        materialSettings: JSON.stringify(mats),
        variants: JSON.stringify(variants),
        hotspots: "[]",
      }),
      { modelUrl: "/Storage/x/model.glb", fileName: "CHROMA.glb" },
    );
    assert.equal(versioned.ok, true);
    if (!versioned.ok) return;

    assert.equal(typeof versioned.product.materialSettings, "object");
    assert.equal(Array.isArray(versioned.product.variants), true);
    assert.equal(typeof versioned.product.settings, "object");
    assert.equal(versioned.product.exposure, 1.4);
    assert.equal(versioned.product.environmentImage, "/hdr/night.hdr");

    const legacyNorm = normalizeRenderConfig({
      config: {
        schemaVersion: 1,
        source: "legacy_backfill",
        productIdentity: baseConfig().productIdentity,
        settings,
        materialSettings: mats,
        variants,
        hotspots: [],
        components: baseConfig().components,
      },
      assetRefs: { files: [], modelUrl: "/Storage/x/model.glb", fileName: "CHROMA.glb" },
    });
    const versionedNorm = normalizeRenderConfig({
      config: {
        schemaVersion: 1,
        source: "legacy_backfill",
        productIdentity: baseConfig().productIdentity,
        settings: versioned.product.settings,
        materialSettings: versioned.product.materialSettings,
        variants: versioned.product.variants,
        hotspots: versioned.product.hotspots ?? [],
        components: baseConfig().components,
      },
      assetRefs: {
        files: [],
        modelUrl: versioned.product.modelUrl as string,
        fileName: versioned.product.fileName as string,
      },
    });
    const comparison = compareNormalizedConfigs(legacyNorm, versionedNorm);
    assert.equal(comparison.match, true);
    assert.equal(comparison.differences.length, 0);
  });

  it("valid stringified revision does not invent empty materialSettings", () => {
    const result = deserializeVersionedConfigForRuntime(
      baseConfig({ materialSettings: '{"0":{"roughness":0.2}}' }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const mats = result.contract.materialSettings as Record<string, { roughness: number }>;
    assert.equal(mats["0"].roughness, 0.2);
  });
});
