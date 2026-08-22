import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRootScaleToGltfJson,
  parseArScaleParam,
  scaleGlbBuffer,
  withArScaleQuery,
} from "./glb-scale";

function makeMinimalGlb(scale = 1): Buffer {
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ scale: [scale, scale, scale] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        max: [1, 1, 1],
        min: [0, 0, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  };

  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const jsonPad = (4 - (json.byteLength % 4)) % 4;
  const jsonLen = json.byteLength + jsonPad;
  const bin = Buffer.alloc(36);
  const binPad = 0;
  const total = 12 + 8 + jsonLen + 8 + 36 + binPad;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonLen, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  out.fill(0x20, 20 + json.byteLength, 20 + jsonLen);
  const binStart = 20 + jsonLen;
  out.writeUInt32LE(36, binStart);
  out.writeUInt32LE(0x004e4942, binStart + 4);
  bin.copy(out, binStart + 8);
  return out;
}

describe("glb-scale", () => {
  it("scales scene root nodes in JSON", () => {
    const gltf = applyRootScaleToGltfJson(
      {
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ scale: [2, 2, 2] }],
      },
      0.01,
    );
    assert.deepEqual(gltf.nodes?.[0]?.scale, [0.02, 0.02, 0.02]);
  });

  it("rewrites GLB JSON chunk with root scale", () => {
    const scaled = scaleGlbBuffer(makeMinimalGlb(1), 0.01);
    assert.equal(scaled.readUInt32LE(0), 0x46546c67);
    const jsonLen = scaled.readUInt32LE(12);
    const json = scaled.subarray(20, 20 + jsonLen).toString("utf8").replace(/\0+$/, "").trimEnd();
    const parsed = JSON.parse(json) as { nodes: Array<{ scale: number[] }> };
    assert.ok(Math.abs(parsed.nodes[0].scale[0] - 0.01) < 1e-9);
  });

  it("parses arScale query helper", () => {
    assert.equal(parseArScaleParam("0.01"), 0.01);
    assert.equal(parseArScaleParam("nope"), null);
    assert.equal(withArScaleQuery("/api/assets/Storage/Customers/a/Products/b/model.glb", 0.01),
      "/api/assets/Storage/Customers/a/Products/b/model.glb?arScale=0.01");
  });
});
