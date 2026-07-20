import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "database/migrations/40_razorpay_production_billing.sql"),
  "utf8",
);

describe("production billing migration 40", () => {
  it("defines the production subscription ledger", () => {
    for (const table of [
      "billing_plan_price_versions",
      "billing_checkout_sessions",
      "billing_refunds",
      "billing_reconciliation_issues",
      "billing_audit_log",
    ]) {
      assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }
    assert.match(migration, /provider_plan_id VARCHAR\(191\)/);
    assert.match(migration, /gst_inclusive TINYINT\(1\) NOT NULL DEFAULT 1/);
    assert.match(migration, /UNIQUE KEY uq_billing_price_version/);
  });

  it("keeps Enterprise manual and distinct from Business", () => {
    assert.match(migration, /\('business', 'BUSINESS'/);
    assert.match(migration, /\('enterprise', 'ENTERPRISE'/);
    assert.match(migration, /sales_channel = 'manual'/);
    assert.doesNotMatch(
      migration,
      /UPDATE\s+customer_subscriptions\s+SET\s+plan_id\s*=\s*'business'\s+WHERE\s+plan_id\s*=\s*'enterprise'/i,
    );
  });

  it("classifies contract-backed rows and flags ambiguous legacy rows", () => {
    assert.match(migration, /JOIN enterprise_contracts ec ON ec\.subscription_id = s\.id/);
    assert.match(migration, /classification_status = 'contract_confirmed'/);
    assert.match(migration, /classification_status = 'ambiguous_legacy'/);
    assert.match(migration, /'ambiguous_legacy_plan'/);
  });

  it("adds durable webhook retries and append-only audit fields", () => {
    assert.match(migration, /attempt_count INT UNSIGNED NOT NULL DEFAULT 0/);
    assert.match(migration, /locked_until DATETIME NULL/);
    assert.match(migration, /CREATE UNIQUE INDEX uq_billing_webhook_dedupe/);
    assert.match(migration, /previous_hash CHAR\(64\) NULL/);
    assert.match(migration, /entry_hash CHAR\(64\) NOT NULL/);
  });
});
