/**
 * Unit smoke for gem POC V5 (no WebGL).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Box3, Mesh, Vector3 } from "three";
import {
  REFERENCE_DIAMOND_PARAMS,
  resolveAccelEffective,
  samplesForParams,
} from "./types.ts";
import { createBrilliantCutGeometry } from "./createBrilliantCut.ts";
import {
  createEmeraldCutGeometry,
  createHighFacetBrilliantGeometry,
  createMalformedGemGeometry,
} from "./createCutVariants.ts";
import { analyzeObject3D } from "./analyzeGemGeometry.ts";
import { evaluateGemSuitability } from "./gemSuitability.ts";
import {
  DIAMOND_PHYSICAL_DEFAULTS,
  QUALITY_DESKTOP_MEDIUM,
  splitContractsFromLegacy,
} from "./gemMaterialContract.ts";
import { adaptMeshToGem, disposePackedGem } from "./GemMeshAdapter.ts";
import { meshWithUniformScale } from "./scaleThickness.ts";
import { PERFORMANCE_BUDGETS } from "./performanceBudgets.ts";
import { AutoQualityController } from "./autoQualityController.ts";
import { probeDeviceCapabilities } from "./deviceCapabilities.ts";
import { TEST_ASSET_CATALOG } from "./testAssetCatalog.ts";

describe("gem-renderer-poc V5", () => {
  it("separates physical vs quality contracts", () => {
    const split = splitContractsFromLegacy({
      ...REFERENCE_DIAMOND_PARAMS,
      samplesPerPixel: 1,
    });
    assert.equal(split.physical.ior, DIAMOND_PHYSICAL_DEFAULTS.ior);
    assert.equal(split.quality.samplesPerPixel, 1);
    assert.equal(QUALITY_DESKTOP_MEDIUM.internalBounces, 6);
  });

  it("gates Gem-like vs malformed", () => {
    const good = analyzeObject3D(
      new Mesh(createBrilliantCutGeometry()),
      "brilliant",
    ).primitives[0];
    const goodGate = evaluateGemSuitability(good);
    assert.ok(
      goodGate.status === "SUPPORTED" ||
        goodGate.status === "SUPPORTED_WITH_WARNING",
    );

    const bad = analyzeObject3D(
      new Mesh(createMalformedGemGeometry()),
      "malformed",
    ).primitives[0];
    const badGate = evaluateGemSuitability(bad);
    assert.equal(badGate.status, "UNSUPPORTED");
  });

  it("scale view-fit keeps characteristicLength stable", () => {
    const g = createBrilliantCutGeometry();
    const base = new Mesh(g);
    const lens: number[] = [];
    for (const s of [0.1, 1, 10]) {
      const m = meshWithUniformScale(base, s);
      m.updateMatrixWorld(true);
      const box = new Box3().setFromObject(m);
      const size = box.getSize(new Vector3());
      const fit = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
      m.scale.multiplyScalar(fit);
      m.updateMatrixWorld(true);
      const packed = adaptMeshToGem(m, `s${s}`);
      lens.push(packed.characteristicLength);
      disposePackedGem(packed);
      m.geometry.dispose();
    }
    g.dispose();
    const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
    for (const L of lens) {
      assert.ok(Math.abs(L - mean) / mean < 0.05, `charLen drift ${L} vs ${mean}`);
    }
  });

  it("cut variants exist", () => {
    const hi = createHighFacetBrilliantGeometry();
    const em = createEmeraldCutGeometry();
    assert.ok(hi.getAttribute("position").count / 3 > 48);
    assert.ok(em.getAttribute("position").count / 3 > 8);
    hi.dispose();
    em.dispose();
  });

  it("AUTO controller has hysteresis (no change in warmup)", () => {
    const c = new AutoQualityController();
    c.pickInitial({
      caps: probeDeviceCapabilities(null, 800_000),
      triangleCount: 46,
    });
    const early = c.maybeAdapt(80, performance.now());
    assert.equal(early, null);
  });

  it("budgets and catalog exist", () => {
    assert.ok(PERFORMANCE_BUDGETS.length >= 3);
    assert.ok(TEST_ASSET_CATALOG.some((a) => a.id === "jewelry-gem"));
    assert.equal(resolveAccelEffective("auto", 46, 128, true), "direct");
    assert.equal(samplesForParams(REFERENCE_DIAMOND_PARAMS), 2);
  });
});
