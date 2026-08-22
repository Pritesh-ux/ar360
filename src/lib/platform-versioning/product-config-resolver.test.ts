import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
  valuesEqual,
} from "@/lib/platform-versioning/config-compare";
import { buildLegacyConfigSnapshot, buildLegacyAssetRefs } from "@/lib/platform-versioning/foundation";
import { compareProductConfigs } from "@/lib/platform-versioning/product-config-resolver";

describe("AR360 Phase 3 config compare", () => {
  it("MATCH when configs are equivalent", () => {
    const a = normalizeRenderConfig({
      settings: { exposure: 0.9, environmentImage: "neutral" },
      materialSettings: { "0": { roughness: 0.18, metalness: 1 } },
      variants: [],
      hotspots: [],
      modelUrl: "/Storage/x/model.glb",
      fileName: "model.glb",
    });
    const b = normalizeRenderConfig({
      settings: { environmentImage: "neutral", exposure: 0.9 },
      materialSettings: { "0": { metalness: 1, roughness: 0.18 } },
      variants: [],
      hotspots: [],
      modelUrl: "/Storage/x/model.glb",
      fileName: "model.glb",
    });
    const result = compareNormalizedConfigs(a, b);
    assert.equal(result.match, true);
    assert.equal(result.differences.length, 0);
  });

  it("MISMATCH reports structured categories", () => {
    const legacy = normalizeRenderConfig({
      settings: { exposure: 0.9 },
      materialSettings: { "0": { roughness: 0.18 } },
      variants: [],
      hotspots: [],
      modelUrl: "/a.glb",
    });
    const versioned = normalizeRenderConfig({
      settings: { exposure: 1.1 },
      materialSettings: { "0": { roughness: 0.4 } },
      variants: [],
      hotspots: [],
      modelUrl: "/b.glb",
    });
    const result = compareNormalizedConfigs(legacy, versioned);
    assert.equal(result.match, false);
    assert.ok(result.differences.some((d) => d.category === "geometry" && d.field === "modelUrl"));
    assert.ok(result.differences.some((d) => d.category === "material"));
    assert.ok(result.differences.some((d) => d.category === "lighting" && d.field === "exposure"));
  });

  it("comparison does not mutate inputs", () => {
    const legacy = normalizeRenderConfig({
      settings: { exposure: 1 },
      materialSettings: { x: 1 },
      variants: [{ id: "v1" }],
      hotspots: [],
    });
    const copy = structuredClone(legacy);
    compareNormalizedConfigs(legacy, legacy);
    assert.deepEqual(legacy, copy);
  });

  it("valuesEqual ignores key order", () => {
    assert.equal(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  });
});

describe("AR360 Phase 3 product config compare helpers", () => {
  const product = {
    id: "PRD_TEST",
    customer_uid: "CUS-1",
    title: "Chrome Rack",
    status: "published",
    public_id: "pub",
    viewer_slug: "chrome",
    version: 3,
    settings: { exposure: 0.9, environmentImage: "studio" },
    material_settings: { "0": { baseColor: "#c0c0c0", metalness: 1, roughness: 0.15 } },
    variants: [],
    hotspots: [],
    model_url: "/Storage/Customers/CUS-1/Products/PRD_TEST/model.glb",
    file_name: "model.glb",
  };

  it("legacy vs same snapshot yields MATCH", () => {
    const snap = buildLegacyConfigSnapshot(product);
    const refs = buildLegacyAssetRefs(product);
    const result = compareProductConfigs(product, { config: snap, assetRefs: refs });
    assert.equal(result.comparison.match, true);
  });

  it("legacy vs mutated material yields MISMATCH", () => {
    const snap = buildLegacyConfigSnapshot(product);
    const refs = buildLegacyAssetRefs(product);
    const mutated = {
      ...snap,
      materialSettings: { "0": { baseColor: "#ff0000", metalness: 1, roughness: 0.15 } },
    };
    const result = compareProductConfigs(product, { config: mutated, assetRefs: refs });
    assert.equal(result.comparison.match, false);
    assert.ok(result.comparison.differences.some((d) => d.category === "material"));
  });
});
