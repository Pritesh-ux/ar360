import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyComponentSlice,
  assertDraftPatchAllowed,
  extractComponentSlice,
  type ComponentConfigSlice,
} from "@/lib/platform-versioning/component-slices";
import type { Ar360ProductConfigSnapshot } from "@/lib/platform-versioning/foundation";
import {
  compareNormalizedConfigs,
  normalizeRenderConfig,
} from "@/lib/platform-versioning/config-compare";

function sampleConfig(): Ar360ProductConfigSnapshot {
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
    settings: {
      exposure: 1.4,
      environmentImage: "/hdr/night.hdr",
      cameraOrbit: "0deg 75deg 105%",
      showArButton: true,
      materialSettings: { "0": { metalness: 1 } },
    },
    materialSettings: {
      "0": { baseColor: "#ffffff", metalness: 0, roughness: 1, renderOrder: 0, bumpSoftness: 0 },
    },
    variants: [{ id: "default", materialSettings: { "0": { metalness: 0 } } }],
    hotspots: [],
    components: {
      material: { alignedToRevision: 1 },
      lighting: { alignedToRevision: 1 },
      viewer: { alignedToRevision: 1 },
      ar: { alignedToRevision: 1 },
      geometry: { alignedToRevision: 1 },
    },
  };
}

describe("AR360 Phase 5B component slices", () => {
  it("material extract does not include lighting keys", () => {
    const slice = extractComponentSlice("material", sampleConfig(), null);
    assert.equal(slice.kind, "material");
    assert.ok(slice.materialSettings);
    assert.equal((slice.settings as Record<string, unknown>).exposure, undefined);
    assert.equal((slice.settings as Record<string, unknown>).cameraOrbit, undefined);
  });

  it("lighting extract excludes materialSettings", () => {
    const slice = extractComponentSlice("lighting", sampleConfig(), null);
    assert.equal(slice.settings?.exposure, 1.4);
    assert.equal(slice.settings?.environmentImage, "/hdr/night.hdr");
    assert.equal(slice.materialSettings, undefined);
  });

  it("viewer extract is viewer-only", () => {
    const slice = extractComponentSlice("viewer", sampleConfig(), null);
    assert.equal(slice.settings?.cameraOrbit, "0deg 75deg 105%");
    assert.equal(slice.settings?.exposure, undefined);
  });

  it("ar extract is ar-only", () => {
    const slice = extractComponentSlice("ar", sampleConfig(), null);
    assert.equal(slice.settings?.showArButton, true);
    assert.equal(slice.settings?.exposure, undefined);
  });

  it("applying material slice does not change lighting", () => {
    const base = sampleConfig();
    const slice: ComponentConfigSlice = {
      kind: "material",
      materialSettings: { "0": { metalness: 1, roughness: 0.2, renderOrder: 1 } },
      variants: [],
      settings: {},
    };
    const next = applyComponentSlice(base, slice);
    assert.equal((next.settings as Record<string, unknown>).exposure, 1.4);
    const mats = next.materialSettings as Record<string, { renderOrder: number }>;
    assert.equal(mats["0"].renderOrder, 1);
  });

  it("draft patch whitelist blocks cross-component fields", () => {
    const bad = assertDraftPatchAllowed("material", {
      settings: { exposure: 2 },
    });
    assert.equal(bad.ok, false);

    const good = assertDraftPatchAllowed("material", {
      materialSettings: { "0": { renderOrder: 1 } },
    });
    assert.equal(good.ok, true);

    const lightingBad = assertDraftPatchAllowed("lighting", {
      materialSettings: { "0": { metalness: 1 } },
    });
    assert.equal(lightingBad.ok, false);
  });

  it("diff highlights only changed material fields after slice apply", () => {
    const base = sampleConfig();
    const changed = applyComponentSlice(base, {
      kind: "material",
      materialSettings: {
        "0": { baseColor: "#ffffff", metalness: 0, roughness: 1, renderOrder: 1, bumpSoftness: 0 },
      },
      variants: base.variants as unknown[],
      settings: {},
    });
    const a = normalizeRenderConfig({
      settings: base.settings,
      materialSettings: base.materialSettings,
      variants: base.variants,
      hotspots: base.hotspots,
      modelUrl: "/m.glb",
      fileName: "m.glb",
    });
    const b = normalizeRenderConfig({
      settings: changed.settings,
      materialSettings: changed.materialSettings,
      variants: changed.variants,
      hotspots: changed.hotspots,
      modelUrl: "/m.glb",
      fileName: "m.glb",
    });
    const comparison = compareNormalizedConfigs(a, b);
    assert.equal(comparison.match, false);
    assert.ok(comparison.differences.some((d) => d.category === "material"));
  });
});
