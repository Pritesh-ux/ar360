import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enterpriseActivationEmail } from "@/lib/email/templates/enterprise-activation";
import {
  effectiveActivationPaymentDetails,
  invoiceBelongsToCustomer,
  isActivationReplay,
  isDuplicateEntryError,
  paymentInvoiceMatchesRequest,
  renewalResultFromExisting,
  shouldIssueActivationPasswordSetup,
  shouldMarkActivationEmailSent,
  shouldRetryPublicRequestUid,
} from "./workflow-policy";

function duplicateError() {
  return Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
}

describe("duplicate resistance and renewal idempotency", () => {
  it("retries only UID collisions and stops at the attempt boundary", () => {
    assert.equal(isDuplicateEntryError(duplicateError()), true);
    assert.equal(shouldRetryPublicRequestUid(duplicateError(), 0), true);
    assert.equal(shouldRetryPublicRequestUid(duplicateError(), 1), true);
    assert.equal(shouldRetryPublicRequestUid(duplicateError(), 2), false);
    assert.equal(shouldRetryPublicRequestUid(new Error("connection lost"), 0), false);
  });

  it("returns the existing renewal instead of creating another", () => {
    assert.deepEqual(
      renewalResultFromExisting({ request_uid: "ER-2026-EXISTING" }),
      { requestUid: "ER-2026-EXISTING", created: false },
    );
    assert.equal(renewalResultFromExisting({ request_uid: null }), null);
    assert.equal(renewalResultFromExisting(undefined), null);
  });
});

describe("paid activation invariants", () => {
  it("classifies replay only when paid payment links are complete", () => {
    assert.equal(isActivationReplay({ status: "paid", subscriptionId: 7, contractId: 8 }), true);
    assert.equal(isActivationReplay({ status: "paid", subscriptionId: 7, contractId: null }), false);
    assert.equal(isActivationReplay({ status: "pending", subscriptionId: 7, contractId: 8 }), false);
  });

  it("preserves immutable paid evidence on an idempotent replay", () => {
    const storedDate = "2026-07-16T10:00:00Z";
    assert.deepEqual(
      effectiveActivationPaymentDetails(
        {
          status: "paid",
          transactionId: "txn_original",
          paymentMethod: "bank",
          paidAt: storedDate,
        },
        {
          transactionId: "txn_original",
          paymentMethod: "card",
          paidAt: new Date("2026-07-17T10:00:00Z"),
        },
      ),
      {
        transactionId: "txn_original",
        paymentMethod: "bank",
        paidAt: storedDate,
      },
    );
  });

  it("uses submitted evidence for first activation", () => {
    const paidAt = new Date("2026-07-17T10:00:00Z");
    assert.deepEqual(
      effectiveActivationPaymentDetails(
        { status: "pending" },
        { transactionId: "txn_new", paymentMethod: "upi", paidAt },
      ),
      { transactionId: "txn_new", paymentMethod: "upi", paidAt },
    );
  });
});

describe("password invitation boundaries", () => {
  it("issues once after activation and marks sent only after delivery", () => {
    assert.equal(shouldIssueActivationPasswordSetup(null), false);
    assert.equal(shouldIssueActivationPasswordSetup({ activationEmailSent: false }), true);
    assert.equal(shouldIssueActivationPasswordSetup({ activationEmailSent: true }), false);
    assert.equal(shouldMarkActivationEmailSent(false), false);
    assert.equal(shouldMarkActivationEmailSent(true), true);
  });

  it("describes a one-time expiring setup link and escapes HTML", () => {
    const email = enterpriseActivationEmail({
      contactName: "<Admin>",
      companyName: "A&B",
      setupUrl: "https://example.com/reset?token=a&email=b",
      ttlMinutes: 60,
    });
    assert.match(email.text, /one-time link/);
    assert.match(email.text, /valid for 60 minutes/);
    assert.doesNotMatch(email.html, /<Admin>/);
    assert.match(email.html, /&lt;Admin&gt;/);
    assert.match(email.html, /A&amp;B/);
  });
});

describe("invoice ownership isolation", () => {
  it("requires exact customer and request/payment ownership", () => {
    assert.equal(invoiceBelongsToCustomer("CUS-A", "CUS-A"), true);
    assert.equal(invoiceBelongsToCustomer("CUS-B", "CUS-A"), false);
    assert.equal(invoiceBelongsToCustomer(null, "CUS-A"), false);
    assert.equal(
      paymentInvoiceMatchesRequest(
        { request_uid: "ER-A", payment_uid: "EP-A" },
        "ER-A",
        "EP-A",
      ),
      true,
    );
    assert.equal(
      paymentInvoiceMatchesRequest(
        { request_uid: "ER-B", payment_uid: "EP-A" },
        "ER-A",
        "EP-A",
      ),
      false,
    );
  });
});
