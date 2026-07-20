import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitInclusiveGst } from "@/server/billing/invoice.service";

describe("GST-inclusive invoice arithmetic", () => {
  it("splits the customer-paid total without losing paise", () => {
    const split = splitInclusiveGst(117_900);
    assert.deepEqual(split, {
      subtotalPaise: 99_915,
      taxPaise: 17_985,
      totalPaise: 117_900,
    });
    assert.equal(split.subtotalPaise + split.taxPaise, split.totalPaise);
  });

  it("rejects invalid provider amounts", () => {
    assert.throws(() => splitInclusiveGst(0), /positive paise/);
    assert.throws(() => splitInclusiveGst(10.5), /positive paise/);
  });
});
