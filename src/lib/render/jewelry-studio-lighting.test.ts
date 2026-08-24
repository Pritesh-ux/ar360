import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JEWELRY_STUDIO_LIGHTING,
  isDefaultishEnvironmentImage,
  nativeSlotNeedsPhysicalTransmission,
  resolveJewelryStudioPresentation,
  shouldUseJewelryStudioLighting,
} from "./jewelry-studio-lighting";

describe("shouldUseJewelryStudioLighting", () => {
  it("detects jewelry category and gem mesh hints", () => {
    assert.equal(shouldUseJewelryStudioLighting({ category: "Jewelry" }), true);
    assert.equal(shouldUseJewelryStudioLighting({ title: "Ruby Ring" }), true);
    assert.equal(
      shouldUseJewelryStudioLighting({ gemMeshHints: ["Diamond_Facet"] }),
      true,
    );
    assert.equal(shouldUseJewelryStudioLighting({ category: "Furniture" }), false);
  });

  it("detects native transmission without inventing materials", () => {
    assert.equal(
      shouldUseJewelryStudioLighting({
        nativeMaterials: { 0: { transmission: 0.4 } },
      }),
      true,
    );
    assert.equal(
      shouldUseJewelryStudioLighting({
        nativeMaterials: { 0: { transmission: 0 } },
      }),
      false,
    );
  });
});

describe("resolveJewelryStudioPresentation", () => {
  it("is lighting-only and does not invent material fields", () => {
    assert.equal("materialSettings" in JEWELRY_STUDIO_LIGHTING, false);
    assert.equal(JEWELRY_STUDIO_LIGHTING.useSkybox, false);
    assert.ok(isDefaultishEnvironmentImage("default"));
    assert.ok(isDefaultishEnvironmentImage("neutral"));
  });

  it("applies jewelry IBL only while environment stays defaultish", () => {
    const resolved = resolveJewelryStudioPresentation({
      enabled: true,
      environmentImage: "default",
      exposure: 0.9,
      toneMapping: "commerce",
    });
    assert.equal(resolved.profileId, "JEWELRY_STUDIO");
    assert.equal(resolved.environmentImage, JEWELRY_STUDIO_LIGHTING.environmentImage);
    assert.equal(resolved.toneMapping, "agx");
    assert.equal(resolved.useSkybox, false);
  });

  it("preserves custom HDR and exposure choices", () => {
    const resolved = resolveJewelryStudioPresentation({
      enabled: true,
      environmentImage: "/hdr/night.hdr",
      exposure: 1.4,
      toneMapping: "aces",
      useSkybox: true,
    });
    assert.equal(resolved.environmentImage, "/hdr/night.hdr");
    assert.equal(resolved.exposure, 1.4);
    assert.equal(resolved.toneMapping, "aces");
    assert.equal(resolved.useSkybox, false);
  });

  it("does nothing when jewelry mode is off", () => {
    const resolved = resolveJewelryStudioPresentation({
      enabled: false,
      environmentImage: "default",
      exposure: 0.9,
    });
    assert.equal(resolved.profileId, null);
    assert.equal(resolved.environmentImage, "default");
    assert.equal(resolved.toneMapping, "commerce");
  });
});

describe("nativeSlotNeedsPhysicalTransmission", () => {
  it("flags only real transmission slots", () => {
    assert.equal(nativeSlotNeedsPhysicalTransmission({ transmission: 0.3 }), true);
    assert.equal(nativeSlotNeedsPhysicalTransmission({ transmission: 0 }), false);
    assert.equal(nativeSlotNeedsPhysicalTransmission(null), false);
  });
});
