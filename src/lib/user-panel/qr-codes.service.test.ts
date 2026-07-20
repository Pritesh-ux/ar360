import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEffectiveQrStatus } from "./qr-codes.service";

describe("qr-codes.service helpers", () => {
  it("marks past expiry as expired", () => {
    const status = resolveEffectiveQrStatus({
      status: "active",
      expires_at: "2020-01-01 00:00:00",
      deleted_at: null,
    });
    assert.equal(status, "expired");
  });

  it("keeps active when no expiry", () => {
    assert.equal(
      resolveEffectiveQrStatus({ status: "active", expires_at: null, deleted_at: null }),
      "active",
    );
  });

  it("treats deleted rows as archived", () => {
    assert.equal(
      resolveEffectiveQrStatus({ status: "active", expires_at: null, deleted_at: "2026-01-01" }),
      "archived",
    );
  });
});
