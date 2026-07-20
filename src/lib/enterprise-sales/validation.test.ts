import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  EnterpriseCustomPlanInput,
  EnterprisePaymentInput,
  EnterpriseQuoteInput,
  EnterpriseRequestInput,
  EnterpriseStatus,
  PaymentStatus,
} from "./types";
import {
  assertPaymentTransition,
  assertStatusTransition,
  EnterpriseSalesValidationError,
  validateCustomPlan,
  validateEnterpriseRequest,
  validatePayment,
  validateQuote,
} from "./validation";

const request: EnterpriseRequestInput = {
  companyName: "  Acme Ltd  ",
  contactName: "  Ada Lovelace ",
  businessEmail: " ADA@EXAMPLE.COM ",
  phone: " +91 99999 99999 ",
  companyWebsite: "https://example.com/enterprise",
  country: " India ",
  industry: " Retail ",
  expectedProducts: 12,
};

describe("public Enterprise request validation", () => {
  it("normalizes identity fields and applies the safe source default", () => {
    const value = validateEnterpriseRequest(request);
    assert.equal(value.companyName, "Acme Ltd");
    assert.equal(value.businessEmail, "ada@example.com");
    assert.equal(value.source, "pricing");
    assert.equal(value.needsSla, false);
    assert.equal(
      validateEnterpriseRequest({ ...request, companyWebsite: "example.com" }).companyWebsite,
      "https://example.com/",
    );
  });

  it("rejects malformed contacts, unsafe websites, and invalid quantities", () => {
    assert.throws(
      () => validateEnterpriseRequest({ ...request, businessEmail: "invalid" }),
      EnterpriseSalesValidationError,
    );
    assert.throws(
      () => validateEnterpriseRequest({ ...request, companyWebsite: "javascript:alert(1)" }),
      /website is invalid/,
    );
    for (const expectedProducts of [-1, 1.5, Number.NaN]) {
      assert.throws(
        () => validateEnterpriseRequest({ ...request, expectedProducts }),
        /non-negative whole number/,
      );
    }
  });
});

describe("custom plan and quote validation", () => {
  const plan: EnterpriseCustomPlanInput = {
    name: " Dedicated ",
    billingCycle: "yearly",
    pricePaise: 120_000,
    storageLimitBytes: 0,
    productLimit: 500,
  };

  it("accepts zero resource limits but rejects invalid prices and cycles", () => {
    assert.equal(validateCustomPlan(plan).name, "Dedicated");
    assert.equal(validateCustomPlan(plan).storageLimitBytes, 0);
    assert.throws(() => validateCustomPlan({ ...plan, pricePaise: 0 }), /positive paise/);
    assert.throws(
      () => validateCustomPlan({ ...plan, billingCycle: "weekly" as "monthly" }),
      /Billing cycle/,
    );
  });

  const quote: EnterpriseQuoteInput = {
    requestUid: "ER-2026-ABCDEF12",
    customPlanUid: "ecp_abc123",
    billingCycle: "monthly",
    pricePaise: 99_900,
    validUntil: "2026-08-01",
    currency: " inr ",
    status: "sent",
  };

  it("normalizes valid quotes and rejects stale, foreign-currency, or unlinked quotes", () => {
    const value = validateQuote(quote, "2026-07-17");
    assert.equal(value.currency, "INR");
    assert.equal(value.customPlanUid, "ecp_abc123");
    assert.throws(() => validateQuote({ ...quote, validUntil: "2026-07-16" }, "2026-07-17"), /past/);
    assert.throws(() => validateQuote({ ...quote, currency: "USD" }, "2026-07-17"), /INR only/);
    assert.throws(() => validateQuote({ ...quote, customPlanUid: null }, "2026-07-17"), /active custom plan/);
    assert.throws(
      () => validateQuote({ ...quote, status: "accepted" }, "2026-07-17"),
      /draft or sent/,
    );
  });
});

describe("payment validation and state transitions", () => {
  const payment: EnterprisePaymentInput = {
    requestUid: "ER-2026-ABCDEF12",
    quoteUid: "eq_abc123",
    amountPaise: 99_900,
    paymentLink: "https://pay.example.com/order/1",
  };

  it("requires a positive amount, HTTPS link, and paid evidence", () => {
    assert.equal(validatePayment(payment).currency, "INR");
    assert.throws(() => validatePayment({ ...payment, amountPaise: 0 }), /positive paise/);
    assert.throws(() => validatePayment({ ...payment, paymentLink: "http://pay.example.com" }), /HTTPS/);
    assert.throws(() => validatePayment({ ...payment, status: "paid" }), /transaction ID and paid date/);
    assert.doesNotThrow(() => validatePayment({
      ...payment,
      status: "paid",
      transactionId: "txn_1",
      paidAt: "2026-07-17T10:00:00Z",
    }));
  });

  it("allows only the documented request status graph, including no-op replay", () => {
    const allowed: Array<[EnterpriseStatus, EnterpriseStatus]> = [
      ["new", "contacted"],
      ["contacted", "negotiating"],
      ["negotiating", "quoted"],
      ["quoted", "waiting_payment"],
      ["waiting_payment", "active"],
      ["active", "closed"],
      ["quoted", "quoted"],
    ];
    for (const [from, to] of allowed) assert.doesNotThrow(() => assertStatusTransition(from, to));
    assert.throws(() => assertStatusTransition("new", "active"), /Cannot move/);
    assert.throws(() => assertStatusTransition("closed", "new"), /Cannot move/);
  });

  it("allows payment retries/refunds and blocks reversals", () => {
    const allowed: Array<[PaymentStatus, PaymentStatus]> = [
      ["pending", "paid"],
      ["pending", "failed"],
      ["failed", "pending"],
      ["failed", "paid"],
      ["paid", "refunded"],
      ["paid", "paid"],
    ];
    for (const [from, to] of allowed) assert.doesNotThrow(() => assertPaymentTransition(from, to));
    assert.throws(() => assertPaymentTransition("paid", "pending"), /Cannot move/);
    assert.throws(() => assertPaymentTransition("refunded", "paid"), /Cannot move/);
  });
});
