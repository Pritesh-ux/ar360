import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProductModelSrc } from "./modelSource";

describe("getProductModelSrc", () => {
  it("prefers modelUrl when present", () => {
    const src = getProductModelSrc({
      modelUrl: "/Storage/Customers/CUS-1/Products/PRD-1/model.glb",
      fileName: "Chair.glb",
      publicFolder: "/Storage/Customers/CUS-1/Products/PRD-1",
    });
    assert.match(String(src), /\/api\/assets\/Storage\/Customers\/CUS-1\/Products\/PRD-1\/model\.glb/);
  });

  it("falls back to canonical model.glb under publicFolder even when fileName is original upload name", () => {
    const src = getProductModelSrc({
      fileName: "Fancy Chair.glb",
      publicFolder: "/Storage/Customers/CUS-1/Products/PRD-1",
    });
    assert.match(String(src), /\/api\/assets\/Storage\/Customers\/CUS-1\/Products\/PRD-1\/model\.glb/);
    assert.doesNotMatch(String(src), /Fancy/);
  });

  it("rewrites non-canonical product GLB filenames to model.glb", () => {
    const src = getProductModelSrc({
      modelUrl: "/Storage/Customers/CUS-1/Products/PRD-1/Fancy%20Chair.glb",
      fileName: "Fancy Chair.glb",
      publicFolder: "/Storage/Customers/CUS-1/Products/PRD-1",
    });
    assert.match(String(src), /\/api\/assets\/Storage\/Customers\/CUS-1\/Products\/PRD-1\/model\.glb/);
    assert.doesNotMatch(String(src), /Fancy/);
  });
});
