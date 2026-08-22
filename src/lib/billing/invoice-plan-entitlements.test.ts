import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bytesToInvoiceGb,
  entitlementsFromPriceSnapshot,
  formatPlanEntitlementLine,
} from "./invoice-plan-entitlements";

describe("invoice plan entitlements", () => {
  it("formats custom-plan quotas for the invoice line", () => {
    assert.equal(
      formatPlanEntitlementLine({
        products: 250,
        storageGb: 50,
        bandwidthGb: 500,
      }),
      "250 products · 50 GB storage · 500 GB bandwidth",
    );
  });

  it("formats catalog starter quotas", () => {
    assert.equal(
      formatPlanEntitlementLine({
        products: 10,
        storageGb: 0.5,
        bandwidthGb: 2,
      }),
      "10 products · 0.5 GB storage · 2 GB bandwidth",
    );
  });

  it("prints unlimited flags", () => {
    assert.equal(
      formatPlanEntitlementLine({
        products: null,
        storageGb: null,
        bandwidthGb: null,
        unlimitedProducts: true,
        unlimitedStorage: true,
        unlimitedBandwidth: true,
      }),
      "Unlimited products · Unlimited storage · Unlimited bandwidth",
    );
  });

  it("reads entitlements from a price_snapshot JSON blob", () => {
    const parsed = entitlementsFromPriceSnapshot({
      entitlements: { products: 200, storageGb: 10, bandwidthGb: 250 },
    });
    assert.deepEqual(parsed, {
      products: 200,
      storageGb: 10,
      bandwidthGb: 250,
      unlimitedProducts: false,
      unlimitedStorage: false,
      unlimitedBandwidth: false,
    });
  });

  it("converts byte limits to invoice GB", () => {
    assert.equal(bytesToInvoiceGb(50 * 1024 * 1024 * 1024), 50);
  });
});
