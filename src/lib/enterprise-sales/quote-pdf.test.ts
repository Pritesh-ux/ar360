import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatQuoteDate, resolveQuoteServicePeriod } from "./quote-dates";

describe("enterprise quote pdf dates", () => {
  it("formats YYYY-MM-DD and ISO datetimes without Invalid Date", () => {
    assert.notEqual(formatQuoteDate("2026-07-19"), "—");
    assert.notEqual(formatQuoteDate("2026-07-19T18:30:00.000Z"), "—");
    assert.equal(formatQuoteDate(""), "—");
    assert.equal(formatQuoteDate("not-a-date"), "—");
  });

  it("estimates yearly service period from created_at", () => {
    const period = resolveQuoteServicePeriod({
      billing_cycle: "yearly",
      created_at: "2026-07-19",
    });
    assert.equal(period.isEstimated, true);
    assert.equal(formatQuoteDate(period.startsOn), formatQuoteDate("2026-07-19"));
    assert.equal(formatQuoteDate(period.endsOn), formatQuoteDate("2027-07-18"));
  });
});
