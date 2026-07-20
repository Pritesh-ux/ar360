import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTrend, previousPeriod, resolveDashboardRange } from "./dashboard.service";

describe("dashboard.service helpers", () => {
  it("resolves 30-day default range", () => {
    const range = resolveDashboardRange({ range: "30d", to: "2026-07-12" });
    assert.equal(range.to, "2026-07-12");
    assert.equal(range.from, "2026-06-13");
    assert.equal(range.label, "Last 30 days");
  });

  it("builds previous period of equal length", () => {
    const prev = previousPeriod("2026-07-06", "2026-07-12");
    assert.equal(prev.previousFrom, "2026-06-29");
    assert.equal(prev.previousTo, "2026-07-05");
  });

  it("computes trend direction", () => {
    assert.equal(buildTrend(120, 100).direction, "up");
    assert.equal(buildTrend(80, 100).direction, "down");
    assert.equal(buildTrend(0, 0).direction, "flat");
  });
});
