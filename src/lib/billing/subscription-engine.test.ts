import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkQrEntitlement, checkShareEntitlement, type PlanLimits } from "./plan-enforcement";
import { captureLimitsFromPlan } from "@/lib/object-capture/operations";

const basePlan: PlanLimits = {
  planId: "starter",
  name: "Starter",
  products: 5,
  storageMb: 512,
  allowViewer: true,
  allowUpload: true,
  allowAr: true,
  allowQr: true,
  allowShare: true,
  allowCustomBranding: false,
  qrCodes: 3,
  shareLinks: 2,
};

describe("QR entitlement uses QR meter not product count", () => {
  it("allows when qrCodesUsed is under limit even if productsUsed is high", () => {
    const result = checkQrEntitlement(basePlan, {
      productsUsed: 99,
      storageUsedMb: 10,
      qrCodesUsed: 1,
    });
    assert.equal(result.allowed, true);
  });

  it("blocks when qrCodesUsed reaches plan.qrCodes", () => {
    const result = checkQrEntitlement(basePlan, {
      productsUsed: 1,
      storageUsedMb: 10,
      qrCodesUsed: 3,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.limitType, "qr");
  });

  it("blocks when allowQr is false", () => {
    const result = checkQrEntitlement(
      { ...basePlan, allowQr: false },
      { productsUsed: 0, storageUsedMb: 0, qrCodesUsed: 0 },
    );
    assert.equal(result.allowed, false);
  });
});

describe("Share entitlement uses shareLinksUsed", () => {
  it("blocks at share link limit", () => {
    const result = checkShareEntitlement(basePlan, {
      productsUsed: 0,
      storageUsedMb: 0,
      shareLinksUsed: 2,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.limitType, "share");
  });
});

describe("Object Capture limits from PlanLimits", () => {
  it("reads OC fields from plan without plan-name switch", () => {
    const limits = captureLimitsFromPlan({
      ...basePlan,
      ocCapturesPerMonth: 12,
      ocComputeSecondsPerMonth: 9000,
      ocConcurrentJobs: 3,
      ocMaxRetries: 4,
    });
    assert.equal(limits.capturesPerMonth, 12);
    assert.equal(limits.concurrentJobs, 3);
    assert.equal(limits.maxRetries, 4);
  });
});
