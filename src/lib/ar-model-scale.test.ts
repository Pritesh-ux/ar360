import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatModelViewerScale,
  inferArModelScaleFromMaxDimension,
  resolveArModelScale,
} from "./ar-model-scale";

describe("ar-model-scale", () => {
  it("infers cm/mm from oversized authored dimensions", () => {
    assert.equal(inferArModelScaleFromMaxDimension(150), 0.001);
    assert.equal(inferArModelScaleFromMaxDimension(25), 0.01);
    assert.equal(inferArModelScaleFromMaxDimension(1.2), 1);
  });

  it("keeps meter-scale rooms and furniture (not 100× dollhouse)", () => {
    assert.equal(inferArModelScaleFromMaxDimension(4.2, 2.7), 1);
    assert.equal(inferArModelScaleFromMaxDimension(2.74, 2.4), 1);
  });

  it("treats 9ft architectural rooms as feet, not centimeters", () => {
    assert.equal(inferArModelScaleFromMaxDimension(9, 8), 0.3048);
    assert.equal(inferArModelScaleFromMaxDimension(9), 0.3048);
  });

  it("prefers explicit scale and unit over auto", () => {
    assert.equal(resolveArModelScale({ scale: 0.05, unit: "mm", maxDimension: 200 }), 0.05);
    assert.equal(resolveArModelScale({ unit: "cm", maxDimension: 200 }), 0.01);
    assert.equal(resolveArModelScale({ unit: "auto", maxDimension: 40 }), 0.01);
  });

  it("formats model-viewer scale attribute", () => {
    assert.equal(formatModelViewerScale(0.01), "0.01 0.01 0.01");
  });
});
