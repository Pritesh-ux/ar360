import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeEnvironmentSaturation,
  normalizeEnvironmentTint,
} from "./environment-grade-values.ts";
import { injectEnvironmentGrade } from "./environment-grade.ts";

test("normalizes HDR saturation color and slider range", () => {
  assert.equal(normalizeEnvironmentTint("#F00"), "#ff0000");
  assert.equal(normalizeEnvironmentTint("not-a-color"), "#ffffff");
  assert.equal(normalizeEnvironmentTint("#AABBCC"), "#aabbcc");
  assert.equal(normalizeEnvironmentSaturation(undefined), 1);
  assert.equal(normalizeEnvironmentSaturation(-2), 0);
  assert.equal(normalizeEnvironmentSaturation(9), 2);
  assert.equal(normalizeEnvironmentSaturation(0.4), 0.4);
});

test("grades IBL irradiance before albedo multiply, not the lit product color", () => {
  const source = `
void main() {
  #include <lights_fragment_end>
}
`;
  const next = injectEnvironmentGrade(source);
  const endAt = next.indexOf("#include <lights_fragment_end>");
  const gradeAt = next.indexOf("irradiance = ar360GradeEnvV2");
  assert.ok(gradeAt >= 0);
  assert.ok(gradeAt < endAt);
  assert.equal(next.includes("reflectedLight.indirectDiffuse = ar360GradeIbl"), false);
});
