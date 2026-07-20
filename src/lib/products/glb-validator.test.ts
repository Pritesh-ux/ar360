import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSampleGlbBuffer } from "@/lib/onboarding/sample-glb";
import { validateGlbUpload } from "@/lib/products/glb-validator";
import { ProductErrorCode } from "@/lib/products/product-errors";

describe("glb-validator", () => {
  it("accepts a valid embedded sample GLB", () => {
    const buffer = createSampleGlbBuffer();
    const result = validateGlbUpload({
      buffer,
      fileName: "sample.glb",
      mimeType: "model/gltf-binary",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.meshCount >= 1);
    }
  });

  it("rejects invalid magic header", () => {
    const buffer = Buffer.from("not-a-glb-file-content");
    const result = validateGlbUpload({
      buffer,
      fileName: "bad.glb",
      mimeType: "model/gltf-binary",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, ProductErrorCode.MODEL_CORRUPTED);
    }
  });

  it("rejects non-glb extension", () => {
    const buffer = createSampleGlbBuffer();
    const result = validateGlbUpload({
      buffer,
      fileName: "model.obj",
      mimeType: "application/octet-stream",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, ProductErrorCode.INVALID_GLB);
    }
  });
});
