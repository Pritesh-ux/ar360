import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveViewerBumpScale,
  resolveViewerBumpSoftness,
} from "./viewer-bump-feel.ts";

test("bump softness always matches authored canvas value", () => {
  assert.equal(resolveViewerBumpSoftness(0.18), 0.18);
  assert.equal(resolveViewerBumpSoftness(0.4), 0.4);
  assert.equal(resolveViewerBumpSoftness(0), 0);
});

test("bump scale defaults to 1 when unset", () => {
  assert.equal(resolveViewerBumpScale(null), 1);
  assert.equal(resolveViewerBumpScale(1.24), 1.24);
});
