import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAcceptedModelExtension,
  isConvertibleModelExtension,
  modelExtension,
} from "@/lib/products/convert-model-to-glb";

describe("convert-model-to-glb helpers", () => {
  it("detects extensions case-insensitively", () => {
    assert.equal(modelExtension("Chair.GLB"), ".glb");
    assert.equal(modelExtension("mesh.OBJ"), ".obj");
    assert.equal(modelExtension("rig.Fbx"), ".fbx");
  });

  it("accepts glb/obj/fbx only", () => {
    assert.equal(isAcceptedModelExtension(".glb"), true);
    assert.equal(isAcceptedModelExtension(".obj"), true);
    assert.equal(isAcceptedModelExtension(".fbx"), true);
    assert.equal(isAcceptedModelExtension(".usdz"), false);
  });

  it("marks obj/fbx as convertible", () => {
    assert.equal(isConvertibleModelExtension(".obj"), true);
    assert.equal(isConvertibleModelExtension(".fbx"), true);
    assert.equal(isConvertibleModelExtension(".glb"), false);
  });
});
