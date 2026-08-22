import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveInspectorMatchesNative } from "./utils";

describe("liveInspectorMatchesNative", () => {
  it("matches when inspector was seeded from native GLB factors", () => {
    const native = {
      baseColor: "#c0c0c0",
      metalness: 0.85,
      roughness: 0.22,
      emissiveColor: "#000000",
    };
    assert.equal(liveInspectorMatchesNative(native, native), true);
  });

  it("does not match after a roughness edit", () => {
    const native = {
      baseColor: "#c0c0c0",
      metalness: 0.85,
      roughness: 0.22,
      emissiveColor: "#000000",
    };
    assert.equal(
      liveInspectorMatchesNative({ ...native, roughness: 0.9 }, native),
      false,
    );
  });
});
