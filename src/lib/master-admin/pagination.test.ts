import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  paginationMeta,
  parsePagination,
  paginationRange,
} from "./pagination";

describe("parsePagination", () => {
  it("defaults page and pageSize", () => {
    const params = parsePagination(new URLSearchParams());
    assert.equal(params.page, 1);
    assert.equal(params.pageSize, 10);
    assert.equal(params.offset, 0);
  });

  it("caps pageSize at 100", () => {
    const params = parsePagination(new URLSearchParams("page=2&pageSize=500"));
    assert.equal(params.page, 2);
    assert.equal(params.pageSize, 100);
    assert.equal(params.offset, 100);
  });

  it("clamps invalid page to 1", () => {
    const params = parsePagination(new URLSearchParams("page=0&pageSize=15"));
    assert.equal(params.page, 1);
    assert.equal(params.pageSize, 15);
  });
});

describe("paginationMeta", () => {
  it("computes total pages", () => {
    const meta = paginationMeta(47, 2, 15);
    assert.equal(meta.total, 47);
    assert.equal(meta.totalPages, 4);
    assert.equal(meta.page, 2);
  });

  it("never returns zero total pages", () => {
    const meta = paginationMeta(0, 1, 10);
    assert.equal(meta.totalPages, 1);
  });
});

describe("paginationRange", () => {
  it("returns from/to for a page", () => {
    const range = paginationRange({ page: 2, pageSize: 10, total: 25, totalPages: 3 });
    assert.deepEqual(range, { from: 11, to: 20 });
  });

  it("returns zeros for empty results", () => {
    const range = paginationRange({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
    assert.deepEqual(range, { from: 0, to: 0 });
  });
});
