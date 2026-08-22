import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveAttenuationDistanceForThree,
  resolveWebTransmissionFactor,
} from "./inspector-apply.ts";

test("attenuationDistance 0 maps to Infinity (off), not full absorb", () => {
  assert.equal(resolveAttenuationDistanceForThree(0), Number.POSITIVE_INFINITY);
  assert.equal(resolveAttenuationDistanceForThree(-1), Number.POSITIVE_INFINITY);
  assert.equal(resolveAttenuationDistanceForThree(1.2), 1.2);
  assert.equal(resolveAttenuationDistanceForThree(null), null);
});

test("thin-wall transmission soft-caps so jewelry gems stay visible", () => {
  assert.equal(resolveWebTransmissionFactor(0.9, { thinWall: true }), 0.42);
  assert.equal(resolveWebTransmissionFactor(0.2, { thinWall: true }), 0.2);
  assert.equal(resolveWebTransmissionFactor(0.9, { thinWall: false }), 0.9);
  assert.equal(resolveWebTransmissionFactor(0, { thinWall: true }), 0);
});
