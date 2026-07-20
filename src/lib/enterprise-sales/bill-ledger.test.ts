import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInstallmentFitsRemaining,
  computeCollectionStatus,
  remainingBalancePaise,
} from "./bill-ledger";

describe("enterprise bill ledger", () => {
  it("computes unpaid / partial / paid collection status", () => {
    assert.equal(computeCollectionStatus(10000000, 0), "unpaid");
    assert.equal(computeCollectionStatus(10000000, 1000000), "partial");
    assert.equal(computeCollectionStatus(10000000, 10000000), "paid");
    assert.equal(computeCollectionStatus(10000000, 12000000), "paid");
  });

  it("computes remaining balance", () => {
    assert.equal(remainingBalancePaise(10000000, 1000000), 9000000);
    assert.equal(remainingBalancePaise(10000000, 10000000), 0);
    assert.equal(remainingBalancePaise(10000000, 11000000), 0);
  });

  it("rejects installment amounts above remaining balance", () => {
    assert.throws(() => assertInstallmentFitsRemaining(2000000, 1000000), /exceeds remaining/);
    assert.throws(() => assertInstallmentFitsRemaining(0, 1000000), /positive/);
    assert.doesNotThrow(() => assertInstallmentFitsRemaining(1000000, 1000000));
  });
});
