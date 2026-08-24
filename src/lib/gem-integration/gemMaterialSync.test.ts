import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MaterialSetting } from "@/components/features/editor/types";
import { applyGemstonePreset, GEMSTONE_TYPES } from "@/lib/materials/gemstone-presets";
import { DIAMOND_PHYSICAL_DEFAULTS } from "@/lib/gem-renderer-poc/gemMaterialContract";
import { JEWELRY_STUDIO_LIGHTING } from "@/lib/render/jewelry-studio-lighting";
import {
  buildGemUiRendererDiagnostic,
  isGemRendererEligibleGemstone,
  mapMaterialSettingToGemPhysicalParams,
  materialSettingGemSignature,
  resolveGemEnvironmentIntensity,
  shouldUseGemRendererForSetting,
} from "@/lib/gem-integration/gemMaterialSync";
import { buildAr360EnvironmentSource } from "@/lib/gem-integration/environmentBridge";

describe("gemMaterialSync", () => {
  it("Diamond UI state maps to GemRenderer contract defaults", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const params = mapMaterialSettingToGemPhysicalParams(setting);
    assert.equal(params.ior, DIAMOND_PHYSICAL_DEFAULTS.ior);
    assert.equal(params.dispersion, DIAMOND_PHYSICAL_DEFAULTS.dispersion);
    assert.equal(params.thickness, DIAMOND_PHYSICAL_DEFAULTS.thickness);
    assert.equal(params.roughness, DIAMOND_PHYSICAL_DEFAULTS.roughness);
    assert.deepEqual(params.absorption, DIAMOND_PHYSICAL_DEFAULTS.absorption);
  });

  it("all gemstone types are GemRenderer eligible", () => {
    for (const type of GEMSTONE_TYPES) {
      const setting = applyGemstonePreset({}, type);
      assert.equal(shouldUseGemRendererForSetting(setting), true, type);
      assert.equal(isGemRendererEligibleGemstone(type), true, type);
      assert.notEqual(materialSettingGemSignature(setting), "pbr", type);
    }
  });

  it("IOR change reaches GemRenderer mapping", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const next = { ...setting, ior: 2.5 };
    assert.equal(mapMaterialSettingToGemPhysicalParams(next).ior, 2.5);
    assert.notEqual(materialSettingGemSignature(setting), materialSettingGemSignature(next));
  });

  it("dispersion change reaches GemRenderer mapping", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const next = { ...setting, dispersion: 0.3 };
    assert.equal(mapMaterialSettingToGemPhysicalParams(next).dispersion, 0.3);
  });

  it("absorption change reaches GemRenderer mapping", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const next = { ...setting, gemAbsorption: 0.004 };
    assert.deepEqual(mapMaterialSettingToGemPhysicalParams(next).absorption, [0.004, 0.004, 0.004]);
  });

  it("ruby attenuation maps to colored absorption", () => {
    const setting = applyGemstonePreset({}, "ruby");
    const params = mapMaterialSettingToGemPhysicalParams(setting);
    assert.equal(params.gemstoneType, "custom");
    assert.ok(params.absorption[0] > 0);
    assert.ok(params.absorption[2] >= params.absorption[1]);
  });

  it("thickness change reaches GemRenderer mapping", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const next = { ...setting, thickness: 1.25 };
    assert.equal(mapMaterialSettingToGemPhysicalParams(next).thickness, 1.25);
  });

  it("roughness change reaches GemRenderer mapping", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const next = { ...setting, roughness: 0.02 };
    assert.equal(mapMaterialSettingToGemPhysicalParams(next).roughness, 0.02);
  });

  it("Diamond → Ruby keeps GemRenderer eligibility", () => {
    const diamond = applyGemstonePreset({}, "diamond");
    const ruby = applyGemstonePreset(diamond, "ruby");
    assert.equal(shouldUseGemRendererForSetting(diamond), true);
    assert.equal(shouldUseGemRendererForSetting(ruby), true);
    assert.notEqual(materialSettingGemSignature(diamond), materialSettingGemSignature(ruby));
  });

  it("Ruby → Diamond activation eligibility", () => {
    const ruby = applyGemstonePreset({}, "ruby");
    const diamond = applyGemstonePreset(ruby, "diamond");
    assert.equal(shouldUseGemRendererForSetting(ruby), true);
    assert.equal(shouldUseGemRendererForSetting(diamond), true);
    assert.equal(isGemRendererEligibleGemstone(diamond.gemstoneType), true);
  });

  it("resolveGemEnvironmentIntensity normalizes diamond PBR preset to POC ~1.0", () => {
    const diamond = applyGemstonePreset({}, "diamond");
    const intensity = resolveGemEnvironmentIntensity(diamond);
    assert.ok(Math.abs(intensity - 1.0) < 0.08, `expected ~1.0 got ${intensity}`);
  });

  it("variation material-only update changes gem signature without type switch", () => {
    const v1 = applyGemstonePreset({}, "diamond");
    const v2 = { ...v1, dispersion: 0.22 };
    assert.notEqual(materialSettingGemSignature(v1), materialSettingGemSignature(v2));
    assert.equal(v1.gemstoneType, v2.gemstoneType);
  });

  it("buildGemUiRendererDiagnostic reports gem-renderer mode when overlay ready", () => {
    const setting = applyGemstonePreset({}, "diamond");
    const diag = buildGemUiRendererDiagnostic(setting, true, true);
    assert.equal(diag.rendererMode, "gem-renderer");
    assert.equal(diag.gemstoneType, "diamond");
    assert.equal(diag.ior, DIAMOND_PHYSICAL_DEFAULTS.ior);
  });

  it("non-gemstone material never uses GemRenderer", () => {
    const std: Partial<MaterialSetting> = { type: "standard", baseColor: "#fff" };
    assert.equal(shouldUseGemRendererForSetting(std), false);
  });
});

describe("environmentBridge", () => {
  it("default/neutral editor env resolves to jewelry studio HDR", () => {
    const env = buildAr360EnvironmentSource({ environmentImage: "default" });
    assert.equal(env.url, JEWELRY_STUDIO_LIGHTING.environmentImage);
    assert.equal(env.exposure, JEWELRY_STUDIO_LIGHTING.exposure);
  });

  it("custom HDR path is preserved", () => {
    const env = buildAr360EnvironmentSource({
      environmentImage: "/hdr/custom.hdr",
      exposure: 1.2,
    });
    assert.equal(env.url, "/hdr/custom.hdr");
    assert.equal(env.exposure, 1.2);
  });
});

describe("integrationPipeline", () => {
  it("REFERENCE DIAMOND calibration matches POC studio HDR", async () => {
    const pipeline = await import("@/lib/gem-integration/integrationPipeline");
    assert.equal(pipeline.INTEGRATION_REFERENCE_CALIBRATION.params.environmentIntensity, 1);
    assert.equal(pipeline.INTEGRATION_REFERENCE_CALIBRATION.environmentUrl, "/hdr/studio.hdr");
  });
});

describe("gemMaterialSync bridge hooks", () => {
  it("prepared attach test hook is exported for no-duplicate guards", async () => {
    const bridge = await import("@/lib/gem-integration/gemModelViewerBridge");
    assert.equal(typeof bridge.__gemBridgeTestGetActiveRendererCount, "function");
    assert.equal(typeof bridge.__gemBridgeTestHasPreparedAttach, "function");
    assert.equal(bridge.__gemBridgeTestGetActiveRendererCount(), 0);
  });
});
