import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isExceeded,
  normalizePlanLimit,
  percentUsed,
  remainingFromLimit,
  usageThresholdState,
} from "./limit-normalization";
import { getCalendarMonthPeriod } from "./billing-period";

describe("normalizePlanLimit", () => {
  it("uses null for unlimited", () => {
    assert.equal(normalizePlanLimit(10, true), null);
    assert.equal(normalizePlanLimit(-1), null);
    assert.equal(normalizePlanLimit(999999999), null);
  });

  it("preserves finite limits", () => {
    assert.equal(normalizePlanLimit(5), 5);
    assert.equal(normalizePlanLimit(0), 0);
  });
});

describe("usage metrics", () => {
  it("computes remaining and percent", () => {
    assert.equal(remainingFromLimit(10, 4), 6);
    assert.equal(remainingFromLimit(null, 4), null);
    assert.equal(percentUsed(8, 10), 80);
    assert.equal(isExceeded(10, 10), true);
    assert.equal(isExceeded(9, 10), false);
    assert.equal(isExceeded(100, null), false);
  });

  it("maps threshold states", () => {
    assert.equal(usageThresholdState(79, 100), "normal");
    assert.equal(usageThresholdState(80, 100), "warning");
    assert.equal(usageThresholdState(100, 100), "exceeded");
  });
});

describe("billing period fallback", () => {
  it("returns calendar month bounds", () => {
    const period = getCalendarMonthPeriod(new Date("2026-07-15T12:00:00.000Z"));
    assert.equal(period.source, "calendar_month");
    assert.match(period.periodKey, /^2026-07-/);
    assert.ok(period.periodStart);
    assert.ok(period.periodEnd);
  });
});
