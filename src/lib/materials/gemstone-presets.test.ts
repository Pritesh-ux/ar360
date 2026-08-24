import assert from "node:assert/strict";
import { test } from "node:test";
import {
  materialSettingsMatch,
  isDefaultMaterialSetting,
  compactMaterialSettings,
  cloneMaterialSettings,
} from "../../components/features/editor/utils.ts";
import {
  applyGemstonePreset,
  applyStandardMaterialCategory,
  clampDispersion,
  cloneGemstonePreset,
  getGemstonePreset,
  resolveMaterialCategory,
} from "./gemstone-presets.ts";
import { DIAMOND_LOOK_PRESET, withDiamondLook } from "./diamond-look.ts";
import {
  resolveAttenuationDistanceForThree,
  resolveGemstoneAttenuationDistanceForThree,
  resolveGemstoneThicknessFactor,
  resolveGemstoneTransmissionFactor,
  resolveWebTransmissionFactor,
} from "./inspector-apply.ts";

test("diamond preset is gemstone with physical diamond values", () => {
  const diamond = getGemstonePreset("diamond");
  assert.equal(diamond.type, "gemstone");
  assert.equal(diamond.gemstoneType, "diamond");
  assert.equal(diamond.metalness, 0);
  assert.ok((diamond.transmission ?? 0) >= 0.8);
  assert.ok(Math.abs((diamond.ior ?? 0) - 2.417) < 0.001);
  assert.equal(diamond.dispersion, 0.25);
  assert.equal(diamond.thickness, 1);
  assert.equal(diamond.roughness, 0.01);
  assert.equal(diamond.gemAbsorption, 0.002);
  assert.equal(diamond.attenuationDistance, 0);
});

test("ruby / sapphire / emerald / amethyst / moissanite presets", () => {
  const ruby = getGemstonePreset("ruby");
  assert.equal(ruby.gemstoneType, "ruby");
  assert.ok((ruby.ior ?? 0) > 1.7);
  assert.ok((ruby.dispersion ?? 1) <= 0.03);
  assert.ok((ruby.attenuationDistance ?? 1) <= 0.08);
  assert.ok((ruby.transmission ?? 1) <= 0.55);
  assert.notEqual(String(ruby.attenuationColor).toLowerCase(), "#ffffff");

  const sapphire = getGemstonePreset("sapphire");
  assert.equal(sapphire.gemstoneType, "sapphire");
  assert.ok((sapphire.transmission ?? 1) <= 0.55);

  const emerald = getGemstonePreset("emerald");
  assert.equal(emerald.gemstoneType, "emerald");
  assert.ok(Math.abs((emerald.ior ?? 0) - 1.57) < 0.02);

  const amethyst = getGemstonePreset("amethyst");
  assert.equal(amethyst.gemstoneType, "amethyst");
  assert.ok(Math.abs((amethyst.ior ?? 0) - 1.54) < 0.02);

  const moissanite = getGemstonePreset("moissanite");
  assert.equal(moissanite.gemstoneType, "moissanite");
  assert.ok((moissanite.ior ?? 0) > (getGemstonePreset("diamond").ior ?? 0));
});

test("preset cloning does not mutate canonical table", () => {
  const a = cloneGemstonePreset("diamond");
  const b = cloneGemstonePreset("diamond");
  a.baseColor = "#ff0000";
  a.dispersion = 0.5;
  assert.equal(b.baseColor, "#f4f8fc");
  assert.equal(getGemstonePreset("diamond").dispersion, 0.25);
});

test("applyGemstonePreset clones and clears albedo maps", () => {
  const next = applyGemstonePreset(
    {
      baseColor: "#111111",
      metalness: 1,
      roughness: 0.8,
      baseColorTexture: "https://example.com/a.png",
      normalTexture: "https://example.com/n.png",
    },
    "ruby",
  );
  assert.equal(next.type, "gemstone");
  assert.equal(next.gemstoneType, "ruby");
  assert.equal(next.metalness, 0);
  assert.equal(next.baseColorTexture, "__clear__");
  assert.equal(next.normalTexture, "https://example.com/n.png");
});

test("backwards-compatible MaterialSetting without type is standard", () => {
  const legacy = {
    baseColor: "#ffffff",
    metalness: 0,
    roughness: 0.5,
    emissiveColor: "#000000",
  };
  assert.equal(resolveMaterialCategory(legacy), "standard");
  assert.equal(isDefaultMaterialSetting(legacy), true);
  assert.equal(isDefaultMaterialSetting(getGemstonePreset("diamond")), false);
});

test("gemstone comparison and dispersion dirty detection", () => {
  const a = { ...applyGemstonePreset(null, "diamond") };
  const b = { ...applyGemstonePreset(null, "diamond") };
  delete a.baseColorTexture;
  delete a.metallicRoughnessTexture;
  delete b.baseColorTexture;
  delete b.metallicRoughnessTexture;
  assert.equal(materialSettingsMatch(a, b), true);
  b.dispersion = 0.12;
  assert.equal(materialSettingsMatch(a, b), false);
  const ruby = { ...applyGemstonePreset(null, "ruby") };
  delete ruby.baseColorTexture;
  delete ruby.metallicRoughnessTexture;
  assert.equal(materialSettingsMatch(a, ruby), false);
});

test("dispersion and gemstoneType survive clone/compact persistence path", () => {
  const settings = {
    0: applyGemstonePreset(null, "diamond"),
    1: applyGemstonePreset(null, "ruby"),
  };
  const compacted = compactMaterialSettings(settings);
  const cloned = cloneMaterialSettings(compacted);
  const json = JSON.parse(JSON.stringify(cloned)) as typeof settings;
  assert.equal(json[0].type, "gemstone");
  assert.equal(json[0].gemstoneType, "diamond");
  assert.equal(json[0].dispersion, 0.25);
  assert.equal(json[1].gemstoneType, "ruby");
});

test("attenuation contract: UI 0 means Infinity for Three", () => {
  assert.equal(resolveAttenuationDistanceForThree(0), Number.POSITIVE_INFINITY);
  assert.equal(resolveAttenuationDistanceForThree(0.25), 0.25);
  assert.equal(resolveAttenuationDistanceForThree(100), 100);
});

test("transmission safety soft-caps thin jewelry walls", () => {
  const capped = resolveWebTransmissionFactor(1, { thinWall: true });
  assert.ok(capped <= 0.42);
  assert.equal(resolveWebTransmissionFactor(0.95, { thinWall: false }), 0.95);
});

test("gemstone transmission soft-cap keeps colored stones optically dense", () => {
  const gemClear = resolveGemstoneTransmissionFactor(1, "diamond");
  const gemColored = resolveGemstoneTransmissionFactor(1, "sapphire");
  const thin = resolveWebTransmissionFactor(1, { thinWall: true });
  assert.ok(gemClear <= 0.7);
  assert.ok(gemColored <= 0.28, "colored gems keep refraction without full glass wash");
  assert.ok(gemColored < gemClear);
  assert.equal(resolveGemstoneThicknessFactor(0.3), 0.3);
});

test("gemstone attenuation scales with mesh optical thickness", () => {
  // Absolute UI 0.07 at reference thickness must shrink on mm-scale stones.
  const small = resolveGemstoneAttenuationDistanceForThree(0.07, 0.01, "sapphire");
  const ref = resolveGemstoneAttenuationDistanceForThree(0.07, 0.55, "sapphire");
  assert.ok(small != null && small < 0.01);
  // Colored gems clamp mean-free-path to ≤ 28% of thickness.
  assert.ok(ref != null && Number(ref) <= 0.55 * 0.28 + 1e-6);
  assert.equal(
    resolveGemstoneAttenuationDistanceForThree(0, 0.01, "diamond"),
    Number.POSITIVE_INFINITY,
  );
});

test("clampDispersion stays in safe range", () => {
  assert.equal(clampDispersion(-1), 0);
  assert.equal(clampDispersion(2), 0.5);
  assert.equal(clampDispersion(0.08), 0.08);
});

test("standard category clears gemstone keys", () => {
  const gem = applyGemstonePreset(null, "sapphire");
  const std = applyStandardMaterialCategory(gem);
  assert.equal(std.type, "standard");
  assert.equal(std.gemstoneType, undefined);
  assert.equal(std.dispersion, undefined);
});

test("Diamond Look backward compatibility", () => {
  const next = withDiamondLook({
    baseColor: "#000000",
    alphaMode: "BLEND",
    transmission: 0,
    metalness: 1,
    roughness: 0.9,
    opacity: 0.4,
    baseColorTexture: "https://example.com/albedo.png",
  });
  assert.equal(next.alphaMode, "OPAQUE");
  assert.equal(next.opacity, 1);
  assert.equal(next.baseColor, DIAMOND_LOOK_PRESET.baseColor);
  assert.equal(next.transmission, DIAMOND_LOOK_PRESET.transmission);
  assert.equal(next.ior, 2.42);
  assert.equal(next.thickness, 0);
  assert.equal(next.type, "gemstone");
  assert.equal(next.gemstoneType, "diamond");
  assert.ok((next.dispersion ?? 0) > 0);
});
