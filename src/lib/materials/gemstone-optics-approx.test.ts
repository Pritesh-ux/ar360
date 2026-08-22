import assert from "node:assert/strict";
import { test } from "node:test";
import {
  injectGemstoneOpticsApprox,
  injectGemstoneOpticsApproxDetailed,
  resolveGemDebugMode,
  resolveGemstoneOpticsApproxParams,
} from "./gemstone-optics-approx.ts";

test("resolveGemstoneOpticsApproxParams prioritizes under-facet bounce over outer flash", () => {
  const ruby = resolveGemstoneOpticsApproxParams({
    gemstoneType: "ruby",
    ior: 1.77,
    transmission: 0.48,
    attenRgb: [0.04, 0.0, 0.004],
    baseRgb: [0.48, 0.05, 0.13],
    debugMode: 0,
  });
  assert.equal(ruby.enabled, true);
  assert.ok((ruby.bounce ?? 0) >= 2.2);
  assert.ok((ruby.transmitKeep ?? 1) <= 0.3);
  assert.ok((ruby.transmitKeep ?? 0) >= 0.15, "need refraction residue for pavilion");
  assert.ok((ruby.outerCrush ?? 0) >= 0.7);
  assert.ok((ruby.fireColor?.[0] ?? 0) > (ruby.attenColor?.[0] ?? 1));
  assert.equal(ruby.debugMode, 0);
});

test("injectGemstoneOpticsApprox includes ACTIVE debug without USE_ENVMAP gate", () => {
  const base = `
void main() {
  vec3 totalDiffuse = vec3(1.0);
  vec3 totalSpecular = vec3(1.0);
  #include <transmission_fragment>
  vec3 outgoingLight = totalDiffuse + totalSpecular;
  #include <opaque_fragment>
}
`;
  const detailed = injectGemstoneOpticsApproxDetailed(base);
  assert.equal(detailed.injected, true);
  assert.equal(detailed.hadOpaqueInclude, true);
  assert.equal(detailed.hadTransmissionInclude, true);
  const once = detailed.shader;
  assert.ok(once.includes("ar360GemOpticsApproxV6"));
  assert.ok(once.includes("ar360GemDebugMode"));
  assert.ok(once.includes("outgoingLight = vec3( 1.0, 0.0, 1.0 )"));
  assert.ok(once.includes("facetBase"));
  assert.ok(once.includes("bounceLight"));
  assert.ok(once.includes("textureCubeUV"));

  const twice = injectGemstoneOpticsApprox(once);
  assert.equal(
    twice.split("ar360GemOpticsApproxV6").length - 1,
    once.split("ar360GemOpticsApproxV6").length - 1,
  );
});

test("diamond under-reflection uses dark pavilion fill not white atten", () => {
  const diamond = resolveGemstoneOpticsApproxParams({
    gemstoneType: "diamond",
    ior: 2.417,
    transmission: 0.82,
    attenRgb: [1, 1, 1],
    baseRgb: [0.96, 0.97, 0.99],
    debugMode: 0,
  });
  assert.ok((diamond.bounce ?? 0) >= 3);
  assert.ok((diamond.attenColor?.[0] ?? 1) < 0.05, "pavilion fill must be near-black");
  assert.ok((diamond.fireColor?.[0] ?? 0) > 0.9);
  assert.ok((diamond.transmitKeep ?? 1) <= 0.12);
});

test("resolveGemDebugMode maps console strings", () => {
  assert.equal(resolveGemDebugMode(2), 2);
  assert.equal(resolveGemDebugMode(0), 0);
});
