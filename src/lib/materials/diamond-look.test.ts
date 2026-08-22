import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLEAR_MATERIAL_TEXTURE,
  DIAMOND_LOOK_PRESET,
  YELLOW_GOLD_LOOK_PRESET,
  isLikelyGemMaterialName,
  isLikelyJewelryMetalSlot,
  withDiamondLook,
  withYellowGoldLook,
} from "./diamond-look.ts";

test("diamond look uses IOR refraction (not alpha fade)", () => {
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
  assert.ok((next.transmission ?? 0) >= 0.9, "transmission should be high for gem look");
  assert.equal(next.ior, 2.42);
  assert.equal(next.thickness, 0, "jewelry gems should be thin-walled");
  assert.equal(next.doubleSided, false, "double-sided thin gems vanish");
  assert.equal(next.baseColorTexture, CLEAR_MATERIAL_TEXTURE);
  assert.ok((next.roughness ?? 1) < 0.05);
});

test("cleared texture sentinel matches rewritten URL forms", async () => {
  const { isClearedMaterialTexture } = await import("./diamond-look.ts");
  assert.equal(isClearedMaterialTexture("__clear__"), true);
  assert.equal(isClearedMaterialTexture("/__clear__"), true);
  assert.equal(isClearedMaterialTexture("https://ar360studio.com/__clear__"), true);
  assert.equal(isClearedMaterialTexture("/api/assets/foo.png"), false);
});

test("yellow gold metal preset", () => {
  const next = withYellowGoldLook({
    baseColor: "#ffffff",
    metalness: 0,
    roughness: 0.9,
    transmission: 0.8,
  });
  assert.equal(next.baseColor, YELLOW_GOLD_LOOK_PRESET.baseColor);
  assert.equal(next.metalness, 1);
  assert.equal(next.transmission, 0);
  assert.ok((next.roughness ?? 1) < 0.3);
});

test("jewelry metal slot detector", () => {
  assert.equal(
    isLikelyJewelryMetalSlot({ name: "Yellow_Gold", metalness: 1 }),
    true,
  );
  assert.equal(
    isLikelyJewelryMetalSlot({ name: "Band", isTransparentPart: false, metalness: 0.9 }),
    true,
  );
  assert.equal(
    isLikelyJewelryMetalSlot({ name: "Diamond", isTransparentPart: true, metalness: 0 }),
    false,
  );
});

test("gem name detector", () => {
  assert.equal(isLikelyGemMaterialName("Diamond"), true);
  assert.equal(isLikelyGemMaterialName("Side_Stone"), true);
  assert.equal(isLikelyGemMaterialName("Gold_Band"), false);
});

test("runtime auto-applies diamond look to unnamed gem slots", async () => {
  const { resolveRuntimeGemstoneSetting } = await import("./diamond-look.ts");
  const auto = resolveRuntimeGemstoneSetting(
    { baseColor: "#ffffff", metalness: 0, roughness: 0.4 },
    "Center_Diamond",
  );
  assert.equal(auto.type, "gemstone");
  assert.equal(auto.gemstoneType, "diamond");
  assert.ok((auto.transmission ?? 0) > 0.8);

  const kept = resolveRuntimeGemstoneSetting(
    { type: "standard", baseColor: "#ffffff", metalness: 0, roughness: 0.4 },
    "Center_Diamond",
  );
  assert.equal(kept.type, "standard");
  assert.equal(kept.transmission ?? 0, 0);

  const metal = resolveRuntimeGemstoneSetting(
    { baseColor: "#cccccc", metalness: 1, roughness: 0.2 },
    "Platinum_Band",
  );
  assert.notEqual(metal.type, "gemstone");
});
