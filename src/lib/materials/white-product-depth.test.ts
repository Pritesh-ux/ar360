import assert from "node:assert/strict";
import { test } from "node:test";
import { planWhiteProductDepth } from "./white-product-depth.ts";

test("rescues chalk-white metal into glossy porcelain with albedo headroom", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#ffffff",
    metalness: 1,
    roughness: 1,
    specularIntensity: 0,
    specularColor: "#000000",
  });
  assert.equal(plan.rescuedCeramic, true);
  assert.ok(plan.metalness <= 0.04);
  assert.ok(plan.roughness <= 0.4);
  assert.ok(plan.specularIntensity >= 0.75);
  assert.equal(plan.specularColor, "#ffffff");
  assert.ok((plan.clearcoat || 0) >= 0.3);
  assert.ok(plan.envMapScale < 0.7);
  assert.ok(plan.albedoScale < 0.82);
});

test("also lifts matte white dielectrics so bowls keep cavity contrast", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#ffffff",
    metalness: 0,
    roughness: 0.85,
    specularIntensity: 0.2,
  });
  assert.equal(plan.rescuedCeramic, true);
  assert.ok(plan.roughness <= 0.4);
  assert.ok(plan.envMapScale < 1);
});

test("does not rewrite polished white metal", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#ffffff",
    metalness: 1,
    roughness: 0.18,
    specularIntensity: 1,
  });
  assert.equal(plan.rescuedCeramic, false);
  assert.equal(plan.metalness, 1);
  assert.equal(plan.roughness, 0.18);
  assert.equal(plan.clearcoat, null);
});

test("skips textured and transmitting slots", () => {
  assert.equal(
    planWhiteProductDepth({
      baseColor: "#ffffff",
      metalness: 1,
      roughness: 1,
      hasBaseColorMap: true,
    }).rescuedCeramic,
    false,
  );
  assert.equal(
    planWhiteProductDepth({
      baseColor: "#ffffff",
      metalness: 1,
      roughness: 1,
      transmission: 0.4,
    }).rescuedCeramic,
    false,
  );
});

test("matte brown with metalness 1 stays metal so inspector sliders win", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#6b3a2a",
    metalness: 1,
    roughness: 0.62,
  });
  assert.equal(plan.metalness, 1);
  assert.equal(plan.roughness, 0.62);
  assert.equal(plan.envMapScale, 1);
});

test("matte brown dielectric keeps inspector roughness and spec", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#5a2e22",
    metalness: 0,
    roughness: 1,
    specularIntensity: 1,
  });
  assert.equal(plan.rescuedCeramic, false);
  assert.equal(plan.metalness, 0);
  assert.equal(plan.envMapScale, 1);
  assert.equal(plan.specularScale, 1);
});

test("satin brown ceramic keeps reflections instead of flattening", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#6b3a2a",
    metalness: 0,
    roughness: 0.34,
    specularIntensity: 0.92,
  });
  assert.equal(plan.envMapScale, 1);
  assert.equal(plan.specularScale, 1);
  assert.equal(plan.metalness, 0);
});

test("mid slider metalness is not snapped to paint", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#6b3a2a",
    metalness: 0.5,
    roughness: 0.5,
  });
  assert.equal(plan.metalness, 0.5);
  assert.equal(plan.roughness, 0.5);
  assert.equal(plan.envMapScale, 1);
});

test("leaves polished colored metals alone", () => {
  const plan = planWhiteProductDepth({
    baseColor: "#c9a227",
    metalness: 1,
    roughness: 0.2,
  });
  assert.equal(plan.rescuedCeramic, false);
  assert.equal(plan.metalness, 1);
  assert.equal(plan.albedoScale, 1);
});
