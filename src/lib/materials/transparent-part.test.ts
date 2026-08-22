import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isTransparentMaterialPart,
  listGemOrGlassNameHints,
  looksLikeGemOrGlassMaterial,
  stripTransparencyOverridesForOpaqueSlot,
} from "./transparent-part.ts";

test("detects blend / transmission / glass names", () => {
  assert.equal(isTransparentMaterialPart({ alphaMode: "BLEND" }), true);
  assert.equal(isTransparentMaterialPart({ transmission: 0.4 }), true);
  assert.equal(isTransparentMaterialPart({ opacity: 0.5 }), true);
  assert.equal(isTransparentMaterialPart({ name: "Bottle_Glass" }), true);
  assert.equal(isTransparentMaterialPart({ name: "Water" }), true);
  assert.equal(isTransparentMaterialPart({ name: "PlasticCap", alphaMode: "OPAQUE" }), false);
  assert.equal(isTransparentMaterialPart({ name: "Body_Metal", metalness: 1 }), false);
});

test("detects diamond / gem names and related mesh names", () => {
  assert.equal(isTransparentMaterialPart({ name: "Diamond" }), true);
  assert.equal(isTransparentMaterialPart({ name: "Gem_Main" }), true);
  assert.equal(isTransparentMaterialPart({ name: "Material.001", relatedNames: ["Stone_01"] }), true);
  assert.equal(isTransparentMaterialPart({ name: "Gold_Band" }), false);
  assert.equal(
    isTransparentMaterialPart({ name: "Metal", relatedNames: ["Diamond"], metalness: 0.95 }),
    false,
  );
});

test("look-only gem heuristic stays strict for white fallback matte", () => {
  assert.equal(
    looksLikeGemOrGlassMaterial({
      name: "fallback Material",
      metalness: 0,
      roughness: 0.5,
      baseColor: "#f5f5f5",
      transmission: 0,
      alphaMode: "OPAQUE",
    }),
    false,
  );
  assert.equal(
    looksLikeGemOrGlassMaterial({
      name: "Material.002",
      metalness: 0.05,
      roughness: 0.08,
      baseColor: "#f8fbff",
      transmission: 0,
      alphaMode: "OPAQUE",
    }),
    true,
  );
});

test("lists gem mesh hints for editor guidance", () => {
  assert.deepEqual(listGemOrGlassNameHints(["Band", "Diamond", "Prong", "Side_Stone"]), [
    "Diamond",
    "Side_Stone",
  ]);
});

test("inspector trusts user overrides on any slot (no strip)", () => {
  const native = {
    baseColor: "#112233",
    metalness: 0.2,
    roughness: 0.4,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE" as const,
    transmission: 0,
  };
  const edited = {
    ...native,
    opacity: 0.5,
    alphaMode: "BLEND" as const,
    transmission: 0.8,
    roughness: 0.1,
  };
  const result = stripTransparencyOverridesForOpaqueSlot(edited, native, "Cap");
  assert.equal(result.opacity, 0.5);
  assert.equal(result.alphaMode, "BLEND");
  assert.equal(result.transmission, 0.8);
  assert.equal(result.roughness, 0.1);
});

test("keeps glass overrides on transparent native slots", () => {
  const native = {
    baseColor: "#aaccff",
    metalness: 0,
    roughness: 0.1,
    emissiveColor: "#000000",
    opacity: 0.6,
    alphaMode: "BLEND" as const,
    transmission: 0.5,
  };
  const edited = { ...native, opacity: 0.4, roughness: 0.05 };
  const result = stripTransparencyOverridesForOpaqueSlot(edited, native, "Glass");
  assert.equal(result.opacity, 0.4);
  assert.equal(result.roughness, 0.05);
});

test("keeps diamond overrides when native slot is gem-named", () => {
  const native = {
    baseColor: "#ffffff",
    metalness: 0.1,
    roughness: 0.05,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE" as const,
    transmission: 0,
  };
  const edited = { ...native, transmission: 0.9, alphaMode: "BLEND" as const, opacity: 0.85 };
  const result = stripTransparencyOverridesForOpaqueSlot(edited, native, "Diamond");
  assert.equal(result.transmission, 0.9);
  assert.equal(result.alphaMode, "BLEND");
});

test("preserves intentional diamond look on fallback materials", () => {
  const native = {
    baseColor: "#ffffff",
    metalness: 0,
    roughness: 0.5,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE" as const,
    transmission: 0,
  };
  const edited = {
    ...native,
    baseColor: "#eef6ff",
    opacity: 1,
    alphaMode: "OPAQUE" as const,
    transmission: 0.62,
    ior: 2.42,
    thickness: 0.18,
    roughness: 0.02,
  };
  const result = stripTransparencyOverridesForOpaqueSlot(edited, native, "fallback Material");
  assert.equal(result.transmission, 0.62);
  assert.equal(result.alphaMode, "OPAQUE");
  assert.equal(result.opacity, 1);
  assert.equal(result.ior, 2.42);
});

test("trusts refraction edits on metal-named slots", () => {
  const native = {
    baseColor: "#ffd700",
    metalness: 1,
    roughness: 0.2,
    emissiveColor: "#000000",
    opacity: 1,
    alphaMode: "OPAQUE" as const,
    transmission: 0,
  };
  const edited = {
    ...native,
    opacity: 0.4,
    alphaMode: "BLEND" as const,
    transmission: 0.9,
  };
  const result = stripTransparencyOverridesForOpaqueSlot(edited, native, "Gold_Band");
  assert.equal(result.opacity, 0.4);
  assert.equal(result.alphaMode, "BLEND");
  assert.equal(result.transmission, 0.9);
});
