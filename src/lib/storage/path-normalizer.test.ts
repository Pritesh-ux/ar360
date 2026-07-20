import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getProductPublicFolder,
  normalizePublicStoragePath,
} from "./path-normalizer";

describe("normalizePublicStoragePath", () => {
  it("returns empty for falsy input", () => {
    assert.equal(normalizePublicStoragePath(null), "");
    assert.equal(normalizePublicStoragePath(""), "");
  });

  it("strips traversal attempts from absolute URLs", () => {
    const result = normalizePublicStoragePath("https://cdn.example.com/Storage/Customers/c1/Products/p1/model.glb");
    assert.equal(result, "/Storage/Customers/c1/Products/p1/model.glb");
  });

  it("normalizes Windows-style paths", () => {
    const result = normalizePublicStoragePath("C:\\\\xampp\\\\htdocs\\\\ar360\\\\Storage\\\\Customers\\\\c1\\\\model.glb");
    assert.ok(result.includes("/Storage/Customers/c1/model.glb"));
  });

  it("rejects path injection via encoded segments in URL pathname", () => {
    const result = normalizePublicStoragePath("/Storage/Customers/../etc/passwd");
    assert.ok(!result.includes(".."));
  });
});

describe("getProductPublicFolder", () => {
  it("builds canonical public folder", () => {
    assert.equal(
      getProductPublicFolder("cust-1", "prod-1"),
      "/Storage/Customers/cust-1/Products/prod-1",
    );
  });
});
