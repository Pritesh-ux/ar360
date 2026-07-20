import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { shouldIssueActivationPasswordSetup } from "./workflow-policy";

describe("enterprise installment activation policy", () => {
  it("issues activation email until marked sent (retry-safe)", () => {
    assert.equal(
      shouldIssueActivationPasswordSetup({
        activationEmailSent: false,
        firstActivation: true,
      }),
      true,
    );
    assert.equal(
      shouldIssueActivationPasswordSetup({
        activationEmailSent: false,
        firstActivation: false,
      }),
      true,
    );
    assert.equal(
      shouldIssueActivationPasswordSetup({
        activationEmailSent: true,
        firstActivation: true,
      }),
      false,
    );
  });

  it("migration 53 defines installment ledger columns", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "database/migrations/53_enterprise_installments.sql"),
      "utf8",
    );
    assert.match(sql, /collection_status/);
    assert.match(sql, /paid_paise/);
    assert.match(sql, /installment_label/);
    assert.match(sql, /razorpay_link/);
    assert.match(sql, /due_at/);
  });
});
